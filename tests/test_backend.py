import tempfile
import unittest
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from unittest.mock import patch

import httpx
from fastapi.testclient import TestClient

from backend.contracts import GenerateRequest, GenerateResponse, ModelCatalog
from backend.gateway import GatewayUnavailable, HttpGateway
from backend.main import create_app


TOKEN = "test-only-token-not-for-deployment-123456789"


class TestGateway:
    """Only used inside tests. Never registered in application startup."""
    def __init__(self):
        self.calls = []
        self.fail_review = False
        self.truncate = False

    def catalog(self):
        return ModelCatalog(models=[{
            "id": f"test:{name}", "provider": "test", "label": name,
            "available": True, "task_kinds": kinds,
            "context_char_limit": 80000, "max_output_tokens": 4096,
        } for name, kinds in [("writer", ["study"]), ("reviewer", ["analysis"])]] )

    def generate(self, request):
        self.calls.append(request)
        if self.fail_review and request.role == "review":
            raise GatewayUnavailable()
        return GenerateResponse(
            request_id=request.request_id, model_id=request.model_id,
            output="Draft from selected material" if request.role == "answer" else "Reviewed answer",
            finish_reason="length" if self.truncate else "stop",
        )


class BackendTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.db = Path(self.tmp.name) / "test.sqlite3"
        self.gateway = TestGateway()
        self.app = create_app(self.db, TOKEN, self.gateway)
        self.client = TestClient(self.app, headers={"Authorization": f"Bearer {TOKEN}"})
        self.client.__enter__()
        self.project = self.client.post("/v1/projects", json={"title": "Faculdade"}).json()

    def tearDown(self):
        self.client.__exit__(None, None, None)
        self.tmp.cleanup()

    def plan(self, **overrides):
        data = {"instruction": "Explique este assunto", "kind": "study",
                "allowed_model_ids": ["test:reviewer", "test:writer"]}
        data.update(overrides)
        return self.client.post(f"/v1/projects/{self.project['id']}/tasks", json=data)

    def source(self, content="Course material"):
        return self.client.post(f"/v1/projects/{self.project['id']}/sources",
                                json={"title": "Aula 1", "content": content}).json()

    def test_authentication_required(self):
        self.assertEqual(self.client.get("/v1/projects", headers={"Authorization": "Bearer wrong"}).status_code, 401)
        self.assertEqual(self.client.get("/health").status_code, 200)

    def test_missing_secret_refuses_startup(self):
        with self.assertRaises(RuntimeError):
            with TestClient(create_app(Path(self.tmp.name) / "other.db", "", self.gateway)):
                pass

    def test_unconfigured_gateway_does_not_fake_execution(self):
        with TestClient(create_app(Path(self.tmp.name) / "other.db", TOKEN, HttpGateway(None, None)),
                        headers={"Authorization": f"Bearer {TOKEN}"}) as client:
            self.assertEqual(client.get("/v1/models").status_code, 503)

    def test_source_from_another_project_is_rejected(self):
        source = self.source()
        other = self.client.post("/v1/projects", json={"title": "Other"}).json()
        response = self.client.post(f"/v1/projects/{other['id']}/tasks", json={
            "instruction": "Summarize", "allowed_model_ids": ["test:writer"], "source_ids": [source["id"]]})
        self.assertEqual(response.status_code, 422)
        self.assertEqual(response.json()["detail"], "source_not_in_project")

    def test_routing_and_explicit_override(self):
        self.assertEqual(self.plan().json()["plan"][0]["model_id"], "test:writer")
        self.assertEqual(self.plan(preferred_model_id="test:reviewer").json()["plan"][0]["model_id"], "test:reviewer")
        self.assertEqual(self.plan(preferred_model_id="test:forbidden").status_code, 422)
        self.assertEqual(self.gateway.calls, [])

    def test_review_passes_only_selected_sources_and_previous_answer(self):
        selected = self.source("Selected material")
        self.source("Private unrelated material")
        task = self.plan(mode="review", source_ids=[selected["id"]]).json()
        response = self.client.post(f"/v1/tasks/{task['id']}/execute")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["status"], "completed")
        self.assertEqual(response.json()["output"], "Reviewed answer")
        self.assertEqual(len(self.gateway.calls), 2)
        self.assertEqual(self.gateway.calls[1].previous_output, "Draft from selected material")
        self.assertEqual([s.content for s in self.gateway.calls[1].context], ["Selected material"])
        self.assertEqual(self.client.post(f"/v1/tasks/{task['id']}/execute").status_code, 409)
        self.assertEqual(len(self.gateway.calls), 2)

    def test_failed_review_preserves_first_result_and_cannot_retry(self):
        self.gateway.fail_review = True
        task = self.plan(mode="review").json()
        result = self.client.post(f"/v1/tasks/{task['id']}/execute").json()
        self.assertEqual(result["status"], "failed")
        self.assertEqual(len(result["results"]), 1)
        self.assertIsNone(result["output"])
        self.assertEqual(self.client.post(f"/v1/tasks/{task['id']}/execute").status_code, 409)

    def test_truncated_answer_does_not_run_reviewer(self):
        self.gateway.truncate = True
        task = self.plan(mode="review").json()
        result = self.client.post(f"/v1/tasks/{task['id']}/execute").json()
        self.assertEqual(result["status"], "incomplete")
        self.assertEqual(len(self.gateway.calls), 1)

    def test_claim_is_atomic(self):
        task = self.plan().json()
        with ThreadPoolExecutor(max_workers=4) as pool:
            results = list(pool.map(lambda _: self.app.state.store.claim(task["id"]), range(4)))
        self.assertEqual(sum(result is not None for result in results), 1)

    def test_restart_preserves_data_and_does_not_repeat_uncertain_call(self):
        task = self.plan().json()
        self.app.state.store.claim(task["id"])
        restarted = create_app(self.db, TOKEN, self.gateway)
        with TestClient(restarted, headers={"Authorization": f"Bearer {TOKEN}"}) as client:
            result = client.get(f"/v1/tasks/{task['id']}").json()
            self.assertEqual(result["status"], "interrupted")
            self.assertEqual(client.post(f"/v1/tasks/{task['id']}/execute").status_code, 409)
            self.assertEqual(len(client.get("/v1/projects").json()["items"]), 1)
        self.assertEqual(self.gateway.calls, [])

    def test_review_requires_two_allowed_models(self):
        self.assertEqual(self.plan(mode="review", allowed_model_ids=["test:writer"]).status_code, 422)

    def test_context_limit_rejected_before_generation(self):
        first = self.source("a" * 40000)
        second = self.source("b" * 40000)
        self.assertEqual(self.plan(source_ids=[first["id"], second["id"]]).status_code, 422)
        self.assertEqual(self.gateway.calls, [])


class HttpGatewayTests(unittest.TestCase):
    def test_rejects_mismatched_response(self):
        gateway = HttpGateway("http://localhost:8010", "test")
        request = GenerateRequest(request_id="task:0", model_id="test:writer", role="answer",
                                  instruction="Explain", context=[], max_output_tokens=100)
        with patch.object(gateway, "_request", return_value={
            "request_id": "another-task:0", "model_id": "test:writer",
            "output": "Wrong task", "finish_reason": "stop"
        }):
            with self.assertRaises(GatewayUnavailable):
                gateway.generate(request)

    def test_timeout_is_not_retried(self):
        gateway = HttpGateway("http://localhost:8010", "test")
        with patch("backend.gateway.httpx.Client") as client:
            request = client.return_value.__enter__.return_value.request
            request.side_effect = httpx.ReadTimeout("timeout")
            with self.assertRaises(GatewayUnavailable):
                gateway.catalog()
            self.assertEqual(request.call_count, 1)


if __name__ == "__main__":
    unittest.main()
