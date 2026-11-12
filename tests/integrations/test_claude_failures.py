"""Failure envelopes and diagnostics, using synthetic data only (no real CLI)."""
import json
import sys
import unittest
from unittest.mock import patch

from integrations import errors
from integrations.adapters.claude_code import ClaudeCodeAdapter
from integrations.config import ClaudeCodeSettings
from integrations.contracts_v1_1 import GenerateRequestV11
from integrations.runner import ProcessResult
from test_gateway import FAKE, GatewayTestCase, request_body

LOGGER = "ia_bbaru.claude_failure"


class FailureEnvelopeTests(GatewayTestCase):
    def test_errors_array_classified_and_replayed_without_generation(self):
        for version in ("1", "1.1"):
            for mode, status, code in (
                ("errors_auth", 503, "provider_not_authenticated"),
                ("errors_quota", 429, "provider_quota_exceeded"),
                ("errors_unknown", 502, "provider_error"),
                ("errors_budget", 502, "provider_error"),
            ):
                with self.subTest(version=version, mode=mode):
                    self.set_mode(FAKE_CLAUDE_MODE=mode)
                    body = request_body(protocol_version=version,
                                        request_id=f"{version}:{mode}:PRIVATE_ID_SENTINEL",
                                        max_output_tokens=128)
                    if version == "1.1":
                        body["allow_unenforced_output_limit"] = True
                    before = self.runner.generations
                    with self.assertLogs(LOGGER, level="WARNING") as captured:
                        first = self.client.post(f"/v{version}/generate", json=body)
                    self.assertEqual(first.status_code, status)
                    self.assertEqual(first.json()["error"]["code"], code)
                    self.assertNotIn("PRIVATE", first.text)
                    with self.assertNoLogs(LOGGER, level="WARNING"):
                        replay = self.client.post(f"/v{version}/generate", json=body)
                    self.assertEqual(replay.status_code, status)
                    self.assertEqual(replay.json(), first.json())
                    self.assertEqual(self.runner.generations, before + 1)
                    report = json.loads(captured.records[0].getMessage())
                    self.assertEqual(report["subtype"], "error_during_execution")
                    self.assertEqual(report["error_items"], 1)
                    self.assertEqual(report["max_output_tokens"], 128)
                    self.assertTrue(report["stderr_present"])
                    self.assertFalse(report["has_result_text"])
                    self.assertNotIn("PRIVATE", str(captured.output))
                    if mode == "errors_budget":
                        self.assertEqual(report["markers"], ["thinking_output_budget"])


class ParserFailureTests(unittest.TestCase):
    def setUp(self):
        self.adapter = ClaudeCodeAdapter(ClaudeCodeSettings(
            models=["sonnet"], command=[sys.executable, str(FAKE)]))

    def test_failure_subtype_cannot_be_treated_as_success(self):
        proc = ProcessResult(0, json.dumps({
            "subtype": "error_during_execution", "is_error": False,
            "result": "partial", "errors": ["Usage limit reached"],
        }), "")
        with self.assertRaises(errors.GatewayError) as caught:
            self.adapter.parse("sonnet", proc)
        self.assertEqual(caught.exception.code, "provider_quota_exceeded")

    def test_missing_result_in_success_is_invalid_output(self):
        for payload in ({"is_error": False}, {"result": {"text": "answer"}}):
            with self.subTest(payload=payload), self.assertRaises(errors.GatewayError) as caught:
                self.adapter.parse("sonnet", ProcessResult(0, json.dumps(payload), ""))
            self.assertEqual(caught.exception.code, "provider_invalid_output")

    def test_success_text_is_not_reclassified_as_an_error(self):
        payload = {"type": "result", "subtype": "success", "is_error": False,
                   "result": "Explaining authentication, quota and /login.",
                   "modelUsage": {"claude-sonnet-5-5": {"outputTokens": 10}},
                   "stop_reason": "end_turn"}
        request = GenerateRequestV11(**request_body(
            protocol_version="1.1", allow_unenforced_output_limit=True))
        with patch.object(self.adapter, "runner", return_value=ProcessResult(
                0, json.dumps(payload), "quota warning")), self.assertNoLogs(LOGGER):
            result = self.adapter.generate(request)
        self.assertEqual(result.output, payload["result"])
        self.assertEqual(result.finish_reason, "stop")

    def test_unknown_failure_metadata_and_stderr_never_leak(self):
        for payload in (
            {"is_error": True, "subtype": "PRIVATE_SUBTYPE", "errors": [{"secret": "PRIVATE_ERROR"}]},
            {"is_error": True, "subtype": ["PRIVATE_SUBTYPE"], "errors": "PRIVATE_ERROR"},
            ["PRIVATE_OUTPUT"],
            "PRIVATE_OUTPUT",
        ):
            with self.subTest(payload=payload):
                proc = ProcessResult(1, json.dumps(payload), "PRIVATE_STDERR")
                request = GenerateRequestV11(**request_body(
                    protocol_version="1.1", allow_unenforced_output_limit=True,
                    request_id="PRIVATE_ID", instruction="PRIVATE_INSTRUCTION"))
                with patch.object(self.adapter, "runner", return_value=proc), \
                        self.assertLogs(LOGGER, level="WARNING") as captured, \
                        self.assertRaises(errors.GatewayError):
                    self.adapter.generate(request)
                self.assertNotIn("PRIVATE", str(captured.output))
                report = json.loads(captured.records[0].getMessage())
                self.assertEqual(report["subtype"], "unknown")
                self.assertEqual(report["markers"], [])

    def test_invalid_json_diagnostic_never_contains_output(self):
        request = GenerateRequestV11(**request_body(
            protocol_version="1.1", allow_unenforced_output_limit=True))
        with patch.object(self.adapter, "runner", return_value=ProcessResult(1, "PRIVATE", "")), \
                self.assertLogs(LOGGER, level="WARNING") as captured, \
                self.assertRaises(errors.GatewayError) as caught:
            self.adapter.generate(request)
        self.assertEqual(caught.exception.code, "provider_invalid_output")
        report = json.loads(captured.records[0].getMessage())
        self.assertEqual(report["stdout_shape"], "invalid_json")
        self.assertNotIn("PRIVATE", str(captured.output))


if __name__ == "__main__":
    unittest.main()
