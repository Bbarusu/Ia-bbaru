"""provider_error diagnosis (P0, AJUSTES_CHAT_LATERAL.md).

Fixtures only (fake_claude.py). The failure shapes come from the 2.1.322 result
schema and messages, read from the official package without generating; none
of them was observed in the user's failed run, whose cause is still unknown.
"""
import io
import json
import os
import logging
import subprocess
import sys
from pathlib import Path

from integrations.dedup import read_failures
from integrations.failures import signature
from test_gateway import GatewayTestCase, request_body
from fixtures.fake_claude import FAKE_CANARY

ROOT = Path(__file__).resolve().parents[2]


def v11(request_id, **overrides):
    body = request_body(request_id=request_id, **overrides)
    body.update(protocol_version="1.1", allow_unenforced_output_limit=True)
    return body


class FailureClassificationTests(GatewayTestCase):
    def setUp(self):
        super().setUp()
        self.log = io.StringIO()
        handler = logging.StreamHandler(self.log)
        logging.getLogger("integrations").addHandler(handler)
        self.addCleanup(logging.getLogger("integrations").removeHandler, handler)

    def fail_with(self, mode, request_id, **overrides):
        self.set_mode(FAKE_CLAUDE_MODE=mode)
        response = self.client.post("/v1.1/generate", json=v11(request_id, **overrides))
        rows = read_failures(self.settings.db_path, 1)
        return response, rows[0] if rows else None

    def assert_sanitized(self, response, row):
        stored = json.dumps(read_failures(self.settings.db_path, 50))
        for text in (response.text, stored, self.log.getvalue()):
            self.assertNotIn(FAKE_CANARY, text)
            self.assertNotIn("Texto da fonte", text)       # source content
            self.assertNotIn("Explique o conteúdo", text)  # instruction

    def test_output_limit_turn_is_provider_error_with_known_category(self):
        """Hypothesis for the panel's provider_error at limit 128: 2.1.322 turns a
        reply cut at max_tokens into an "API Error" turn without the partial text."""
        response, row = self.fail_with("output_limit_error", "lim:0", max_output_tokens=128)
        self.assertEqual(response.status_code, 502)
        self.assertEqual(response.json()["error"]["code"], "provider_error")  # code the backend accepts today
        self.assertEqual(row["category"], "output_limit_reached")
        self.assertEqual((row["stage"], row["stop_reason"], row["api_error"]),
                         ("result_error", "max_tokens", "max_output_tokens"))
        self.assertEqual((row["request_id"], row["model_requested"], row["returncode"]), ("lim:0", "sonnet", 1))
        self.assert_sanitized(response, row)
        # Not masked as success, not re-run: the repeat replays the stored error.
        again = self.client.post("/v1.1/generate", json=v11("lim:0", max_output_tokens=128))
        self.assertEqual(again.json()["error"]["code"], "provider_error")
        self.assertEqual(self.runner.generations, 1)

    def test_error_subtype_without_result_reads_errors_list(self):
        response, row = self.fail_with("execution_error", "ex:0")
        self.assertEqual(response.json()["error"]["code"], "provider_error")
        self.assertEqual((row["result_subtype"], row["has_result_text"], row["errors_count"], row["category"]),
                         ("error_during_execution", False, 1, "none"))
        self.assert_sanitized(response, row)
        # Before this change the `errors` list was ignored and auth looked generic.
        response, row = self.fail_with("execution_error_auth", "ex:1")
        self.assertEqual(response.json()["error"]["code"], "provider_not_authenticated")
        self.assert_sanitized(response, row)

    def test_api_errors_keep_status_number_only(self):
        response, row = self.fail_with("api_400", "api:0")
        self.assertEqual(response.json()["error"]["code"], "provider_error")
        self.assertEqual((row["api_status"], row["category"]), (400, "api_invalid_request"))
        self.assert_sanitized(response, row)
        response, row = self.fail_with("overloaded", "api:1")
        self.assertEqual(response.json()["error"]["code"], "provider_unavailable")
        self.assertEqual((row["api_status"], row["category"]), (529, "overloaded"))
        self.assert_sanitized(response, row)

    def test_nonzero_exit_is_not_masked_as_success(self):
        response, row = self.fail_with("exit_nonzero_with_result", "exit:0")
        self.assertEqual(response.json()["error"]["code"], "provider_error")
        self.assertEqual((row["returncode"], row["is_error"], row["has_result_text"]), (1, False, True))

    def test_invalid_json_and_timeout_are_recorded(self):
        response, row = self.fail_with("garbage", "bad:0")
        self.assertEqual((response.json()["error"]["code"], row["stage"]), ("provider_invalid_output", "parse_json"))
        self.make_client(timeout_s=5)
        response, row = self.fail_with("sleep", "slow:0")
        self.assertEqual((response.json()["error"]["code"], row["stage"]), ("provider_timeout", "timeout"))
        self.assertEqual(self.client.post("/v1.1/generate", json=v11("slow:0")).status_code, 409)

    def test_success_records_nothing(self):
        self.assertEqual(self.client.post("/v1.1/generate", json=v11("ok:0")).status_code, 200)
        self.assertEqual(read_failures(self.settings.db_path), [])

    def test_failures_command_is_read_only_and_safe_while_running(self):
        self.fail_with("execution_error", "cmd:0")
        from integrations.dedup import DedupStore
        DedupStore(self.settings.db_path).reserve("running:0", "x" * 64)
        result = subprocess.run(
            [sys.executable, "-m", "integrations", "failures", "--limit", "3"], cwd=ROOT,
            env={**os.environ, "IA_BBARU_GATEWAY_DB": str(self.settings.db_path)},
            capture_output=True, text=True, encoding="utf-8", timeout=60)
        self.assertEqual(result.returncode, 0, result.stderr)
        rows = json.loads(result.stdout)
        self.assertEqual(rows[0]["request_id"], "cmd:0")
        self.assertNotIn(FAKE_CANARY, result.stdout)
        # The running row was not turned into "uncertain" by the read.
        import sqlite3
        from contextlib import closing
        with closing(sqlite3.connect(self.settings.db_path)) as conn:
            state = conn.execute("SELECT state FROM generate_requests WHERE request_id='running:0'").fetchone()[0]
        self.assertEqual(state, "running")

    def test_signature_rejects_free_text_in_identifier_fields(self):
        sig = signature("result_error", model="sonnet", data={
            "is_error": True, "subtype": "Texto livre!", "api_error": "Erro com espaço",
            "terminal_reason": "a" * 80, "stop_reason": "qualquer", "result": FAKE_CANARY,
            "modelUsage": {FAKE_CANARY: {}, "claude-sonnet-5-5": {}}})
        self.assertEqual((sig["result_subtype"], sig["api_error"], sig["terminal_reason"], sig["stop_reason"]),
                         ("other", "other", "other", "other"))
        self.assertEqual(sig["served_models"], ["claude-sonnet-5-5"])
        self.assertNotIn(FAKE_CANARY, json.dumps(sig))
