"""Run backend -> HTTP gateway -> explicit fake CLI checks; never use a real account.

python scripts/verify_gateway_v11.py --gateway-checkout ../claude-gateway
The checkout must contain the gateway from PR #1 and its fake_claude.py fixture.
"""
import argparse
import json
from pathlib import Path
import socket
import sys
import tempfile
import threading
import time
from unittest.mock import patch

import uvicorn
from fastapi.testclient import TestClient

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--gateway-checkout", required=True, type=Path)
    args = parser.parse_args()
    checkout = args.gateway_checkout.resolve()
    fixture = checkout / "tests/integrations/fixtures/fake_claude.py"
    if not fixture.is_file():
        parser.error("Gateway checkout must contain tests/integrations/fixtures/fake_claude.py")
    sys.path.append(str(checkout))

    from backend.gateway import HttpGateway
    from backend.main import create_app as backend_app
    from integrations.adapters.claude_code import ClaudeCodeAdapter
    from integrations.app import create_app as gateway_app
    from integrations.config import ClaudeCodeSettings, Settings
    from integrations.runner import run_process

    generations = []

    def runner(command, stdin, timeout, env, cwd):
        # Only the explicit Python fixture is executable in this check.
        assert [Path(part).resolve() for part in command[:2]] == [Path(sys.executable).resolve(), fixture]
        if "--print" in command:
            generations.append(stdin)
        return run_process(command, stdin, timeout, env, cwd)

    backend_token = "test-only-backend-token-not-a-secret-0123456789"
    gateway_token = "test-only-gateway-token-not-a-secret-0123456789"
    with tempfile.TemporaryDirectory() as directory, patch.dict("os.environ", {
        "FAKE_CLAUDE_MODE": "success", "FAKE_CLAUDE_LOGIN": "claude.ai", "FAKE_CLAUDE_OLD": "0",
        "FAKE_CLAUDE_RECORD": str(Path(directory) / "record.json"),
    }):
        settings = ClaudeCodeSettings(command=[sys.executable, str(fixture)], models=["sonnet", "opus"],
                                      max_output_tokens=128, accept_unenforced_output_limit=False)
        adapter = ClaudeCodeAdapter(settings, runner=runner)
        application = gateway_app(Settings(gateway_token, Path(directory) / "gateway.sqlite3", settings), adapter)
        # Bind once and pass the socket to uvicorn to avoid port allocation races.
        with socket.socket() as sock:
            sock.bind(("127.0.0.1", 0))
            port = sock.getsockname()[1]
            server = uvicorn.Server(uvicorn.Config(application, log_level="error", lifespan="off"))
            thread = threading.Thread(target=server.run, kwargs={"sockets": [sock]}, daemon=True)
            thread.start()
            try:
                deadline = time.monotonic() + 10
                while not server.started and thread.is_alive() and time.monotonic() < deadline:
                    time.sleep(0.01)
                assert server.started, "Gateway did not start"
                gateway = HttpGateway(f"http://127.0.0.1:{port}", gateway_token, "1.1")
                with TestClient(backend_app(Path(directory) / "backend.sqlite3", backend_token, gateway),
                                headers={"Authorization": f"Bearer {backend_token}"}) as client:
                    catalog_response = client.get("/v1/models")
                    assert catalog_response.status_code == 200, catalog_response.text
                    catalog = catalog_response.json()
                    assert catalog["protocol_version"] == "1.1"
                    assert catalog["models"][0]["capabilities"]["output_limit"] == "best_effort"
                    project = client.post("/v1/projects", json={"title": "Teste de integração"}).json()
                    source = client.post(f"/v1/projects/{project['id']}/sources", json={
                        "title": "Aula", "content": "Conteúdo com acentuação"}).json()
                    request = {"instruction": "Explique", "source_ids": [source["id"]], "mode": "review",
                               "allowed_model_ids": ["claude-code:sonnet", "claude-code:opus"]}
                    endpoint = f"/v1/projects/{project['id']}/tasks"
                    denied = client.post(endpoint, json=request)
                    assert denied.status_code == 422 and denied.json()["detail"] == "output_limit_not_accepted"
                    assert not generations
                    request["allow_unenforced_output_limit"] = True
                    for mode, status, count in (("no_stop_reason", "incomplete", 1), ("success", "completed", 2)):
                        with patch.dict("os.environ", {"FAKE_CLAUDE_MODE": mode}):
                            response = client.post(endpoint, json=request)
                            assert response.status_code == 201, response.text
                            task = response.json()
                            assert task["allow_unenforced_output_limit"] is True
                            before = len(generations)
                            result = client.post(f"/v1/tasks/{task['id']}/execute").json()
                            assert result["status"] == status, result
                            assert len(generations) - before == count
                            assert result["output"] == "Resposta do dublê de teste"
                            if status == "incomplete":
                                assert result["error"] == "completion_unconfirmed"
                                assert result["results"][0]["finish_reason"] == "unknown"
                            assert client.post(f"/v1/tasks/{task['id']}/execute").status_code == 409
                            assert len(generations) - before == count
                            assert client.get(f"/v1/tasks/{task['id']}").json() == result
                            assert "Conteúdo com acentuação" in generations[before]
                            print(json.dumps({"fixture_mode": mode, "status": result["status"],
                                              "error": result["error"], "generation_calls": count}))
            finally:
                server.should_exit = True
                thread.join(timeout=10)
                assert not thread.is_alive(), "Gateway did not stop"
    print("Gateway 1.1 verified over HTTP with fake CLI: acceptance, preserved unknown output, review, no repeat.")


if __name__ == "__main__":
    main()
