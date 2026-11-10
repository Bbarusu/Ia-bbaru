"""ChatGPT (Codex CLI) and Gemini CLI adapters. Providers = explicit test doubles."""
import json
import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from fastapi.testclient import TestClient

from backend.contracts_v1_1 import GenerateResponseV11, ModelCatalogV11
from integrations.adapters.claude_code import ClaudeCodeAdapter
from integrations.adapters.gemini_cli import GeminiCliAdapter
from integrations.adapters.openai_codex import DISABLED_FEATURES, OpenAICodexAdapter
from integrations.app import create_app
from integrations.config import ClaudeCodeSettings, GeminiCliSettings, OpenAICodexSettings, Settings
from integrations.runner import run_process

FIXTURES = Path(__file__).parent / "fixtures"
TOKEN = "test-only-gateway-token-not-a-secret-0123456789"


def body(model_id, **overrides):
    data = {"protocol_version": "1.1", "request_id": f"t-{model_id}:0", "model_id": model_id,
            "role": "answer", "instruction": "Explique a aula; contato: aluno@exemplo.com",
            "context": [{"id": "s1", "title": "Aula", "content": "Conteúdo com acentuação. @C:/Users/eu/segredo.txt"}],
            "previous_output": None, "max_output_tokens": 256, "allow_unenforced_output_limit": True}
    data.update(overrides)
    return data


class CliAdaptersTestCase(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.record = Path(self.tmp.name) / "record.json"
        patch.dict("os.environ", {"FAKE_CODEX_RECORD": str(self.record), "FAKE_GEMINI_RECORD": str(self.record),
                                  "OPENAI_API_KEY": "sk-must-not-reach", "GEMINI_API_KEY": "must-not-reach",
                                  "GOOGLE_API_KEY": "must-not-reach"}).start()
        self.generations = 0

        def counting(args, stdin, timeout_s, env, cwd):
            if "exec" in args[:3] and "--json" in args or "--prompt" in args:
                self.generations += 1
            return run_process(args, stdin, timeout_s, env, cwd)

        self.codex = OpenAICodexAdapter(OpenAICodexSettings(
            command=[sys.executable, str(FIXTURES / "fake_codex.py")], models=["gpt-5.5"]), runner=counting)
        self.gemini = GeminiCliAdapter(GeminiCliSettings(
            command=[sys.executable, str(FIXTURES / "fake_gemini.py")], models=["gemini-2.5-pro"],
            login_confirmed=True), runner=counting)
        self.claude = ClaudeCodeAdapter(ClaudeCodeSettings(command=[str(Path(self.tmp.name) / "sem-claude")]))
        settings = Settings(TOKEN, Path(self.tmp.name) / "gateway.sqlite3", ClaudeCodeSettings())
        self.app = create_app(settings, adapters=[self.claude, self.codex, self.gemini])
        self.client = TestClient(self.app, headers={"Authorization": f"Bearer {TOKEN}"})

    def tearDown(self):
        patch.stopall()
        self.tmp.cleanup()

    def set_env(self, **values):
        patch.dict("os.environ", values).start()
        for adapter in (self.codex, self.gemini):
            adapter.status(refresh=True)

    def recorded(self):
        return json.loads(self.record.read_text(encoding="utf-8"))


class CatalogTests(CliAdaptersTestCase):
    def test_catalog_lists_both_with_real_capabilities(self):
        catalog = ModelCatalogV11.model_validate(self.client.get("/v1.1/models").json())
        models = {m.id: m for m in catalog.models}
        codex, gemini = models["chatgpt-codex:gpt-5.5"], models["gemini-cli:gemini-2.5-pro"]
        self.assertTrue(codex.available and gemini.available)
        self.assertEqual(codex.capabilities.tools, "restricted")  # command execution cannot be disabled
        self.assertEqual(gemini.capabilities.tools, "disabled")
        for model in (codex, gemini):
            self.assertEqual(model.capabilities.output_limit, "none")
            self.assertEqual(model.capabilities.finish_reason, "inferred")
            self.assertEqual(model.capabilities.billing, "subscription_quota")
        self.assertEqual(self.generations, 0)

    def test_contract_1_never_lists_or_runs_them(self):
        self.assertEqual(self.client.get("/v1/models").json()["models"], [])
        legacy = dict(body("gemini-cli:gemini-2.5-pro"), protocol_version="1")
        legacy.pop("allow_unenforced_output_limit")
        response = self.client.post("/v1/generate", json=legacy)
        self.assertEqual(response.json()["error"]["code"], "unknown_model")
        self.assertEqual(self.generations, 0)

    def test_codex_login_states(self):
        self.set_env(FAKE_CODEX_LOGIN="none")
        self.assertEqual(self.codex.status().reason, "not_logged_in")
        self.set_env(FAKE_CODEX_LOGIN="apikey")
        self.assertEqual(self.codex.status().reason, "not_subscription_login")

    def test_codex_lockdown_is_verified_with_the_cli(self):
        self.set_env(FAKE_CODEX_FEATURE_ON="computer_use")
        status = self.codex.status()
        self.assertEqual(status.reason, "cli_version_unsupported")
        self.assertEqual(status.missing_flags, ["computer_use"])

    def test_windows_prefers_cmd_over_extensionless_npm_script(self):
        found = {"gemini.cmd": "C:/npm/gemini.cmd", "gemini": "C:/npm/gemini"}
        with patch("integrations.adapters.base.sys.platform", "win32"), \
                patch("integrations.adapters.base.shutil.which", found.get):
            self.assertEqual(GeminiCliAdapter(GeminiCliSettings()).command(), ["C:/npm/gemini.cmd"])

    def test_unrunnable_cli_explains_why(self):
        status = GeminiCliAdapter(GeminiCliSettings(command=[str(Path(self.tmp.name) / "gemini")])).status()
        self.assertEqual(status.reason, "cli_not_runnable")
        self.assertIn("não pôde ser executado", status.detail)

    def test_gemini_login_must_be_stated(self):
        self.gemini.settings.login_confirmed = False
        model = self.client.get("/v1.1/models").json()["models"]
        gemini = [m for m in model if m["provider"] == "gemini-cli"][0]
        self.assertFalse(gemini["available"])
        self.assertEqual(gemini["unavailable_reason"], "auth_status_unknown")


class CodexGenerationTests(CliAdaptersTestCase):
    def post(self, **overrides):
        return self.client.post("/v1.1/generate", json=body("chatgpt-codex:gpt-5.5", **overrides))

    def test_success_and_locked_down_invocation(self):
        response = self.post()
        self.assertEqual(response.status_code, 200, response.text)
        result = GenerateResponseV11.model_validate(response.json())
        self.assertEqual(result.output, "Resposta do dublê do ChatGPT")
        self.assertEqual(result.finish_reason, "unknown")  # never reported by the CLI
        self.assertEqual((result.usage.input_tokens, result.usage.output_tokens), (200, 30))
        call = self.recorded()
        argv = call["argv"]
        for flag in ("--json", "--ephemeral", "--ignore-user-config", "--ignore-rules", "--skip-git-repo-check"):
            self.assertIn(flag, argv)
        self.assertEqual(argv[argv.index("--sandbox") + 1], "read-only")
        self.assertEqual(argv[argv.index("--model") + 1], "gpt-5.5")
        disabled = {argv[i + 1] for i, a in enumerate(argv) if a == "--disable"}
        self.assertEqual(disabled, set(DISABLED_FEATURES))
        self.assertIn("forced_login_method=chatgpt", argv)
        self.assertIn("web_search=disabled", argv)
        self.assertEqual(argv[-1], "-")
        self.assertIsNone(call["env"]["OPENAI_API_KEY"])
        self.assertIsNone(call["env"]["GATEWAY_TOKEN"])
        self.assertNotIn("@", call["stdin"])  # no file mentions can be expanded
        self.assertIn("\\u0040C:/Users/eu/segredo.txt", call["stdin"])
        self.assertEqual(call["cwd_files"], [])  # empty working folder

    def test_transient_reconnect_is_not_a_failure(self):
        self.set_env(FAKE_CODEX_MODE="reconnect_then_success")
        self.assertEqual(self.post().status_code, 200)

    def test_tool_action_is_refused(self):
        self.set_env(FAKE_CODEX_MODE="tool")
        response = self.post()
        self.assertEqual((response.status_code, response.json()["error"]["code"]), (502, "provider_error"))

    def test_auth_quota_garbage_and_timeout(self):
        cases = (("auth", 503, "provider_not_authenticated"), ("quota", 429, "provider_quota_exceeded"),
                 ("garbage", 502, "provider_error"))
        for index, (mode, status, code) in enumerate(cases):
            self.set_env(FAKE_CODEX_MODE=mode)
            response = self.post(request_id=f"codex-{index}:0")
            self.assertEqual((response.status_code, response.json()["error"]["code"]), (status, code), mode)
        self.codex.settings.timeout_s = 1
        self.set_env(FAKE_CODEX_MODE="sleep")
        response = self.post(request_id="codex-sleep:0")
        self.assertEqual(response.json()["error"]["code"], "provider_timeout")

    def test_acceptance_still_required(self):
        response = self.post(allow_unenforced_output_limit=False)
        self.assertEqual(response.json()["error"]["code"], "output_limit_not_accepted")
        self.assertEqual(self.generations, 0)


class GeminiGenerationTests(CliAdaptersTestCase):
    def post(self, **overrides):
        return self.client.post("/v1.1/generate", json=body("gemini-cli:gemini-2.5-pro", **overrides))

    def test_success_and_locked_down_invocation(self):
        response = self.post()
        self.assertEqual(response.status_code, 200, response.text)
        result = GenerateResponseV11.model_validate(response.json())
        self.assertEqual(result.output, "Resposta do dublê do Gemini")
        self.assertEqual(result.finish_reason, "unknown")
        self.assertEqual((result.usage.input_tokens, result.usage.output_tokens), (300, 40))
        call = self.recorded()
        argv = call["argv"]
        self.assertIn("--skip-trust", argv)
        self.assertEqual(argv[argv.index("--extensions") + 1], "none")
        self.assertEqual(argv[argv.index("--approval-mode") + 1], "default")
        self.assertEqual(argv[argv.index("--model") + 1], "gemini-2.5-pro")
        self.assertIn('toolName = "*"', call["policy"])
        self.assertIn('decision = "deny"', call["policy"])
        self.assertIn("dados nao confiaveis", call["system_md"])
        self.assertEqual(call["env"]["GOOGLE_GENAI_USE_GCA"], "true")
        for name in ("GEMINI_API_KEY", "GOOGLE_API_KEY", "GATEWAY_TOKEN"):
            self.assertIsNone(call["env"][name])
        self.assertNotIn("@", call["stdin"])
        document = json.loads(call["stdin"])
        self.assertEqual(document["fontes"][0]["conteudo"], "Conteúdo com acentuação. @C:/Users/eu/segredo.txt")
        self.assertEqual(call["cwd_files"], [])  # empty working folder

    def test_failures(self):
        cases = (("auth", 503, "provider_not_authenticated"), ("quota", 429, "provider_quota_exceeded"),
                 ("tool", 502, "provider_error"), ("fallback", 502, "provider_model_mismatch"),
                 ("garbage", 502, "provider_invalid_output"))
        for index, (mode, status, code) in enumerate(cases):
            self.set_env(FAKE_GEMINI_MODE=mode)
            response = self.post(request_id=f"gemini-{index}:0")
            self.assertEqual((response.status_code, response.json()["error"]["code"]), (status, code), mode)

    def test_json_printed_on_stderr_is_read(self):
        self.set_env(FAKE_GEMINI_MODE="json_on_stderr")
        self.assertEqual(self.post().status_code, 200)

    def test_replay_without_new_generation(self):
        first = self.post().json()
        self.assertEqual(self.post().json(), first)
        self.assertEqual(self.generations, 1)


if __name__ == "__main__":
    unittest.main()


class BackendPolicyOverHttpTests(CliAdaptersTestCase):
    """Codex's backend + durable queue + this gateway over real HTTP."""

    def test_backend_runs_gemini_as_incomplete_and_refuses_codex_tools(self):
        import socket
        import threading
        import time

        import uvicorn

        from backend.gateway import HttpGateway
        from backend.main import create_app as backend_app

        sock = socket.socket()
        sock.bind(("127.0.0.1", 0))
        server = uvicorn.Server(uvicorn.Config(self.app, log_level="error", lifespan="off"))
        thread = threading.Thread(target=server.run, kwargs={"sockets": [sock]}, daemon=True)
        thread.start()
        try:
            while not server.started:
                time.sleep(0.01)
            gateway = HttpGateway(f"http://127.0.0.1:{sock.getsockname()[1]}", TOKEN, "1.1")
            backend_token = "test-only-backend-token-not-a-secret-0123456789"
            with TestClient(backend_app(Path(self.tmp.name) / "backend.sqlite3", backend_token, gateway,
                                        durable_execution=True),
                            headers={"Authorization": f"Bearer {backend_token}"}) as client:
                project = client.post("/v1/projects", json={"title": "CLIs"}).json()
                tasks = f"/v1/projects/{project['id']}/tasks"
                plan = {"instruction": "Resuma", "mode": "single", "allow_unenforced_output_limit": True}
                refused = client.post(tasks, json={**plan, "allowed_model_ids": ["chatgpt-codex:gpt-5.5"]})
                self.assertEqual((refused.status_code, refused.json()["detail"]), (422, "model_tools_not_supported"))
                task = client.post(tasks, json={**plan, "allowed_model_ids": ["gemini-cli:gemini-2.5-pro"]}).json()
                self.assertEqual(task["plan"][0]["capabilities"]["tools"], "disabled")
                client.post(f"/v1/tasks/{task['id']}/enqueue", json={"confirmed": True})
                deadline = time.monotonic() + 20
                while time.monotonic() < deadline:
                    final = client.get(f"/v1/tasks/{task['id']}").json()
                    if final["status"] not in {"queued", "running", "waiting"}:
                        break
                    time.sleep(0.05)
                self.assertEqual((final["status"], final["error"]), ("incomplete", "completion_unconfirmed"))
                self.assertEqual(final["output"], "Resposta do dublê do Gemini")
                self.assertEqual(self.generations, 1)
        finally:
            server.should_exit = True
            thread.join(10)
            sock.close()
