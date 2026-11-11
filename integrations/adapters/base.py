"""CLI infrastructure used by the Claude Code adapter."""
import shutil
import sys
import tempfile
import threading
import time
from dataclasses import asdict, dataclass, replace
from pathlib import Path

from backend.contracts import TokenUsage
from backend.contracts_v1_1 import ModelProfileV11

from .. import errors
from ..prompt import input_chars
from ..runner import ProcessStartError, ProcessTimeout, child_env

STATUS_TTL_S = 30
# Re-check sooner while not ready, so a login done in the terminal shows up quickly.
STATUS_TTL_NOT_READY_S = 5
# `--version`/`--help` change only when the CLI is updated: reuse them between
# status checks (a forced refresh asks again). Keeps the catalog fast on Windows.
CLI_FACTS_TTL_S = 300
CHARS_PER_TOKEN_RESERVE = 4


@dataclass
class ConnectionStatus:
    provider: str
    installed: bool
    version: str | None
    missing_flags: list[str]
    logged_in: bool | None
    auth_method: str | None
    uses_subscription: bool | None
    ready: bool
    reason: str | None
    next_action: str | None
    # Why a probe failed (exit code, OS error, timeout). Local diagnostics only.
    detail: str | None = None

    def as_dict(self):
        return asdict(self)


@dataclass
class ProviderResult:
    output: str
    usage: TokenUsage | None
    finish_reason: str  # stop | length | unknown
    # Model the CLI reports as having served the run. Internal only: contracts
    # 1 and 1.1 have no field for it (proposal in docs/PASSAGEM_CLAUDE_ONLY.md).
    served_model: str | None = None


class NotStarted(Exception):
    """The provider process never started: the request_id may be reused."""

    def __init__(self, error):
        super().__init__(error.code)
        self.error = error


def first_line(text: str) -> str:
    return (text or "").strip().splitlines()[0][:80] if (text or "").strip() else ""


def make_status(provider, **kw) -> ConnectionStatus:
    base = dict(provider=provider, installed=False, version=None, missing_flags=[],
                logged_in=None, auth_method=None, uses_subscription=None,
                ready=False, reason=None, next_action=None, detail=None)
    base.update(kw)
    return ConnectionStatus(**base)


class CliAdapterBase:
    """Command resolution, cached status and profile helpers."""

    provider = ""
    binary = ""
    supports_v1 = False  # contract 1 needs an enforced cap and a reported finish
    capabilities = None  # ModelCapabilities declared by each adapter

    def __init__(self, settings, runner):
        self.settings = settings
        self.runner = runner
        self._status: ConnectionStatus | None = None
        self._status_at = 0.0
        self._status_lock = threading.Lock()

    def command(self) -> list[str] | None:
        if self.settings.command:
            # The CLI runs inside a temporary directory, so relative paths
            # given by the operator are resolved against the gateway's cwd.
            return [str(Path(part).resolve()) if Path(part).exists() else part
                    for part in self.settings.command]
        if sys.platform == "win32":
            # npm also installs an extensionless bash script next to the .cmd
            # shim; Windows cannot run it. Prefer real Windows executables.
            for name in (f"{self.binary}.exe", f"{self.binary}.cmd", f"{self.binary}.bat"):
                found = shutil.which(name)
                if found:
                    return [found]
        found = shutil.which(self.binary)
        return [found] if found else None

    def child_env(self, extra: dict | None = None) -> dict:
        return child_env(extra)

    def run_quick(self, args: list[str], timeout_s=20):
        with tempfile.TemporaryDirectory(prefix="ia-bbaru-cli-") as cwd:
            return self.runner(args, "", timeout_s, self.child_env(), cwd)

    def status(self, refresh=False) -> ConnectionStatus:
        with self._status_lock:
            ttl = STATUS_TTL_S if self._status and self._status.ready else STATUS_TTL_NOT_READY_S
            if not refresh and self._status and time.monotonic() - self._status_at < ttl:
                return self._status
            if refresh:
                self.__dict__.pop("_cli_facts", None)
            self._status = self._probe()
            self._status_at = time.monotonic()
            return self._status

    def probe_cli(self, help_args: list[str], required_flags, not_installed_action):
        """Common first steps: installed, runnable, required flags present."""
        command = self.command()
        if not command:
            return None, make_status(self.provider, reason="cli_not_installed", next_action=not_installed_action)
        facts = self.__dict__.get("_cli_facts")
        if facts and facts[0] == tuple(command) and time.monotonic() - facts[1] < CLI_FACTS_TTL_S:
            return (command, dict(facts[2])), None
        program = Path(command[-1]).name if len(command) == 1 else " ".join(Path(c).name for c in command)
        try:
            version = self.run_quick(command + ["--version"])
            helptext = self.run_quick(command + help_args)
        except ProcessStartError as exc:
            return None, make_status(self.provider, reason="cli_not_runnable", next_action=not_installed_action,
                                     detail=f"{program}: não pôde ser executado ({exc})")
        except ProcessTimeout:
            return None, make_status(self.provider, reason="cli_not_runnable", next_action=not_installed_action,
                                     detail=f"{program}: --version ou --help demorou mais de 20 s")
        if version.returncode != 0:
            return None, make_status(self.provider, reason="cli_not_runnable", next_action=not_installed_action,
                                     detail=f"{program} --version terminou com código {version.returncode}")
        text = helptext.stdout + helptext.stderr
        missing = [flag for flag in required_flags if flag not in text]
        installed = dict(installed=True, version=first_line(version.stdout or version.stderr),
                         missing_flags=missing)
        if missing:
            return None, make_status(self.provider, **installed, reason="cli_version_unsupported",
                                     next_action="Atualize a CLI; esta versão não oferece as opções necessárias.")
        self._cli_facts = (tuple(command), time.monotonic(), dict(installed))
        return (command, installed), None

    def profile_id(self, model: str) -> str:
        return f"{self.provider}:{model}"

    def model_for(self, model_id: str) -> str | None:
        for model in self.settings.models:
            if self.profile_id(model) == model_id:
                return model
        return None

    def profile_fields(self, model: str) -> dict:
        return dict(
            id=self.profile_id(model), provider=self.provider, label=self.label(model),
            task_kinds=self.settings.task_kinds_for(model),
            context_char_limit=self.settings.context_char_limit,
            max_output_tokens=self.settings.max_output_tokens,
        )

    def label(self, model: str) -> str:
        return f"{self.provider} ({model})"

    def profiles(self) -> list:
        """Contract 1 catalog. Adapters that cannot honour contract 1 list nothing."""
        return []

    def profiles_v11(self) -> list[ModelProfileV11]:
        """Contract 1.1 catalog: transport availability plus real capabilities."""
        if not self.settings.models:
            return []
        status = self.status()
        return [ModelProfileV11(
            **self.profile_fields(m), available=status.ready, capabilities=self.capabilities,
            unavailable_reason=None if status.ready else status.reason,
        ) for m in self.settings.models]

    def check_request(self, request):
        """Validation that must happen before any provider call (v1 and 1.1)."""
        if self.model_for(request.model_id) is None:
            raise errors.unknown_model()
        if request.max_output_tokens > self.settings.max_output_tokens:
            raise errors.invalid_request("max_output_tokens_above_profile",
                                         "max_output_tokens acima do perfil do modelo")
        if request.role == "review" and not request.previous_output:
            raise errors.invalid_request("missing_previous_output", "Revisão exige previous_output")
        reserve = request.max_output_tokens * CHARS_PER_TOKEN_RESERVE
        if input_chars(request) + reserve > self.settings.context_char_limit:
            raise errors.context_too_large()
        if request.protocol_version == "1.1":
            # Acceptance belongs to the task, not to the operator's env flag.
            if not request.allow_unenforced_output_limit and self.capabilities.output_limit != "enforced":
                raise errors.output_limit_not_accepted()
            status = self.status()
        else:
            status = self.v1_gate()
        if not status.ready:
            raise errors.provider_unavailable(f"provider_{status.reason}", status.next_action)

    def v1_gate(self) -> ConnectionStatus:
        status = self.status()
        if status.ready and not self.supports_v1:
            return replace(status, ready=False, reason="contract_1_not_supported",
                           next_action="Use o contrato 1.1 (GATEWAY_PROTOCOL_VERSION=1.1).")
        return status


def usage_or_none(input_tokens, output_tokens) -> TokenUsage | None:
    try:
        return TokenUsage(input_tokens=int(input_tokens), output_tokens=int(output_tokens))
    except (TypeError, ValueError):
        return None
