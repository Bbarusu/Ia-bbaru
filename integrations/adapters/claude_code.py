"""Adapter for the official, unmodified Claude Code CLI using the user's own login.

What it does:
- runs `claude -p --output-format json` locally, with no tools, no MCP servers,
  no customizations (--safe-mode), no saved session, inside an empty directory;
- uses only the login the user completed through Anthropic's own flow; it never
  reads, copies or forwards credential files or tokens;
- removes ANTHROPIC_API_KEY and cloud-provider variables from the child
  environment so a run never silently switches to paid API billing;
- checks login with the documented `claude auth status --json`;
- forbids model substitution (CLAUDE_CODE_NO_MODEL_FALLBACK=1, no
  --fallback-model) and rejects a run whose `modelUsage` shows output from a
  model other than the configured one (see integrations/models.py).

What it cannot guarantee (see integrations/docs/PROPOSTA_CAPACIDADES.md):
- a hard output-token cap: CLAUDE_CODE_MAX_OUTPUT_TOKENS is best effort;
- provider-side cancellation: killing the process does not limit billing/quota;
- documented completion: `stop_reason` exists in the CLI's result schema but
  not in its public docs; without it the completion is reported as unknown.
"""
import json
import tempfile
from dataclasses import replace

from backend.contracts import ModelProfile, TokenUsage

from .. import errors
from ..config import ClaudeCodeSettings
from ..contracts_v1_1 import ModelCapabilities, ModelProfileV11
from ..models import served_pattern
from ..prompt import CLI_ARGUMENT_PROMPT, SYSTEM_PROMPT, build_user_prompt
from ..runner import ProcessStartError, ProcessTimeout, child_env, run_process
from .base import (  # noqa: F401  (re-exported for existing imports)
    STATUS_TTL_NOT_READY_S, STATUS_TTL_S, CliAdapterBase, ConnectionStatus, NotStarted,
    ProviderResult, make_status, time,
)

PROVIDER = "claude-code"
# Flags this adapter passes; all listed by `claude --help` in v2.1.319.
REQUIRED_FLAGS = (
    "--print", "--output-format", "--model", "--system-prompt", "--tools",
    "--strict-mcp-config", "--safe-mode", "--no-session-persistence",
    "--disable-slash-commands", "--permission-prompts",
)
SUBSCRIPTION_AUTH = {"claude.ai", "oauth_token"}
STOP_REASONS_COMPLETE = {"end_turn", "stop_sequence"}
CAPABILITIES = ModelCapabilities(
    output_limit="best_effort",        # CLAUDE_CODE_MAX_OUTPUT_TOKENS, "most requests"
    cancellation="local_process_only",  # killing the CLI does not refund quota
    finish_reason="reported",           # stop_reason from the CLI result; else unknown
    billing="subscription_quota",       # API-key variables are stripped from the child
    streaming=False,
    tools="disabled",
)


class ClaudeCodeAdapter(CliAdapterBase):
    provider = PROVIDER
    binary = "claude"
    supports_v1 = True  # behind the operator's legacy flag, see v1_gate()
    capabilities = CAPABILITIES

    def __init__(self, settings: ClaudeCodeSettings, runner=run_process):
        super().__init__(settings, runner)

    def label(self, model: str) -> str:
        return f"Claude Code ({model}) - assinatura"

    def _probe(self) -> ConnectionStatus:
        def result(**kw):
            return make_status(PROVIDER, **kw)

        found, failure = self.probe_cli(
            ["--help"], REQUIRED_FLAGS,
            "Instale o Claude Code oficial e confirme `claude --version` no terminal.")
        if failure:
            return failure
        command, installed = found
        try:
            auth = self.run_quick(command + ["auth", "status", "--json"])
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

    def profiles(self) -> list[ModelProfile]:
        """Contract 1 catalog (unchanged shape)."""
        ready = self.v1_gate().ready if self.settings.models else False
        return [ModelProfile(**self.profile_fields(m), available=ready) for m in self.settings.models]

    def profiles_v11(self) -> list[ModelProfileV11]:
        """Contract 1.1 catalog: transport availability plus real capabilities."""
        status = self.status() if self.settings.models else None
        return [ModelProfileV11(
            **self.profile_fields(m), available=status.ready,
            capabilities=CAPABILITIES,
            unavailable_reason=None if status.ready else status.reason,
        ) for m in self.settings.models]

    # ----- generation -----

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
        env = child_env({
            "CLAUDE_CODE_MAX_OUTPUT_TOKENS": str(request.max_output_tokens),
            # Official switch (2.1.307+) against overload/access/refusal fallback.
            # Older or newer CLIs that ignore it are still caught by served_model().
            "CLAUDE_CODE_NO_MODEL_FALLBACK": "1",
        })
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
        served = served_model(model, data.get("modelUsage"))
        return ProviderResult(output=result, usage=_usage(data.get("usage")),
                              finish_reason=finish_reason_from(data), served_model=served)


def served_model(model: str, model_usage) -> str:
    """The served model ID, from the CLI's own `modelUsage` keys.

    - no `modelUsage` → provider_invalid_output: without it nothing shows which
      model answered (the field is in the result schema of 2.1.307 and 2.1.322);
    - any output tokens from a model outside the configured one →
      provider_model_mismatch, even next to the configured model (a fallback
      that answered part of the turn is still a fallback);
    - entries with zero output tokens from other models are ignored;
    - the configured model must itself appear.
    A configured alias accepts any version of its family; which one served is
    returned so it can be exposed once the contract has a field for it.
    """
    if not isinstance(model_usage, dict) or not model_usage:
        raise errors.provider_error("provider_invalid_output")
    pattern = served_pattern(model)
    served = None
    for key, usage in model_usage.items():
        name = str(key)[:100]
        if pattern.fullmatch(name):
            served = served or name
            continue
        produced = usage.get("outputTokens") if isinstance(usage, dict) else None
        if not isinstance(produced, int) or isinstance(produced, bool) or produced != 0:
            raise errors.provider_error("provider_model_mismatch")
    if served is None:
        raise errors.provider_error("provider_model_mismatch")
    return served


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
    # Model-specific refusals (seen in 2.1.322): a model that needs usage credits
    # (e.g. Fable on some plans), substitution blocked by
    # CLAUDE_CODE_NO_MODEL_FALLBACK, or a model the account cannot use. None of
    # them is billed to API credits here and none is retried.
    if "usage credits" in lowered or "requires usage credits" in lowered:
        return errors.provider_unavailable(
            "provider_unavailable",
            "Este modelo exige créditos de uso na sua conta. Confira `/model` no Claude Code; "
            "não habilite créditos só para o Ia-bbaru sem decidir isso conscientemente.",
        )
    if ("model substitution is disabled" in lowered or "forbids model substitution" in lowered
            or "issue with the selected model" in lowered or "may not have access" in lowered):
        return errors.provider_unavailable(
            "provider_unavailable",
            "O modelo configurado não está disponível para esta conta agora e a troca automática "
            "está desligada. Confira `/model` no Claude Code e os modelos configurados.",
        )
    if any(s in lowered for s in ("/login", "not logged in", "invalid api key", "authentication", "oauth")):
        return errors.provider_unavailable(
            "provider_not_authenticated",
            "Abra `claude` no terminal e faça login novamente pelo fluxo oficial (/login).",
        )
    if any(s in lowered for s in ("usage limit", "limit reached", "rate limit", "quota", "resets")):
        return errors.quota_exceeded()
    return errors.provider_error()
