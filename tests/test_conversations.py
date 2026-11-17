"""Persistent chat behavior with deterministic fixtures; no account/model calls."""
from concurrent.futures import ThreadPoolExecutor
import json
import tempfile
import time
import unittest
from pathlib import Path
from uuid import uuid4

from fastapi.testclient import TestClient
from backend.contracts_v1_2 import GenerateResponseV12, ModelCatalogV12
from backend.gateway import GatewayUnavailable
from backend.main import create_app
from native_host.bridge import Bridge
from test_backend_v11 import TOKEN, profile


class ChatGateway:
    def __init__(self):
        self.models = []
        for family in ("sonnet", "haiku", "opus", "fable"):
            item = profile(family)
            item.update(id=f"claude-code:{family}", provider="claude-code")
            self.models.append(item)
        self.calls, self.finish, self.failure = [], "stop", None
        self.output = "Primeiro ponto: laranja. Segundo ponto: manga."

    def catalog(self):
        return ModelCatalogV12(models=self.models)

    def generate(self, request):
        self.calls.append(request)
        if self.failure:
            raise GatewayUnavailable(self.failure, 429)
        return GenerateResponseV12(request_id=request.request_id, model_id=request.model_id,
            output=self.output, finish_reason=self.finish, served_model="claude-sonnet-5-5")


class ConversationTests(unittest.TestCase):
    def setUp(self):
        temp = tempfile.TemporaryDirectory()
        self.addCleanup(temp.cleanup)
        self.db = Path(temp.name) / "chat.sqlite3"
        self.gateway = ChatGateway()
        self.app = create_app(self.db, TOKEN, self.gateway, durable_execution=True)
        self.client = self.enterContext(TestClient(self.app, headers={"Authorization": f"Bearer {TOKEN}"}))
        self.worker = self.app.state.worker
        self.worker.stop(); self.worker.stop_event.clear()
        self.store = self.app.state.store
        self.cid = self.create()["id"]

    def create(self, **values):
        data = {"conversation_id": str(uuid4()), **values}
        response = self.client.post("/v1/conversations", json=data)
        self.assertEqual(response.status_code, 201, response.text)
        return response.json()

    def body(self, **values):
        return {"turn_id": str(uuid4()), "instruction": "Explique os pontos", "confirmed": True,
                "allow_unenforced_output_limit": True, "allowed_model_ids": ["claude-code:sonnet"], **values}

    def send(self, data=None, cid=None, **values):
        return self.client.post(f"/v1/conversations/{cid or self.cid}/turns", json=data or self.body(**values))

    def process(self):
        task = self.store.claim_job(time.time())
        self.assertIsNotNone(task)
        self.worker.process(task)
        return self.store.task(task["id"])

    def consent(self, **values):
        response = self.client.post(f"/v1/conversations/{self.cid}/consent", json={
            "policy_version": "1", "confirmed": True, "allow_unenforced_output_limit": True,
            "allowed_model_ids": ["claude-code:sonnet"], **values})
        self.assertEqual(response.status_code, 201, response.text)
        return response.json()["consent"]["id"]

    def test_implicit_project_and_creation_replay(self):
        cid = str(uuid4())
        first = self.create(conversation_id=cid)
        self.assertEqual(self.create(conversation_id=cid), first)
        self.assertEqual(self.client.post("/v1/conversations", json={"conversation_id": cid, "title": "changed"}).status_code, 409)
        self.assertEqual(len(self.client.get("/v1/projects").json()["items"]), 2)
        self.assertEqual(self.gateway.calls, [])

    def test_send_replay_conflict_busy_and_single_generation(self):
        body = self.body()
        first = self.send(body)
        self.assertEqual(first.status_code, 202, first.text)
        self.assertEqual(first.json()["task"]["status"], "queued")
        self.assertEqual(self.send(body).json()["id"], first.json()["id"])
        self.assertEqual(self.send({**body, "instruction": "different"}).json()["detail"], "turn_id_conflict")
        self.assertEqual(self.send().json()["detail"], "conversation_busy")
        final = self.process()
        self.assertEqual(final["status"], "completed")
        self.assertEqual(self.send(body).json()["task"]["status"], "completed")
        self.assertEqual(len(self.gateway.calls), 1)
        self.assertEqual(final["results"][0]["served_model"], "claude-sonnet-5-5")
        self.assertGreaterEqual(final["execution"]["steps"][0]["duration_ms"], 0)
        self.assertEqual(len(final["execution"]["steps"][0]["request_fingerprint"]), 16)
        self.assertEqual(final["plan"][0]["max_output_tokens"], 2048)

    def test_concurrent_duplicate_is_one_turn(self):
        body = self.body()
        with ThreadPoolExecutor(max_workers=2) as pool:
            responses = list(pool.map(lambda _: self.send(body), range(2)))
        self.assertEqual([r.status_code for r in responses], [202, 202])
        self.assertEqual(responses[0].json()["task_id"], responses[1].json()["task_id"])
        self.process()
        self.assertEqual(len(self.gateway.calls), 1)

    def test_snapshots_and_followup_survive_restart_without_library_pollution(self):
        snap = {"capture_id": str(uuid4()), "kind": "page", "title": "Aula", "content": "Texto ORIGINAL",
                "url": "https://example.org/aula", "document_id": "tab:1", "captured_at": "2026-11-16T12:00:00Z"}
        first = self.send(snapshots=[snap]).json()
        self.process()
        project = self.client.get(f"/v1/conversations/{self.cid}").json()["project_id"]
        self.assertEqual(self.client.get(f"/v1/projects/{project}/sources").json()["items"], [])
        restarted = create_app(self.db, TOKEN, self.gateway, durable_execution=True)
        client = TestClient(restarted, headers={"Authorization": f"Bearer {TOKEN}"})
        self.addCleanup(client.close)
        response = client.post(f"/v1/conversations/{self.cid}/turns", json=self.body(instruction="Explique melhor o segundo ponto"))
        self.assertEqual(response.status_code, 202, response.text)
        self.process()
        history = json.loads(self.gateway.calls[-1].context[0].content)
        self.assertEqual(history[0]["turn_id"], first["id"])
        self.assertIn("manga", history[0]["output"])
        self.assertEqual(history[0]["sources"][0]["content"], "Texto ORIGINAL")
        self.assertEqual(client.get(f"/v1/conversations/{self.cid}/turns").json()["items"][0]["sequence"], 1)
        other = self.create()["id"]
        self.send(cid=other)
        self.process()
        self.assertEqual(self.gateway.calls[-1].context, [])
        self.assertEqual(client.get(f"/v1/conversations/{other}/turns/{first['id']}").status_code, 404)

    def test_authorization_defaults_strictness_scope_and_revocation(self):
        for fields in ({"confirmed": False}, {"confirmed": "true"}, {"allow_unenforced_output_limit": False}):
            self.assertEqual(self.send(**fields).status_code, 422)
        self.assertEqual(self.gateway.calls, [])
        consent = self.consent()
        self.assertEqual(self.send(consent_id=consent, confirmed=False, max_output_tokens=4096).json()["detail"], "conversation_consent_scope_changed")
        pending = self.send(consent_id=consent, confirmed=False, allow_unenforced_output_limit=False)
        self.assertEqual(pending.status_code, 202, pending.text)
        self.assertTrue(pending.json()["task"]["allow_unenforced_output_limit"])
        self.client.delete(f"/v1/conversations/{self.cid}/consent")
        self.assertEqual(self.process()["error"], "conversation_consent_revoked")
        self.assertEqual(self.gateway.calls, [])
        self.assertEqual(self.send(consent_id=consent, confirmed=False).status_code, 422)

    def test_changed_guarantees_require_new_consent(self):
        consent = self.consent()
        self.gateway.models[0]["capabilities"]["billing"] = "api_key"
        response = self.send(consent_id=consent, confirmed=False)
        self.assertEqual(response.json()["detail"], "conversation_consent_scope_changed")
        self.assertEqual(self.gateway.calls, [])

    def test_revocation_cannot_claim_an_in_progress_generation_was_cancelled(self):
        consent = self.consent()
        self.gateway.failure = "request_in_progress"
        self.send(consent_id=consent, confirmed=False)
        waiting = self.process()
        self.assertEqual(waiting["status"], "waiting")
        self.client.delete(f"/v1/conversations/{self.cid}/consent")
        # Make only the retry due; it must stop before another provider call.
        waiting["execution"]["steps"][0]["next_attempt_at"] = 0
        self.app.state.store.save_task(waiting)
        self.assertEqual(self.process()["status"], "uncertain")
        self.assertEqual(len(self.gateway.calls), 1)

    def test_quota_and_unknown_are_preserved_without_automatic_review_or_retry(self):
        self.gateway.failure = "provider_quota_exceeded"
        body = self.body()
        self.send(body)
        self.assertEqual(self.process()["error"], "provider_quota_exceeded")
        self.send(body)
        self.assertEqual(len(self.gateway.calls), 1)
        self.gateway.failure, self.gateway.finish = None, "unknown"
        self.send(mode="review", allowed_model_ids=["claude-code:sonnet", "claude-code:opus"])
        final = self.process()
        self.assertEqual(final["status"], "incomplete")
        self.assertEqual(len(self.gateway.calls), 2)
        self.assertIsNone(self.store.claim_job(time.time()))

    def test_context_limit_and_foreign_sources_do_not_create_turns(self):
        other = self.create()
        source = self.client.post(f"/v1/projects/{other['project_id']}/sources", json={"title": "Private", "content": "foreign"}).json()
        self.assertEqual(self.send(source_ids=[source["id"]]).json()["detail"], "source_not_in_project")
        self.gateway.output = "x" * 100000
        self.send(); self.process()
        self.assertEqual(self.send().json()["detail"], "context_too_large")
        self.assertEqual(len(self.client.get(f"/v1/conversations/{self.cid}/turns").json()["items"]), 1)
        self.assertEqual(len(self.gateway.calls), 1)

    def test_fable_and_lower_reviewer_require_explicit_choices(self):
        response = self.send(allowed_model_ids=["claude-code:fable"])
        self.assertEqual(response.json()["detail"], "explicit_model_selection_required")
        response = self.send(mode="review", allowed_model_ids=["claude-code:opus", "claude-code:haiku"], preferred_model_id="claude-code:opus")
        self.assertEqual(response.json()["detail"], "review_requires_second_eligible_model")
        response = self.send(mode="review", allowed_model_ids=["claude-code:opus", "claude-code:haiku"],
                             preferred_model_id="claude-code:opus", reviewer_model_id="claude-code:haiku")
        self.assertEqual(response.status_code, 202, response.text)

    def test_profiles_auto_review_and_explicit_override(self):
        models = [f"claude-code:{name}" for name in ("fable", "opus", "sonnet", "haiku")]
        for name, family in (("quick", "haiku"), ("normal", "sonnet"), ("deep", "opus")):
            result = self.send(cid=self.create()["id"], allowed_model_ids=models, response_profile=name).json()
            self.assertEqual(result["task"]["plan"][0]["model_id"], f"claude-code:{family}")
        result = self.send(cid=self.create()["id"], allowed_model_ids=models, mode="review", response_profile="normal").json()
        self.assertEqual([s["model_id"] for s in result["task"]["plan"]], ["claude-code:sonnet", "claude-code:opus"])
        result = self.send(cid=self.create()["id"], allowed_model_ids=models, response_profile="quick", preferred_model_id="claude-code:fable").json()
        self.assertEqual(result["task"]["plan"][0]["model_id"], "claude-code:fable")
        self.assertEqual(self.gateway.calls, [])

    def test_consent_survives_restart_and_all_chat_reads_require_auth(self):
        consent = self.consent()
        restarted = create_app(self.db, TOKEN, self.gateway, durable_execution=True)
        client = TestClient(restarted, headers={"Authorization": f"Bearer {TOKEN}"})
        self.addCleanup(client.close)
        self.assertEqual(client.get(f"/v1/conversations/{self.cid}/consent").json()["consent"]["id"], consent)
        sent = client.post(f"/v1/conversations/{self.cid}/turns", json=self.body(confirmed=False, consent_id=consent))
        self.assertEqual(sent.status_code, 202, sent.text)
        self.process()
        for path in ("", f"/{self.cid}", f"/{self.cid}/consent", f"/{self.cid}/turns", f"/{self.cid}/turns/{sent.json()['id']}"):
            self.assertEqual(client.get('/v1/conversations' + path, headers={'Authorization': 'Bearer wrong'}).status_code, 401)

    def test_bridge_exposes_chat_and_preserves_typed_errors(self):
        bridge = Bridge(self.client)
        def call(op, params):
            return bridge.handle({"protocol_version": "0", "request_id": str(uuid4()), "operation": op, "params": params})
        result = call("conversations.turns.send", {"conversation_id": self.cid, "turn": self.body(confirmed=False)})
        self.assertEqual(result["error"]["code"], "execution_confirmation_required")
        result = call("conversations.turns.send", {"conversation_id": self.cid, "turn": self.body()})
        self.assertTrue(result["ok"], result)
        self.assertTrue(call("conversations.turns.get", {"conversation_id": self.cid, "turn_id": result["data"]["id"]})["ok"])
        self.assertEqual(call("conversations.get", {"conversation_id": "../../etc"})["error"]["code"], "invalid_request")
        self.assertEqual(self.gateway.calls, [])


if __name__ == "__main__":
    unittest.main()
