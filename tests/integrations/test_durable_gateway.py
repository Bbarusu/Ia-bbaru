"""Durable backend queue (Codex) + this gateway over real HTTP + CLI test double.

Covers what the backend's own tests only simulate in memory: a real
`gateway_busy` from this gateway, and that the queue retries with the same
request_id and the same body. No real account is used.
"""
import socket
import sys
import tempfile
import threading
import time
import unittest
import uuid
from pathlib import Path
from unittest.mock import patch

import uvicorn
from fastapi.testclient import TestClient

from backend.gateway import HttpGateway
from backend.main import create_app as backend_app
from integrations.adapters.claude_code import ClaudeCodeAdapter
from integrations.app import create_app as gateway_app
from integrations.config import ClaudeCodeSettings, Settings
from integrations.contracts_v1_1 import GenerateRequestV11
from integrations.runner import run_process

FAKE = Path(__file__).parent / "fixtures" / "fake_claude.py"
BACKEND_TOKEN = "test-only-backend-token-not-a-secret-0123456789"
GATEWAY_TOKEN = "test-only-gateway-token-not-a-secret-0123456789"


class DurableQueueOverHttpTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        folder = Path(self.tmp.name)
        patch.dict("os.environ", {"FAKE_CLAUDE_MODE": "success", "FAKE_CLAUDE_LOGIN": "claude.ai",
                                  "FAKE_CLAUDE_DELAY": "1.5"}).start()
        self.generations = []
        self.started = threading.Event()

        def runner(args, stdin, timeout_s, env, cwd):
            if "--print" in args:
                self.generations.append(stdin)
                self.started.set()
            return run_process(args, stdin, timeout_s, env, cwd)

        settings = ClaudeCodeSettings(command=[sys.executable, str(FAKE)], models=["sonnet"],
                                      max_output_tokens=128, timeout_s=20)
        self.gateway_store = folder / "gateway.sqlite3"
        app = gateway_app(Settings(GATEWAY_TOKEN, self.gateway_store, settings),
                          ClaudeCodeAdapter(settings, runner=runner))
        self.sock = socket.socket()
        self.sock.bind(("127.0.0.1", 0))
        port = self.sock.getsockname()[1]
        self.server = uvicorn.Server(uvicorn.Config(app, log_level="error", lifespan="off"))
        self.thread = threading.Thread(target=self.server.run, kwargs={"sockets": [self.sock]}, daemon=True)
        self.thread.start()
        deadline = time.monotonic() + 10
        while not self.server.started and time.monotonic() < deadline:
            time.sleep(0.01)
        self.http = HttpGateway(f"http://127.0.0.1:{port}", GATEWAY_TOKEN, "1.1")
        self.backend = backend_app(folder / "backend.sqlite3", BACKEND_TOKEN, self.http, durable_execution=True)
        self.client = TestClient(self.backend, headers={"Authorization": f"Bearer {BACKEND_TOKEN}"})
        self.client.__enter__()

    def tearDown(self):
        self.client.__exit__(None, None, None)
        self.server.should_exit = True
        self.thread.join(10)
        self.sock.close()
        patch.stopall()
        self.tmp.cleanup()

    def plan(self):
        project = self.client.post("/v1/projects", json={"title": "Fila"}).json()
        source = self.client.post(f"/v1/projects/{project['id']}/sources",
                                  json={"title": "Aula", "content": "Conteúdo com acentuação"}).json()
        response = self.client.post(f"/v1/projects/{project['id']}/tasks", json={
            "instruction": "Explique a aula da fila", "source_ids": [source["id"]], "mode": "single",
            "allowed_model_ids": ["claude-code:sonnet"], "allow_unenforced_output_limit": True})
        self.assertEqual(response.status_code, 201, response.text)
        return response.json()

    def wait_final(self, task_id, timeout=30):
        deadline = time.monotonic() + timeout
        seen = set()
        while time.monotonic() < deadline:
            task = self.client.get(f"/v1/tasks/{task_id}").json()
            seen.add(task["status"])
            if task["status"] not in {"queued", "running", "waiting"}:
                return task, seen
            time.sleep(0.05)
        self.fail(f"tarefa não terminou: {seen}")

    def test_gateway_busy_is_retried_with_same_id_and_body(self):
        task = self.plan()
        other = GenerateRequestV11(
            protocol_version="1.1", request_id=f"outro-cliente-{uuid.uuid4()}", model_id="claude-code:sonnet",
            role="answer", instruction="Outro cliente ocupa o gateway", context=[], max_output_tokens=64,
            allow_unenforced_output_limit=True)
        occupier = threading.Thread(target=self.http.generate, args=(other,))
        occupier.start()
        self.assertTrue(self.started.wait(10))  # the gateway's single slot is now taken
        queued = self.client.post(f"/v1/tasks/{task['id']}/enqueue", json={"confirmed": True})
        self.assertEqual(queued.status_code, 202, queued.text)
        final, seen = self.wait_final(task["id"])
        occupier.join(20)

        self.assertEqual(final["status"], "completed", final)
        self.assertIn("waiting", seen)  # gateway_busy was received and waited on
        stored = self.backend.state.store.task(task["id"])
        step = stored["execution"]["steps"][0]
        self.assertEqual(step["request_id"], f"{task['id']}:0")
        self.assertGreaterEqual(step["attempts"], 2)
        mine = [g for g in self.generations if "Explique a aula da fila" in g]
        self.assertEqual(len(mine), 1)  # busy never reached the provider
        self.assertIn("Conteúdo com acentuação", mine[0])

        # The persisted body is byte-for-byte what the gateway completed:
        # replaying it returns the stored answer without a new generation.
        before = len(self.generations)
        replay = self.http.generate(GenerateRequestV11.model_validate(step["request"]))
        self.assertEqual(replay.output, final["output"])
        self.assertEqual(len(self.generations), before)

    def test_timeout_is_uncertain_and_never_repeated(self):
        patch.dict("os.environ", {"FAKE_CLAUDE_MODE": "sleep"}).start()  # sleeps 30 s > timeout 20 s
        task = self.plan()
        self.client.post(f"/v1/tasks/{task['id']}/enqueue", json={"confirmed": True})
        final, _ = self.wait_final(task["id"], timeout=40)
        self.assertEqual((final["status"], final["error"]), ("uncertain", "provider_timeout"))
        self.assertEqual(self.client.post(f"/v1/tasks/{task['id']}/resume", json={"confirmed": True}).status_code, 409)
        self.assertEqual(self.client.post(f"/v1/tasks/{task['id']}/enqueue", json={"confirmed": True}).status_code, 409)
        self.assertEqual(len(self.generations), 1)


if __name__ == "__main__":
    unittest.main()
