"""Gateway on loopback whose provider is the CLI test double. Never a real account.

    python tests/integrations/fixtures/fake_gateway.py <port>

Reads GATEWAY_TOKEN from the environment; FAKE_CLAUDE_* variables select the
double's behaviour (for example FAKE_CLAUDE_LOGIN=none). Used by the desktop
smoke test; the dedup database lives in a temporary folder.
"""
import os
import sys
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(ROOT))

import uvicorn  # noqa: E402

from integrations.app import create_app  # noqa: E402
from integrations.config import ClaudeCodeSettings, Settings  # noqa: E402

FAKE = Path(__file__).with_name("fake_claude.py")


def main():
    port = int(sys.argv[1])
    settings = ClaudeCodeSettings(command=[sys.executable, str(FAKE)], models=["sonnet"],
                                  max_output_tokens=128)
    with tempfile.TemporaryDirectory() as folder:
        app = create_app(Settings(os.environ["GATEWAY_TOKEN"], Path(folder) / "gateway.sqlite3", settings))
        uvicorn.run(app, host="127.0.0.1", port=port, log_level="warning")


if __name__ == "__main__":
    main()
