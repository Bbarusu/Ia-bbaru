"""Adapter for the official, unmodified Claude Code CLI using the user's own login.

What it does:
- runs `claude -p --output-format json` locally, with no tools, no MCP servers,
  no customizations (--safe-mode), no saved session, inside an empty directory;
- uses only the login the user completed through Anthropic's own flow; it never
  reads, copies or forwards credential files or tokens;
- removes ANTHROPIC_API_KEY and cloud-provider variables from the child
  environment so a run never silently switches to paid API billing;
- checks login with the documented `claude auth status --json`.

What it cannot guarantee (see integrations/docs/PROPOSTA_CAPACIDADES.md):
- a hard output-token cap: CLAUDE_CODE_MAX_OUTPUT_TOKENS is best effort;
- provider-side cancellation: killing the process does not limit billing/quota;
- documented completion: `stop_reason` exists in the CLI's result schema but
  not in its public docs; without it the completion is reported as unknown.
"""
import json
import shutil
import tempfile
import threading
import time
from dataclasses import asdict, dataclass, replace
from pathlib import Path

from backend.contracts import ModelProfile, TokenUsage

from .. import errors
from ..config import ClaudeCodeSettings
from ..contracts_v1_1 import ModelCapabilities, ModelProfileV11
from ..prompt import CLI_ARGUMENT_PROMPT, SYSTEM_PROMPT, build_user_prompt, input_chars
from ..runner import ProcessStartError, ProcessTimeout, child_env, run_process

PROVIDER = "claude-code"
# Flags this adapter passes; all listed by `claude --help` in v2.1.319.
REQUIRED_FLAGS = (
    "--print", "--output-format", "--model", "--system-prompt", "--tools",
    "--strict-mcp-config", "--safe-mode", "--no-session-persistence",
    "--disable-slash-commands", "--permission-prompts",
)
SUBSCRIPTION_AUTH = {"claude.ai", "oauth_token"}
CHARS_PER_TOKEN_RESERVE = 4
STATUS_TTL_S = 30
STOP_REASONS_COMPLETE = {"end_turn", "stop_sequence"}
CAPABILITIES = ModelCapabilities(
    output_limit="best_effort",        # CLAUDE_CODE_MAX_OUTPUT_TOKENS, "most requests"
    cancellation="local_process_only",  # killing the CLI does not refund quota
    finish_reason="reported",           # stop_reason from the CLI result; else unknown
    billing="subscription_quota",       # API-key variables are stripped from the child
    streaming=False,
    tools="disabled",
)


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

    def as_dict(self):
        return asdict(self)


def _first_line(text: str) -> str:
    return (text or "").strip().splitlines()[0][:80] if (text or "").strip() else ""


class ClaudeCodeAdapter:
    provider = PROVIDER

    def __init__(self, settings: ClaudeCodeSettings, runner=run_process):
        self.settings = settings
        self.runner = runner
        self._status: ConnectionStatus | None = None
        self._status_at = 0.0
        self._status_lock = threading.Lock()

    # ----- discovery (no model calls, no credential files) -----

    def command(self) -> list[str] | None:
        if self.settings.command:
            # The CLI runs inside a temporary directory, so relative paths
            # given by the operator are resolved against the gateway's cwd.
            return [str(Path(part).resolve()) if Path(part).exists() else part
                    for part in self.settings.command]
        found = shutil.which("claude")
        return [found] if found else None

    def _run_quick(self, args: list[str], timeout_s=20):
        with tempfile.TemporaryDirectory(prefix="ia-bbaru-cc-") as cwd:
            return self.runner(args, "", timeout_s, child_env(), cwd)

    def status(self, refresh=False) -> ConnectionStatus:
        with self._status_lock:
            if not refresh and self._status and time.monotonic() - self._status_at < STATUS_TTL_S:
                return self._status
            self._status = self._probe()
            self._status_at = time.monotonic()
            return self._status

    def _probe(self) -> ConnectionStatus:
        def result(**kw):
            base = dict(provider=PROVIDER, installed=False, version=None, missing_flags=[],
                        logged_in=None, auth_method=None, uses_subscription=None,
                        ready=False, reason=None, next_action=None)
            base.update(kw)
            return ConnectionStatus(**base)

        command = self.command()
        if not command:
            return result(reason="cli_not_installed",
                          next_action="Instale o Claude Code oficial e confirme `claude --version` no terminal.")
        try:
            version = self._run_quick(command + ["--version"])
            helptext = self._run_quick(command + ["--help"])
        except (ProcessStartError, ProcessTimeout):
            return result(reason="cli_not_runnable",
                          next_action="Verifique a instalação do Claude Code (`claude --version`).")
        if version.returncode != 0:
            return result(reason="cli_not_runnable",
                          next_action="Verifique a instalação do Claude Code (`claude --version`).")
        missing = [flag for flag in REQUIRED_FLAGS if flag not in helptext.stdout]
        installed = dict(installed=True, version=_first_line(version.stdout), missing_flags=missing)
        if missing:
            return result(**installed, reason="cli_version_unsupported",
                          next_action="Atualize o Claude Code; esta versão não oferece as opções necessárias.")
        try:
            auth = self._run_quick(command + ["auth", "status", "--json"])
            data = json.loads(auth.stdout)
            logged_in = bool(data.get("loggedIn"))
            method = str(data.get("authMethod") or "none")[:40]
        except (ProcessStartError, ProcessTimeout, ValueError, AttributeError):
            return result(**installed, reason="auth_status_unknown",
                          next_action="Execute `claude auth status` no terminal e confira o login.")
        subscription = method in SUBSCRIPTION_AUTH
        login = dict(logged_in=logged_in, auth_method=method, uses_subscription=subscription)
        if not logged_in:
            return result(**installed, **login, reason="not_logged_in",
                          next_action="Abra `claude` no terminal e faça login com sua conta pelo fluxo oficial (/login).")
        if not subscription:
            return result(**installed, **login, reason="not_subscription_login",
                          next_action="O login ativo não é por assinatura; faça /login com a conta Claude para não usar cobrança de API.")
        # Transport ready. Whether a task may use it depends on the contract
        # version: see v1_gate() and the per-request acceptance in 1.1.
        return result(**installed, **login, ready=True)

    def v1_gate(self) -> ConnectionStatus:
        """Contract 1 promises a hard output cap, which this CLI cannot give.
        Its models stay unavailable there unless the operator opted in."""
        status = self.status()
        if status.ready and not self.settings.accept_unenforced_output_limit:
            return replace(
                status, ready=False, reason="output_limit_not_enforced",
                next_action=("O contrato 1 exige teto de saída garantido e o Claude Code não o garante. "
                             "Use o contrato 1.1 com aceite por tarefa ou defina "
                             "IA_BBARU_CLAUDE_CODE_ACCEPT_UNENFORCED_OUTPUT_LIMIT=1 conscientemente."))
        return status

    def profile_id(self, model: str) -> str:
        return f"{PROVIDER}:{model}"

    def _profile_fields(self, model: str) -> dict:
        return dict(
            id=self.profile_id(model), provider=PROVIDER,
            label=f"Claude Code ({model}) - assinatura",
            task_kinds=self.settings.task_kinds,
            context_char_limit=self.settings.context_char_limit,
            max_output_tokens=self.settings.max_output_tokens,
        )

    def profiles(self) -> list[ModelProfile]:
        """Contract 1 catalog (unchanged shape)."""
        ready = self.v1_gate().ready if self.settings.models else False
        return [ModelProfile(**self._profile_fields(m), available=ready) for m in self.settings.models]

    def profiles_v11(self) -> list[ModelProfileV11]:
        """Contract 1.1 catalog: transport availability plus real capabilities."""
        status = self.status() if self.settings.models else None
        return [ModelProfileV11(
            **self._profile_fields(m), available=status.ready,
            capabilities=CAPABILITIES,
            unavailable_reason=None if status.ready else status.reason,
        ) for m in self.settings.models]

    def model_for(self, model_id: str) -> str | None:
        for model in self.settings.models:
            if self.profile_id(model) == model_id:
                return model
        return None

    # ----- generation -----

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
            if not request.allow_unenforced_output_limit:
                raise errors.output_limit_not_accepted()
            status = self.status()
        else:
            status = self.v1_gate()
        if not status.ready:
            raise errors.provider_unavailable(f"provider_{status.reason}", status.next_action)

    def build_args(self, model: str) -> list[str]:
        return self.command() + [
            "--print", CLI_ARGUMENT_PROMPT,
            "--output-format", "json",
            "--model", model,
            "--system-prompt", SYSTEM_PROMPT,
            "--tools", "",
            "--strict-mcp-config",
            "--safe-mode",
            "--no-session-persistence",
            "--disable-slash-commands",
            "--permission-prompts", "none",
        ]

    def generate(self, request) -> "ProviderResult":
        """Call the CLI once. NotStarted means the process never ran."""
        model = self.model_for(request.model_id)
        env = child_env({"CLAUDE_CODE_MAX_OUTPUT_TOKENS": str(request.max_output_tokens)})
        with tempfile.TemporaryDirectory(prefix="ia-bbaru-cc-") as cwd:
            try:
                proc = self.runner(self.build_args(model), build_user_prompt(request),
                                   self.settings.timeout_s, env, cwd)
            except ProcessStartError:
                raise NotStarted(errors.provider_unavailable("provider_cli_not_runnable"))
            except ProcessTimeout:
                raise errors.provider_timeout()
        return self.parse(model, proc)

    def parse(self, model: str, proc) -> "ProviderResult":
        try:
            data = json.loads(proc.stdout)
            if not isinstance(data, dict):
                raise ValueError
        except ValueError:
            raise errors.provider_error("provider_invalid_output")
        result = data.get("result")
        if data.get("is_error") or proc.returncode != 0 or not isinstance(result, str):
            raise classify_failure(result if isinstance(result, str) else "")
        if not result.strip():
            raise errors.provider_error("provider_empty_output")
        if len(result) > 100000:
            raise errors.provider_error("provider_output_too_large")
        self._check_model(model, data.get("modelUsage"))
        return ProviderResult(output=result, usage=_usage(data.get("usage")),
                              finish_reason=finish_reason_from(data))

    @staticmethod
    def _check_model(model: str, model_usage):
        """With a full model name configured, reject a run served by another model."""
        if not model.startswith("claude-") or not isinstance(model_usage, dict) or not model_usage:
            return
        if not any(str(key).startswith(model) for key in model_usage):
            raise errors.provider_error("provider_model_mismatch")


@dataclass
class ProviderResult:
    output: str
    usage: TokenUsage | None
    finish_reason: str  # stop | length | unknown


class NotStarted(Exception):
    """The provider process never started: the request_id may be reused."""

    def __init__(self, error: errors.GatewayError):
        super().__init__(error.code)
        self.error = error


def _usage(raw) -> TokenUsage | None:
    if not isinstance(raw, dict):
        return None
    try:
        input_tokens = sum(int(raw.get(k) or 0) for k in (
            "input_tokens", "cache_creation_input_tokens", "cache_read_input_tokens"))
        return TokenUsage(input_tokens=input_tokens, output_tokens=int(raw.get("output_tokens") or 0))
    except (TypeError, ValueError):
        return None


def finish_reason_from(data: dict) -> str:
    """Only the provider's own stop_reason counts as evidence.

    `stop_reason` is part of the result schema embedded in the CLI (seen in
    v2.1.319, nullable) but not in the public headless docs. Absent, null or
    any other value (refusal, pause_turn, ...) means completion is unconfirmed.
    Token counts are never used to guess truncation.
    """
    reason = data.get("stop_reason")
    if reason in STOP_REASONS_COMPLETE:
        return "stop"
    if reason == "max_tokens":
        return "length"
    return "unknown"


def classify_failure(text: str) -> errors.GatewayError:
    lowered = text.lower()
    if any(s in lowered for s in ("/login", "not logged in", "invalid api key", "authentication", "oauth")):
        return errors.provider_unavailable(
            "provider_not_authenticated",
            "Abra `claude` no terminal e faça login novamente pelo fluxo oficial (/login).",
        )
    if any(s in lowered for s in ("usage limit", "limit reached", "rate limit", "quota", "resets")):
        return errors.quota_exceeded()
    return errors.provider_error()
