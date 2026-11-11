"""Configuration read from environment variables only (no .env loading).

Nothing here is a secret except GATEWAY_TOKEN, which is never logged or returned.
"""
import json
import os
import re
from dataclasses import dataclass, field
from pathlib import Path

from .models import family, is_checkable

MODEL_NAME = re.compile(r"[A-Za-z0-9][A-Za-z0-9._\[\]-]{0,99}")
ALL_TASK_KINDS = ("general", "study", "writing", "coding", "analysis")
BACKEND_TIMEOUT_S = 120  # backend/gateway.py waits at most 120 s per call
# Product defaults, not measured quality rankings or entitlement checks.
DEFAULT_MODEL_TASK_KINDS = {
    "sonnet": ["study", "coding"],
    "haiku": ["general", "writing"],
    "opus": ["analysis"],
    "fable": ["analysis"],
}


def _flag(name: str) -> bool:
    return os.environ.get(name, "").strip().lower() in {"1", "true", "yes", "on"}


def _list(name: str, default: str = "") -> list[str]:
    raw = os.environ.get(name, default)
    return [item.strip() for item in raw.split(",") if item.strip()]


def _int(name: str, default: int) -> int:
    raw = os.environ.get(name, "").strip()
    return int(raw) if raw else default


@dataclass
class CliSettings:
    """Settings of one official CLI. Each provider reads its own env prefix."""
    # Explicit command (path to the .exe / .cmd). Empty = PATH lookup.
    command: list[str] = field(default_factory=list)
    # Model names chosen by the operator. Full model names are preferred because
    # aliases are resolved by the CLI and may change.
    models: list[str] = field(default_factory=list)
    task_kinds: list[str] = field(default_factory=lambda: list(ALL_TASK_KINDS))
    model_task_kinds: dict[str, list[str]] = field(default_factory=dict)
    context_char_limit: int = 80000
    max_output_tokens: int = 4096
    timeout_s: int = 90
    # Legacy contract 1 requires explicit operator opt-in.
    accept_unenforced_output_limit: bool = False

    env_prefix = "IA_BBARU_CLI"

    @classmethod
    def from_env(cls):
        prefix = cls.env_prefix
        command = os.environ.get(f"{prefix}_BIN", "").strip()
        return cls(
            command=[command] if command else [],
            models=_list(f"{prefix}_MODELS"),
            task_kinds=_list(f"{prefix}_TASK_KINDS", ",".join(ALL_TASK_KINDS)),
            model_task_kinds=json.loads(os.environ.get(f"{prefix}_MODEL_TASK_KINDS", "{}")),
            context_char_limit=_int(f"{prefix}_CONTEXT_CHARS", 80000),
            max_output_tokens=_int(f"{prefix}_MAX_OUTPUT_TOKENS", 4096),
            timeout_s=_int(f"{prefix}_TIMEOUT_S", 90),
            accept_unenforced_output_limit=_flag(f"{prefix}_ACCEPT_UNENFORCED_OUTPUT_LIMIT"),
        )

    def validate(self):
        prefix = self.env_prefix
        unknown = set(self.task_kinds) - set(ALL_TASK_KINDS)
        if unknown or not self.task_kinds:
            raise RuntimeError(f"{prefix}_TASK_KINDS inválido")
        if not isinstance(self.model_task_kinds, dict):
            raise RuntimeError(f"{prefix}_MODEL_TASK_KINDS deve ser objeto JSON")
        for model, kinds in self.model_task_kinds.items():
            if (model not in self.models or not isinstance(kinds, list) or not 1 <= len(kinds) <= 5
                    or any(not isinstance(kind, str) or kind not in ALL_TASK_KINDS for kind in kinds)
                    or len(set(kinds)) != len(kinds)):
                raise RuntimeError(f"{prefix}_MODEL_TASK_KINDS inválido")
        if not 1000 <= self.context_char_limit <= 1_000_000:
            raise RuntimeError(f"{prefix}_CONTEXT_CHARS fora de 1000..1000000")
        if not 1 <= self.max_output_tokens <= 32768:
            raise RuntimeError(f"{prefix}_MAX_OUTPUT_TOKENS fora de 1..32768")
        # Leave margin so the gateway answers before the backend gives up.
        if not 5 <= self.timeout_s <= BACKEND_TIMEOUT_S - 10:
            raise RuntimeError(f"{prefix}_TIMEOUT_S deve ficar entre 5 e 110")
        if len(set(self.models)) != len(self.models) or len(self.models) > 100:
            raise RuntimeError(f"{prefix}_MODELS com duplicatas ou excesso")
        for model in self.models:
            # Plain names only: the value becomes a CLI argument.
            if not MODEL_NAME.fullmatch(model):
                raise RuntimeError(f"{prefix}_MODELS contém nome inválido")


@dataclass
class ClaudeCodeSettings(CliSettings):
    env_prefix = "IA_BBARU_CLAUDE_CODE"

    def validate(self):
        super().validate()
        for model in self.models:
            if not is_checkable(model):
                raise RuntimeError(
                    f"{self.env_prefix}_MODELS aceita sonnet, haiku, opus, fable ([1m] só em sonnet/opus/fable) "
                    "ou um nome completo claude-...; o modelo efetivo precisa ser conferível")

    def task_kinds_for(self, model):
        if model in self.model_task_kinds:
            return self.model_task_kinds[model]
        # Preserve the existing common TASK_KINDS override, when supplied.
        if self.task_kinds != list(ALL_TASK_KINDS):
            return self.task_kinds
        # "opus[1m]" and "claude-opus-5-5" get the opus profile.
        return DEFAULT_MODEL_TASK_KINDS.get(family(model) or "", self.task_kinds)


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
