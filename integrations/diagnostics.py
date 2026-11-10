"""Local availability report (first milestone, item 1).

Detects which official clients are installed and, where a documented status
command exists, whether a login is active. It never opens credential or token
files and never calls a model, so running it consumes no quota.
"""
import json
import os
import sys
import time
from concurrent.futures import ThreadPoolExecutor

from .adapters.claude_code import ClaudeCodeAdapter
from .adapters.gemini_cli import GeminiCliAdapter
from .adapters.openai_codex import OpenAICodexAdapter
from .config import ClaudeCodeSettings, GeminiCliSettings, OpenAICodexSettings

API_KEY_VARS = ("ANTHROPIC_API_KEY", "OPENAI_API_KEY", "CODEX_API_KEY", "GEMINI_API_KEY", "GOOGLE_API_KEY")
PATHS = {
    "claude_code": "Claude Code oficial com o login da assinatura Claude",
    "chatgpt_codex": "ChatGPT pela Codex CLI oficial da OpenAI (Sign in with ChatGPT)",
    "gemini_cli": "Gemini CLI oficial com Login with Google",
}


def _entry(adapter, key) -> dict:
    started = time.monotonic()
    status = adapter.status(refresh=True)
    seconds = round(time.monotonic() - started, 1)
    legacy = adapter.v1_gate()
    return {
        **status.as_dict(),
        # Time of a full status check; the browser bridge waits 20 s for the catalog.
        "probe_seconds": seconds,
        "path": PATHS[key],
        "configured_models": [adapter.profile_id(m) for m in adapter.settings.models],
        "capabilities": adapter.capabilities.model_dump(),
        # `ready` = transport ready. 1.1 still needs the task's acceptance (and the
        # backend's tool policy); contract 1 only exists for Claude Code (legacy flag).
        "contract_1_1": {"available": status.ready, "requires_task_acceptance": True},
        "contract_1": {"available": legacy.ready, "reason": legacy.reason},
    }


def report(claude_settings: ClaudeCodeSettings | None = None,
           codex_settings: OpenAICodexSettings | None = None,
           gemini_settings: GeminiCliSettings | None = None) -> dict:
    adapters = {
        "claude_code": ClaudeCodeAdapter(claude_settings or ClaudeCodeSettings.from_env()),
        "chatgpt_codex": OpenAICodexAdapter(codex_settings or OpenAICodexSettings.from_env()),
        "gemini_cli": GeminiCliAdapter(gemini_settings or GeminiCliSettings.from_env()),
    }
    with ThreadPoolExecutor(max_workers=len(adapters)) as pool:
        entries = dict(zip(adapters, pool.map(lambda key: _entry(adapters[key], key), adapters)))
    return {
        **entries,
        # Only presence, never values. A set API key changes billing for some CLIs.
        "api_key_variables_present": [name for name in API_KEY_VARS if os.environ.get(name)],
        "notes": [
            "Nenhum arquivo de credencial foi lido e nenhum modelo foi chamado.",
            "As variáveis de chave de API são removidas do ambiente das CLIs, para não usar cobrança de API.",
            "Gemini CLI: IA_BBARU_GEMINI_CLI_LOGIN=google só autoriza a verificação; o login é conferido pela própria CLI, com entrada vazia (sem geração).",
        ],
    }


def main():
    # When piped (e.g. `| clip` on Windows) the console code page garbles
    # accents; escaped JSON stays valid and readable everywhere.
    print(json.dumps(report(), ensure_ascii=not sys.stdout.isatty(), indent=2))
