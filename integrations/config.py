"""Configuration read from environment variables only (no .env loading).

Nothing here is a secret except GATEWAY_TOKEN, which is never logged or returned.
"""
import os
import re
from dataclasses import dataclass, field
from pathlib import Path

MODEL_NAME = re.compile(r"[A-Za-z0-9][A-Za-z0-9._\[\]-]{0,99}")
ALL_TASK_KINDS = ("general", "study", "writing", "coding", "analysis")
BACKEND_TIMEOUT_S = 120  # backend/gateway.py waits at most 120 s per call


def _flag(name: str) -> bool:
    return os.environ.get(name, "").strip().lower() in {"1", "true", "yes", "on"}


def _list(name: str, default: str = "") -> list[str]:
    raw = os.environ.get(name, default)
    return [item.strip() for item in raw.split(",") if item.strip()]


def _int(name: str, default: int) -> int:
    raw = os.environ.get(name, "").strip()
    return int(raw) if raw else default


@dataclass
class ClaudeCodeSettings:
    # Explicit command (path to claude / claude.exe / claude.cmd). Empty = PATH lookup.
    command: list[str] = field(default_factory=list)
    # Model names chosen by the operator. Full model names are preferred because
    # aliases (sonnet/opus) are resolved by the CLI to the latest model.
    models: list[str] = field(default_factory=list)
    task_kinds: list[str] = field(default_factory=lambda: list(ALL_TASK_KINDS))
    context_char_limit: int = 80000
    max_output_tokens: int = 4096
    timeout_s: int = 90
    # Contract v1 promises a hard output cap. The CLI only offers a best-effort
    # setting, so models stay `available: false` unless the operator accepts it.
    accept_unenforced_output_limit: bool = False

    @classmethod
    def from_env(cls):
        command = os.environ.get("IA_BBARU_CLAUDE_CODE_BIN", "").strip()
        return cls(
            command=[command] if command else [],
            models=_list("IA_BBARU_CLAUDE_CODE_MODELS"),
            task_kinds=_list("IA_BBARU_CLAUDE_CODE_TASK_KINDS", ",".join(ALL_TASK_KINDS)),
            context_char_limit=_int("IA_BBARU_CLAUDE_CODE_CONTEXT_CHARS", 80000),
            max_output_tokens=_int("IA_BBARU_CLAUDE_CODE_MAX_OUTPUT_TOKENS", 4096),
            timeout_s=_int("IA_BBARU_CLAUDE_CODE_TIMEOUT_S", 90),
            accept_unenforced_output_limit=_flag("IA_BBARU_CLAUDE_CODE_ACCEPT_UNENFORCED_OUTPUT_LIMIT"),
        )

    def validate(self):
        unknown = set(self.task_kinds) - set(ALL_TASK_KINDS)
        if unknown or not self.task_kinds:
            raise RuntimeError("IA_BBARU_CLAUDE_CODE_TASK_KINDS inválido")
        if not 1000 <= self.context_char_limit <= 1_000_000:
            raise RuntimeError("IA_BBARU_CLAUDE_CODE_CONTEXT_CHARS fora de 1000..1000000")
        if not 1 <= self.max_output_tokens <= 32768:
            raise RuntimeError("IA_BBARU_CLAUDE_CODE_MAX_OUTPUT_TOKENS fora de 1..32768")
        # Leave margin so the gateway answers before the backend gives up.
        if not 5 <= self.timeout_s <= BACKEND_TIMEOUT_S - 10:
            raise RuntimeError("IA_BBARU_CLAUDE_CODE_TIMEOUT_S deve ficar entre 5 e 110")
        if len(set(self.models)) != len(self.models) or len(self.models) > 100:
            raise RuntimeError("IA_BBARU_CLAUDE_CODE_MODELS com duplicatas ou excesso")
        for model in self.models:
            # Plain names only: the value becomes a CLI argument.
            if not MODEL_NAME.fullmatch(model):
                raise RuntimeError("IA_BBARU_CLAUDE_CODE_MODELS contém nome inválido")


@dataclass
class Settings:
    gateway_token: str
    db_path: Path
    claude_code: ClaudeCodeSettings

    @classmethod
    def from_env(cls):
        return cls(
            gateway_token=os.environ.get("GATEWAY_TOKEN", ""),
            db_path=Path(os.environ.get("IA_BBARU_GATEWAY_DB", "data/integrations.sqlite3")),
            claude_code=ClaudeCodeSettings.from_env(),
        )

    def validate(self):
        if len(self.gateway_token) < 32:
            raise RuntimeError("GATEWAY_TOKEN ausente ou curto (mínimo 32 caracteres)")
        self.claude_code.validate()
