"""Local availability report (first milestone, item 1).

Detects which official clients are installed and, where a documented status
command exists, whether a login is active. It never opens credential or token
files and never calls a model, so running it consumes no quota.
"""
import json
import os
import shutil
import sys
import tempfile

from .adapters.claude_code import ClaudeCodeAdapter
from .config import ClaudeCodeSettings
from .runner import ProcessStartError, ProcessTimeout, child_env, run_process

API_KEY_VARS = ("ANTHROPIC_API_KEY", "OPENAI_API_KEY", "GEMINI_API_KEY", "GOOGLE_API_KEY")


def _version(binary: str) -> str | None:
    path = shutil.which(binary)
    if not path:
        return None
    try:
        with tempfile.TemporaryDirectory() as cwd:
            proc = run_process([path, "--version"], "", 20, child_env(), cwd)
    except (ProcessStartError, ProcessTimeout):
        return "instalado, versão não lida"
    lines = (proc.stdout or proc.stderr).strip().splitlines()
    return lines[0][:80] if lines else "instalado, versão não lida"


def report(claude_settings: ClaudeCodeSettings | None = None) -> dict:
    claude = ClaudeCodeAdapter(claude_settings or ClaudeCodeSettings.from_env()).status(refresh=True)
    codex_version = _version("codex")
    gemini_version = _version("gemini")
    return {
        "claude_code": {
            **claude.as_dict(),
            "path": "Claude Code oficial com login do próprio usuário (adaptador implementado)",
        },
        "chatgpt_codex": {
            "installed": codex_version is not None, "version": codex_version,
            "logged_in": None, "ready": False, "reason": "adapter_not_implemented",
            "path": "Sign in with ChatGPT exige verificação de elegibilidade e não aceita max_output_tokens",
            "next_action": "Sem adaptador nesta entrega; usar transferência assistida de contexto.",
        },
        "gemini_cli": {
            "installed": gemini_version is not None, "version": gemini_version,
            "logged_in": None, "ready": False, "reason": "adapter_not_implemented",
            "path": "Gemini CLI oficial; login não verificado para não ler arquivos de credencial",
            "next_action": "Sem adaptador nesta entrega; usar transferência assistida de contexto.",
        },
        # Only presence, never values. A set API key changes billing for some CLIs.
        "api_key_variables_present": [name for name in API_KEY_VARS if os.environ.get(name)],
        "notes": [
            "Nenhum arquivo de credencial foi lido e nenhum modelo foi chamado.",
            "O gateway remove ANTHROPIC_API_KEY do ambiente do Claude Code para não usar cobrança de API.",
        ],
    }


def main():
    # When piped (e.g. `| clip` on Windows) the console code page garbles
    # accents; escaped JSON stays valid and readable everywhere.
    print(json.dumps(report(), ensure_ascii=not sys.stdout.isatty(), indent=2))
