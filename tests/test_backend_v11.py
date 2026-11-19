"""Capabilities policy tests: fixtures only, no provider credentials or generation."""
import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch
from uuid import uuid4

import httpx
from fastapi.testclient import TestClient
from pydantic import ValidationError

from backend.contracts import GenerateRequest, GenerateResponse, ModelCatalog
from backend.contracts_v1_1 import (
    GenerateRequestV11, GenerateResponseV11, ModelCatalogV11, ModelProfileV11,
)
from backend.gateway import GatewayUnavailable, HttpGateway
from backend.main import create_app
from docs.export_contracts import gateway_v11_schema
from native_host.bridge import Bridge

TOKEN = "test-only-backend-v11-not-a-secret-0123456789"


def profile(name, limit="best_effort"):
    return {"id": f"test:{name}", "provider": "test", "label": name,
            "available": True, "task_kinds": ["study"],
            "context_char_limit": 80000, "max_output_tokens": 4096,
            "capabilities": {"output_limit": limit, "cancellation": "local_process_only",
                             "finish_reason": "reported", "billing": "subscription_quota",
                             "streaming": False, "tools": "disabled"},
            "unavailable_reason": None}


class FixtureGateway:
    def __init__(self):
        self.models = [profile("writer"), profile("reviewer")]
        self.calls = []
        self.finish_reason = "stop"
        self.fail_catalog = False
        self.after_generation = lambda: None

    def catalog(self):
        if self.fail_catalog:
            raise GatewayUnavailable("fixture_offline")
        return ModelCatalogV11(models=self.models)

    def generate(self, request):
        self.calls.append(request)
        self.after_generation()
        return GenerateResponseV11(request_id=request.request_id, model_id=request.model_id,
                                   output="Saída preservada com acentuação", finish_reason=self.finish_reason)


class BackendV11Tests(unittest.TestCase):
    def setUp(self):
        self.directory = tempfile.TemporaryDirectory()
        self.addCleanup(self.directory.cleanup)
        self.db = Path(self.directory.name) / "backend.sqlite3"
        self.gateway = FixtureGateway()
        self.app = create_app(self.db, TOKEN, self.gateway)
        self.client = self.enterContext(TestClient(self.app, headers={"Authorization": f"Bearer {TOKEN}"}))
        self.project = self.client.post("/v1/projects", json={"title": "Estudos"}).json()

    def plan(self, **overrides):
        body = {"instruction": "Explique", "kind": "study", "mode": "review",
                "allowed_model_ids": ["test:writer", "test:reviewer"]}
        body.update(overrides)
        return self.client.post(f"/v1/projects/{self.project['id']}/tasks", json=body)

    def accepted_plan(self):
        result = self.plan(allow_unenforced_output_limit=True)
        self.assertEqual(result.status_code, 201, result.text)
        return result.json()

    def execute(self, task):
        response = self.client.post(f"/v1/tasks/{task['id']}/execute")
        self.assertEqual(response.status_code, 200, response.text)
        return response.json()

    def test_default_denies_indicative_limits_without_generation(self):
        for limit in ("best_effort", "none"):
            with self.subTest(limit=limit):
                for model in self.gateway.models:
                    model["capabilities"]["output_limit"] = limit
                response = self.plan()
                self.assertEqual(response.status_code, 422)
                self.assertEqual(response.json()["detail"], "output_limit_not_accepted")
        self.assertEqual(self.gateway.calls, [])

    def test_acceptance_requires_a_json_boolean(self):
        for value in ("true", 1, None):
            self.assertEqual(self.plan(allow_unenforced_output_limit=value).status_code, 422)

    def test_acceptance_and_capabilities_survive_restart_and_reach_both_steps(self):
        task = self.accepted_plan()
        self.assertTrue(task["allow_unenforced_output_limit"])
        self.assertEqual(task["gateway_protocol_version"], "1.1")
        self.assertEqual(task["plan"][0]["capabilities"], self.gateway.models[0]["capabilities"])
        with TestClient(create_app(self.db, TOKEN, self.gateway),
                        headers={"Authorization": f"Bearer {TOKEN}"}) as restarted:
            stored = restarted.get(f"/v1/tasks/{task['id']}").json()
            self.assertEqual(stored, task)
            result = restarted.post(f"/v1/tasks/{task['id']}/execute").json()
        self.assertEqual(result["status"], "completed")
        self.assertEqual(len(self.gateway.calls), 2)
        for request in self.gateway.calls:
            self.assertIsInstance(request, GenerateRequestV11)
            self.assertTrue(request.allow_unenforced_output_limit)
            self.assertEqual(request.protocol_version, "1.1")
        self.assertEqual(self.gateway.calls[1].previous_output, result["results"][0]["output"])

    def test_unknown_preserves_output_and_stops_review_without_retry(self):
        self.gateway.finish_reason = "unknown"
        task = self.accepted_plan()
        result = self.execute(task)
        self.assertEqual((result["status"], result["error"]), ("incomplete", "completion_unconfirmed"))
        self.assertEqual(result["output"], "Saída preservada com acentuação")
        self.assertEqual(result["results"][0]["finish_reason"], "unknown")
        self.assertNotIn("completed_at", result)
        self.assertEqual(self.client.get(f"/v1/tasks/{task['id']}").json(), result)
        self.assertEqual(self.client.post(f"/v1/tasks/{task['id']}/execute").status_code, 409)
        self.assertEqual(len(self.gateway.calls), 1)

    def test_reported_length_preserves_partial_without_review(self):
        self.gateway.finish_reason = "length"
        result = self.execute(self.accepted_plan())
        self.assertEqual((result["status"], result["error"]), ("incomplete", "output_token_limit_reached"))
        self.assertEqual(result["output"], result["results"][0]["output"])
        self.assertEqual(len(self.gateway.calls), 1)

    def test_enforced_limit_works_without_acceptance(self):
        for model in self.gateway.models:
            model["capabilities"]["output_limit"] = "enforced"
        task = self.plan().json()
        self.assertFalse(task["allow_unenforced_output_limit"])
        self.assertEqual(self.execute(task)["status"], "completed")
        self.assertTrue(all(not request.allow_unenforced_output_limit for request in self.gateway.calls))

    def test_explicit_ineligible_choice_does_not_fall_back(self):
        self.gateway.models[1]["capabilities"]["output_limit"] = "enforced"
        response = self.plan(mode="single", preferred_model_id="test:writer")
        self.assertEqual(response.status_code, 422)
        self.assertEqual(response.json()["detail"], "output_limit_not_accepted")
        # Automatic ranking may choose another model the user allowed.
        task = self.plan(mode="single").json()
        self.assertEqual(task["plan"][0]["model_id"], "test:reviewer")

    def test_restricted_tools_are_never_enabled_by_output_acceptance(self):
        self.gateway.models[0]["capabilities"]["tools"] = "restricted"
        response = self.plan(allow_unenforced_output_limit=True, preferred_model_id="test:writer")
        self.assertEqual(response.status_code, 422)
        self.assertEqual(response.json()["detail"], "model_tools_not_supported")
        self.assertEqual(self.gateway.calls, [])

    def test_changed_guarantees_block_before_any_provider_call(self):
        changes = [("output_limit", "none"), ("cancellation", "none"),
                   ("finish_reason", "inferred"), ("billing", "api_key"), ("tools", "restricted")]
        for key, value in changes:
            with self.subTest(capability=key):
                self.gateway.models = [profile("writer"), profile("reviewer")]
                task = self.accepted_plan()
                self.gateway.models[1]["capabilities"][key] = value
                result = self.execute(task)
                self.assertEqual(result["status"], "failed")
                self.assertIn(result["error"], {"model_capabilities_changed_replan_required", "model_tools_not_supported"})
                self.assertEqual(self.gateway.calls, [])

    def test_removed_model_and_reduced_limits_require_replanning(self):
        for key, value in (("available", False), ("context_char_limit", 40000),
                           ("max_output_tokens", 100), ("provider", "another-provider")):
            with self.subTest(field=key):
                self.gateway.models = [profile("writer"), profile("reviewer")]
                task = self.accepted_plan()
                self.gateway.models[1][key] = value
                self.assertEqual(self.execute(task)["status"], "failed")
                self.assertEqual(self.gateway.calls, [])

    def test_changed_reviewer_after_first_response_does_not_consume_second_call(self):
        def change():
            self.gateway.models[1]["capabilities"]["billing"] = "api_key"
        self.gateway.after_generation = change
        result = self.execute(self.accepted_plan())
        self.assertEqual(result["error"], "model_capabilities_changed_replan_required")
        self.assertEqual(result["output"], result["results"][0]["output"])
        self.assertEqual(len(self.gateway.calls), 1)

    def test_missing_stored_acceptance_is_false(self):
        task = self.accepted_plan()
        del task["allow_unenforced_output_limit"]
        self.app.state.store.save_task(task)
        self.assertEqual(self.execute(task)["error"], "output_limit_not_accepted")
        self.assertEqual(self.gateway.calls, [])

    def test_legacy_task_is_not_implicitly_upgraded(self):
        task = self.accepted_plan()
        del task["gateway_protocol_version"]
        self.app.state.store.save_task(task)
        self.assertEqual(self.execute(task)["error"], "gateway_protocol_changed_replan_required")
        self.assertEqual(self.gateway.calls, [])

    def test_old_v1_task_without_new_metadata_still_executes_as_v1(self):
        class LegacyGateway(FixtureGateway):
            def catalog(self):
                return ModelCatalog(models=[{key: value for key, value in model.items()
                                             if key not in {"capabilities", "unavailable_reason"}}
                                            for model in self.models])

            def generate(self, request):
                self.calls.append(request)
                return GenerateResponse(request_id=request.request_id, model_id=request.model_id,
                                        output="Legacy response", finish_reason="stop")

        legacy = LegacyGateway()
        app = create_app(self.db, TOKEN, legacy)
        with TestClient(app, headers={"Authorization": f"Bearer {TOKEN}"}) as client:
            task = client.post(f"/v1/projects/{self.project['id']}/tasks", json={
                "instruction": "Explain", "allowed_model_ids": ["test:writer"]}).json()
            del task["gateway_protocol_version"]
            del task["allow_unenforced_output_limit"]
            del task["plan"][0]["capabilities"]
            del task["plan"][0]["provider"]
            app.state.store.save_task(task)
            result = client.post(f"/v1/tasks/{task['id']}/execute").json()
            self.assertEqual(result["status"], "completed")
            self.assertIsInstance(legacy.calls[0], GenerateRequest)
            self.assertNotIn("allow_unenforced_output_limit", legacy.calls[0].model_dump())

    def test_offline_preflight_never_calls_generate(self):
        task = self.accepted_plan()
        self.gateway.fail_catalog = True
        self.assertEqual(self.execute(task)["error"], "gateway_preflight_failed")
        self.assertEqual(self.gateway.calls, [])

    def test_native_planning_forwards_acceptance_but_still_refuses_execution(self):
        bridge = Bridge(self.client)
        body = {"protocol_version": "0", "request_id": str(uuid4()), "operation": "tasks.plan",
                "params": {"project_id": self.project["id"], "task": {
                    "instruction": "Explique", "allowed_model_ids": ["test:writer"],
                    "allow_unenforced_output_limit": True}}}
        planned = bridge.handle(body)
        self.assertTrue(planned["ok"], planned)
        self.assertTrue(planned["data"]["allow_unenforced_output_limit"])
        body.update(operation="tasks.execute", params={"task_id": planned["data"]["id"]})
        self.assertEqual(bridge.handle(body)["error"]["code"], "unsupported_operation")
        self.assertEqual(self.gateway.calls, [])


class ContractV11Tests(unittest.TestCase):
    def test_schemas_and_paths_match_pinned_claude_gateway(self):
        fixture = Path(__file__).parent / "fixtures/gateway-1.1-b4b2dcc.json"
        reference = json.loads(fixture.read_text(encoding="utf-8"))
        current = gateway_v11_schema()
        self.assertEqual(current["components"], reference["components"])
        self.assertEqual(current["paths"], reference["paths"])
        published = Path(__file__).parents[1] / "docs/openapi-gateway-1.1.json"
        self.assertEqual(current, json.loads(published.read_text(encoding="utf-8")))

    def test_capabilities_required_and_unavailable_reason_limit(self):
        model = profile("writer")
        model["unavailable_reason"] = "x" * 80
        ModelProfileV11.model_validate(model)
        model["unavailable_reason"] += "x"
        with self.assertRaises(ValidationError):
            ModelProfileV11.model_validate(model)
        model = profile("writer")
        del model["capabilities"]
        with self.assertRaises(ValidationError):
            ModelProfileV11.model_validate(model)
        with self.assertRaises(ValidationError):
            ModelCatalogV11(models=[profile("writer"), profile("writer")])
        with self.assertRaises(ValidationError):
            ModelCatalog.model_validate(ModelCatalogV11(models=[profile("writer")]).model_dump())

    def test_generation_limits_and_default_acceptance(self):
        fields = dict(protocol_version="1.1", request_id="task:0", model_id="test:writer",
                      role="answer", instruction="Explique", context=[])
        for limit in (1, 4096):
            self.assertFalse(GenerateRequestV11(**fields, max_output_tokens=limit).allow_unenforced_output_limit)
        for limit in (0, 4097):
            with self.assertRaises(ValidationError):
                GenerateRequestV11(**fields, max_output_tokens=limit)


class HttpGatewayV11Tests(unittest.TestCase):
    def test_catalog_filters_out_non_claude_providers(self):
        gateway = HttpGateway("http://localhost:8010", "fixture", "1.1")
        claude = {**profile("writer"), "id": "claude-code:sonnet", "provider": "claude-code"}
        raw = ModelCatalogV11(models=[profile("retired"), claude]).model_dump()
        with patch.object(gateway, "_request", return_value=raw):
            self.assertEqual([m.id for m in gateway.catalog().models], ["claude-code:sonnet"])

    def request(self):
        return GenerateRequestV11(protocol_version="1.1", request_id="task:0", model_id="test:writer",
                                  role="answer", instruction="Explique", context=[], max_output_tokens=100,
                                  allow_unenforced_output_limit=True)

    def test_routes_and_unknown_response(self):
        gateway = HttpGateway("http://127.0.0.1:8010", "test", "1.1")
        with patch.object(gateway, "_request", return_value=ModelCatalogV11(models=[profile("writer")]).model_dump()) as call:
            self.assertEqual(gateway.catalog().protocol_version, "1.1")
            call.assert_called_once_with("GET", "/v1.1/models")
        request = self.request()
        response = GenerateResponseV11(request_id=request.request_id, model_id=request.model_id,
                                       output="Parcial", finish_reason="unknown").model_dump()
        with patch.object(gateway, "_request", return_value=response) as call:
            self.assertEqual(gateway.generate(request).finish_reason, "unknown")
            call.assert_called_once_with("POST", "/v1.1/generate", request.model_dump())

    def test_mismatched_versions_or_response_identity_are_rejected(self):
        gateway = HttpGateway("http://localhost:8010", "test", "1.1")
        with patch.object(gateway, "_request", return_value={"protocol_version": "1", "models": []}):
            with self.assertRaises(GatewayUnavailable):
                gateway.catalog()
        response = GenerateResponseV11(request_id="task:0", model_id="test:writer", output="Text", finish_reason="stop").model_dump()
        for changed in ({"protocol_version": "1"}, {"request_id": "wrong"}, {"model_id": "wrong"}):
            with self.subTest(changed=changed), patch.object(gateway, "_request", return_value={**response, **changed}):
                with self.assertRaises(GatewayUnavailable):
                    gateway.generate(self.request())
        old_request = GenerateRequest(request_id="task:0", model_id="test:writer", role="answer",
                                      instruction="Explain", context=[], max_output_tokens=100)
        with patch.object(gateway, "_request") as call:
            with self.assertRaises(GatewayUnavailable):
                gateway.generate(old_request)
            call.assert_not_called()

    def test_timeout_and_missing_endpoint_do_not_retry_or_fall_back(self):
        gateway = HttpGateway("http://localhost:8010", "test", "1.1")
        for error in (httpx.ReadTimeout("timeout"),
                      httpx.HTTPStatusError("not found", request=httpx.Request("GET", "http://localhost/v1.1/models"),
                                            response=httpx.Response(404))):
            with self.subTest(error=type(error).__name__), patch("backend.gateway.httpx.Client") as client:
                call = client.return_value.__enter__.return_value.request
                call.side_effect = error
                with self.assertRaises(GatewayUnavailable):
                    gateway.catalog()
                self.assertEqual(call.call_count, 1)
                self.assertIn("/v1.1/models", call.call_args.args[1])

    def test_environment_selects_protocol_and_rejects_unknown_values(self):
        with tempfile.TemporaryDirectory() as folder, patch.dict("os.environ", {"GATEWAY_PROTOCOL_VERSION": "1.1"}):
            with patch("backend.main.HttpGateway", wraps=HttpGateway) as factory:
                create_app(Path(folder) / "db.sqlite3", TOKEN)
                self.assertEqual(factory.call_args.args[2], "1.1")
            with patch.dict("os.environ", {"GATEWAY_PROTOCOL_VERSION": "2"}):
                with self.assertRaises(ValueError):
                    create_app(Path(folder) / "db.sqlite3", TOKEN)
        self.assertEqual(HttpGateway(None, None).protocol_version, "1")


if __name__ == "__main__":
    unittest.main()
