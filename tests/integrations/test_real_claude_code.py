"""OPT-IN test with the user's real Claude Code login. Skipped by default.

It makes ONE small generation that consumes subscription quota. Run it only on
your own computer, after logging in through `claude` (/login) and deciding to
spend that usage:

    PowerShell:  $env:IA_BBARU_REAL_TEST = "claude-code"
                 $env:IA_BBARU_CLAUDE_CODE_MODELS = "sonnet"
                 python -m unittest discover -s tests/integrations -p "test_real_*.py" -v

Nothing is stored in the repository; the dedup database lives in a temp folder.
"""
import os
import tempfile
import unittest
import uuid
from pathlib import Path

from fastapi.testclient import TestClient

from integrations.contracts_v1_1 import GenerateResponseV11
from integrations.adapters.claude_code import ClaudeCodeAdapter
from integrations.app import create_app
from integrations.config import ClaudeCodeSettings, Settings

ENABLED = os.environ.get("IA_BBARU_REAL_TEST") == "claude-code"


@unittest.skipUnless(ENABLED, "teste real desativado; defina IA_BBARU_REAL_TEST=claude-code para consentir")
class RealClaudeCodeTest(unittest.TestCase):
    def test_one_small_real_generation(self):
        cc = ClaudeCodeSettings.from_env()
        if not cc.models:
            self.skipTest("defina IA_BBARU_CLAUDE_CODE_MODELS, por exemplo sonnet")
        status = ClaudeCodeAdapter(cc).status(refresh=True)
        if not status.ready:
            self.skipTest(f"Claude Code indisponível: {status.reason}. {status.next_action}")
        token = uuid.uuid4().hex + uuid.uuid4().hex
        with tempfile.TemporaryDirectory() as tmp:
            app = create_app(Settings(token, Path(tmp) / "real.sqlite3", cc))
            client = TestClient(app, headers={"Authorization": f"Bearer {token}"})
            # Contract 1.1: the opt-in variable is the consent; the task carries it.
            response = client.post("/v1.1/generate", json={
                "protocol_version": "1.1", "allow_unenforced_output_limit": True,
                "request_id": f"real-test-{uuid.uuid4()}",
                "model_id": f"claude-code:{cc.models[0]}", "role": "answer",
                "instruction": "Responda apenas com a palavra da fonte.",
                "context": [{"id": "fonte-1", "title": "Teste", "content": "A palavra é laranja."}],
                "previous_output": None, "max_output_tokens": 128,
            })
        self.assertEqual(response.status_code, 200, response.text)
        result = GenerateResponseV11.model_validate(response.json())
        # finish "stop"/"length" = the CLI reported stop_reason; "unknown" = it did not.
        print("\nSaída real:", result.output[:200], "| usage:", result.usage, "| finish:", result.finish_reason)
        self.assertIn("laranja", result.output.lower())
