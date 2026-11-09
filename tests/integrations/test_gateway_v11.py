"""Contract 1.1 tests (docs/DECISAO_CAPACIDADES.md). Provider = explicit test double."""
import json
import unittest

from pydantic import ValidationError

from integrations.contracts_v1_1 import (
    GenerateResponseV11, ModelCatalogV11, ModelProfileV11)
from integrations.export_openapi import TARGET, build
from test_gateway import MODEL_ID, GatewayTestCase, request_body


def body_v11(**overrides):
    body = request_body(protocol_version="1.1", allow_unenforced_output_limit=True)
    body.update(overrides)
    return body


class CatalogV11Tests(GatewayTestCase):
    accept_unenforced = False  # the legacy env flag must not matter for 1.1

    def test_catalog_declares_real_capabilities(self):
        response = self.client.get("/v1.1/models")
        self.assertEqual(response.status_code, 200)
        catalog = ModelCatalogV11.model_validate(response.json())
        model = catalog.models[0]
        self.assertEqual(model.id, MODEL_ID)
        self.assertTrue(model.available)
        self.assertIsNone(model.unavailable_reason)
        self.assertEqual(model.capabilities.model_dump(), {
            "output_limit": "best_effort", "cancellation": "local_process_only",
            "finish_reason": "reported", "billing": "subscription_quota",
            "streaming": False, "tools": "disabled",
        })
        self.assertEqual(self.runner.generations, 0)

    def test_legacy_catalog_is_unchanged(self):
        model = self.client.get("/v1/models").json()["models"][0]
        self.assertFalse(model["available"])
        self.assertNotIn("capabilities", model)
        self.assertNotIn("unavailable_reason", model)

    def test_unavailable_reason(self):
        self.set_mode(FAKE_CLAUDE_LOGIN="none")
        model = self.client.get("/v1.1/models").json()["models"][0]
        self.assertFalse(model["available"])
        self.assertEqual(model["unavailable_reason"], "not_logged_in")
        self.set_mode(FAKE_CLAUDE_LOGIN="api_key")
        model = self.client.get("/v1.1/models").json()["models"][0]
        self.assertEqual(model["unavailable_reason"], "not_subscription_login")

    def test_login_change_shows_up_quickly(self):
        from unittest.mock import patch as mock_patch
        from integrations.adapters import claude_code
        self.set_mode(FAKE_CLAUDE_LOGIN="none")
        self.assertFalse(self.client.get("/v1.1/models").json()["models"][0]["available"])
        mock_patch.dict("os.environ", {"FAKE_CLAUDE_LOGIN": "claude.ai"}).start()
        later = claude_code.time.monotonic() + claude_code.STATUS_TTL_NOT_READY_S + 1
        with mock_patch.object(claude_code.time, "monotonic", return_value=later):
            self.assertTrue(self.client.get("/v1.1/models").json()["models"][0]["available"])

    def test_capabilities_are_mandatory(self):
        profile = {"id": "x:y", "provider": "x", "label": "y", "available": True,
                   "task_kinds": ["general"], "context_char_limit": 1000, "max_output_tokens": 10}
        with self.assertRaises(ValidationError):
            ModelProfileV11.model_validate(profile)


class GenerateV11Tests(GatewayTestCase):
    accept_unenforced = False

    def post(self, **overrides):
        return self.client.post("/v1.1/generate", json=body_v11(**overrides))

    def test_acceptance_required_before_provider_starts(self):
        response = self.post(allow_unenforced_output_limit=False)
        self.assertEqual(response.status_code, 422)
        self.assertEqual(response.json()["error"]["code"], "output_limit_not_accepted")
        self.assertEqual(self.runner.generations, 0)
        # The rejection does not burn the request_id.
        self.assertEqual(self.post(request_id="task-1:0").status_code, 200)

    def test_env_flag_does_not_replace_task_acceptance(self):
        self.accept_unenforced = True
        self.make_client()
        self.assertEqual(self.post(allow_unenforced_output_limit=False).status_code, 422)
        self.assertEqual(self.runner.generations, 0)

    def test_success_with_reported_stop(self):
        response = self.post()
        self.assertEqual(response.status_code, 200, response.text)
        result = GenerateResponseV11.model_validate(response.json())
        self.assertEqual(result.protocol_version, "1.1")
        self.assertEqual((result.request_id, result.model_id), ("task-1:0", MODEL_ID))
        self.assertEqual(result.finish_reason, "stop")

    def test_missing_evidence_is_unknown_and_output_kept(self):
        for index, mode in enumerate(("no_stop_reason", "null_stop_reason", "refusal")):
            self.set_mode(FAKE_CLAUDE_MODE=mode)
            response = self.post(request_id=f"task-u{index}:0")
            self.assertEqual(response.status_code, 200, mode)
            self.assertEqual(response.json()["finish_reason"], "unknown")
            self.assertEqual(response.json()["output"], "Resposta do dublê de teste")

    def test_reported_truncation_is_length(self):
        self.set_mode(FAKE_CLAUDE_MODE="max_tokens")
        self.assertEqual(self.post().json()["finish_reason"], "length")

    def test_counts_at_cap_are_not_truncation(self):
        self.assertEqual(self.post(max_output_tokens=42).json()["finish_reason"], "stop")

    def test_accepted_best_effort_cap_is_not_an_error(self):
        self.set_mode(FAKE_CLAUDE_MODE="over_cap")
        response = self.post(max_output_tokens=100)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["usage"]["output_tokens"], 150)

    def test_versions_are_not_mixed(self):
        v1_on_v11 = self.client.post("/v1.1/generate", json=request_body())
        self.assertEqual(v1_on_v11.status_code, 422)
        v11_on_v1 = self.client.post("/v1/generate", json=body_v11())
        self.assertEqual(v11_on_v1.status_code, 422)
        self.assertEqual(self.runner.generations, 0)

    def test_same_request_id_across_versions_conflicts(self):
        self.accept_unenforced = True
        self.make_client()
        self.assertEqual(self.client.post("/v1/generate", json=request_body()).status_code, 200)
        response = self.post()
        self.assertEqual(response.status_code, 409)
        self.assertEqual(response.json()["error"]["code"], "request_id_conflict")
        self.assertEqual(self.runner.generations, 1)

    def test_replay_and_no_rerun_after_unknown(self):
        self.set_mode(FAKE_CLAUDE_MODE="no_stop_reason")
        first = self.post().json()
        self.set_mode(FAKE_CLAUDE_MODE="success")
        self.assertEqual(self.post().json(), first)
        self.assertEqual(self.runner.generations, 1)


class OpenApiV11Tests(unittest.TestCase):
    def test_published_schema_is_current(self):
        published = json.loads(TARGET.read_text(encoding="utf-8"))
        self.assertEqual(published, json.loads(json.dumps(build())),
                         "rode: python -m integrations.export_openapi")


if __name__ == "__main__":
    unittest.main()
