"""ChatGPT plan through the official OpenAI Codex CLI (`codex exec`).

"Codex" here is OpenAI's terminal client, signed in with the user's own ChatGPT
account (Sign in with ChatGPT). It is not the Codex teammate of this project.

Checked against the official npm package @openai/codex 0.167.0 (`codex exec
--help`, `codex login status`, `codex features list`), without any account:

- `codex exec --json` prints JSONL events (thread.started, turn.started,
  item.completed, turn.completed with usage, turn.failed, error);
- `-` reads the prompt from stdin; `--ephemeral` keeps no session files;
  `--ignore-user-config` skips config.toml (and its MCP servers); `--ignore-rules`;
  `--skip-git-repo-check`; `--sandbox read-only`; `--disable <feature>`;
  `-o/--output-last-message <file>`;
- `codex login status` prints "Logged in using ChatGPT", "Not logged in" or
  another "Logged in using ..." (exit code 0 in all cases);
- tools: `--disable` turns off shell_tool, view_image, apps, plugins,
  browser/computer use, image generation, multi-agent and more, but
  **`unified_exec` (command execution) stays enabled whatever the flags**.
  Commands therefore remain possible inside the read-only sandbox, so the
  capability is `tools: restricted`. The backend currently plans only
  `tools: disabled`, so these models are listed but not eligible yet
  (decision for the backend, see integrations/docs/PASSAGEM_CLIS.md).

No output reports a stop/truncation reason and there is no output cap: every
result is `finish_reason: unknown`, `output_limit: none`.
"""
import json
import re
import tempfile
from pathlib import Path

from .. import errors
from ..config import OpenAICodexSettings
from ..contracts_v1_1 import ModelCapabilities
from ..prompt import build_cli_document
from ..runner import ProcessStartError, ProcessTimeout, run_process
from .base import CliAdapterBase, ConnectionStatus, NotStarted, ProviderResult, make_status, usage_or_none

PROVIDER = "chatgpt-codex"
REQUIRED_FLAGS = (
    "--json", "--ephemeral", "--ignore-user-config", "--ignore-rules", "--skip-git-repo-check",
    "--sandbox", "--disable", "--output-last-message", "--model", "--color",
)
# Features that touch the computer, the network or other apps. All verified to
# turn off with --disable in 0.167.0 except unified_exec (see module docstring).
DISABLED_FEATURES = (
    "shell_tool", "unified_exec", "unified_exec_tty", "view_image", "apps", "plugins",
    "remote_plugin", "browser_use", "browser_use_external", "browser_use_full_cdp_access",
    "computer_use", "image_generation", "in_app_browser", "in_app_local_automation",
    "multi_agent", "sleep_tool", "tool_suggest", "skill_search", "skill_mcp_dependency_install",
    "hooks", "goals", "workspace_dependencies", "code_mode_host",
    # Fail fast instead of retrying connections without limit (a hidden retry
    # turns a network error into a timeout, i.e. an uncertain outcome).
    "unbounded_connection_retries",
)
# Stays enabled whatever the flags in 0.167.0; the reason for `tools: restricted`.
KNOWN_ALWAYS_ON = {"unified_exec"}
CONFIG_OVERRIDES = (
    # Raw strings (no quotes needed): safe through the Windows .cmd shim.
    "web_search=disabled",
    "forced_login_method=chatgpt",
)
# JSONL item types that are only text. Anything else is a tool action.
TEXT_ITEMS = {"agent_message", "reasoning", "todo_list", "error"}
CAPABILITIES = ModelCapabilities(
    output_limit="none",                # no output cap in the CLI
    cancellation="local_process_only",
    finish_reason="inferred",           # never reported: results are always "unknown"
    billing="subscription_quota",       # forced_login_method=chatgpt, API keys stripped
    streaming=False,
    tools="restricted",                 # command execution cannot be disabled
)


class OpenAICodexAdapter(CliAdapterBase):
    provider = PROVIDER
    binary = "codex"
    capabilities = CAPABILITIES

    def __init__(self, settings: OpenAICodexSettings, runner=run_process):
        super().__init__(settings, runner)

    def label(self, model: str) -> str:
        return f"ChatGPT ({model}, Codex CLI) - assinatura"

    def _probe(self) -> ConnectionStatus:
        found, failure = self.probe_cli(
            ["exec", "--help"], REQUIRED_FLAGS,
            "Instale a Codex CLI oficial da OpenAI e confirme `codex --version` no terminal.")
        if failure:
            return failure
        command, installed = found
        unlocked = self.features_left_enabled(command)
        if unlocked:
            return make_status(
                PROVIDER, **{**installed, "missing_flags": unlocked}, reason="cli_version_unsupported",
                next_action="Esta versão da Codex CLI não desliga todos os recursos que o gateway exige.")
        try:
            auth = self.run_quick(command + ["login", "status"])
        except (ProcessStartError, ProcessTimeout):
            return make_status(PROVIDER, **installed, reason="auth_status_unknown",
                               next_action="Execute `codex login status` no terminal e confira o login.")
        text = (auth.stdout + "\n" + auth.stderr).strip()
        if "Logged in using ChatGPT" in text:
            return make_status(PROVIDER, **installed, logged_in=True, auth_method="chatgpt",
                               uses_subscription=True, ready=True)
        if "Not logged in" in text:
            return make_status(PROVIDER, **installed, logged_in=False, auth_method="none",
                               uses_subscription=False, reason="not_logged_in",
                               next_action="Rode `codex` no terminal e escolha Sign in with ChatGPT.")
        if "Logged in using" in text:
            return make_status(PROVIDER, **installed, logged_in=True, auth_method="other",
                               uses_subscription=False, reason="not_subscription_login",
                               next_action="O login ativo não é o do ChatGPT; rode `codex logout` e entre com Sign in with ChatGPT.")
        return make_status(PROVIDER, **installed, reason="auth_status_unknown",
                           next_action="Execute `codex login status` no terminal e confira o login.")

    def feature_flags(self) -> list[str]:
        args = []
        for feature in DISABLED_FEATURES:
            args += ["--disable", feature]
        for override in CONFIG_OVERRIDES:
            args += ["-c", override]
        return args

    def features_left_enabled(self, command) -> list[str]:
        """Ask the CLI itself (`codex features list`, no model call) whether the
        lockdown took effect. Returns the features still on, or missing."""
        try:
            listing = self.run_quick(command + ["features", "list"] + self.feature_flags())
        except (ProcessStartError, ProcessTimeout):
            return ["features list"]
        state = {}
        for line in listing.stdout.splitlines():
            parts = line.split()
            if len(parts) >= 2 and parts[-1] in {"true", "false"}:
                state[parts[0]] = parts[-1] == "true"
        if not state:
            return ["features list"]
        return [f for f in DISABLED_FEATURES
                if f not in KNOWN_ALWAYS_ON and (f not in state or state[f])]

    def build_args(self, model: str, last_message: Path) -> list[str]:
        args = self.command() + [
            "exec", "--json", "--ephemeral", "--ignore-user-config", "--ignore-rules",
            "--skip-git-repo-check", "--sandbox", "read-only", "--color", "never",
            "--model", model, "--output-last-message", str(last_message),
        ]
        return args + self.feature_flags() + ["-"]  # prompt from stdin

    def generate(self, request) -> ProviderResult:
        model = self.model_for(request.model_id)
        with tempfile.TemporaryDirectory(prefix="ia-bbaru-codex-") as folder:
            cwd = Path(folder) / "trabalho"
            cwd.mkdir()
            last_message = Path(folder) / "ultima-resposta.txt"
            try:
                proc = self.runner(self.build_args(model, last_message), build_cli_document(request),
                                   self.settings.timeout_s, self.child_env(), str(cwd))
            except ProcessStartError:
                raise NotStarted(errors.provider_unavailable("provider_cli_not_runnable"))
            except ProcessTimeout:
                raise errors.provider_timeout()
            final = last_message.read_text(encoding="utf-8", errors="replace") if last_message.exists() else None
        return self.parse(proc, final)

    def parse(self, proc, final_message: str | None) -> ProviderResult:
        messages, failures, notices = [], [], []
        usage = None
        seen_event = completed = tool_used = False
        for line in proc.stdout.splitlines():
            line = line.strip()
            if not line.startswith("{"):
                continue
            try:
                event = json.loads(line)
            except ValueError:
                continue
            if not isinstance(event, dict):
                continue
            seen_event = True
            kind = event.get("type")
            item = event.get("item") if isinstance(event.get("item"), dict) else {}
            if kind == "item.completed":
                if item.get("type") == "agent_message" and isinstance(item.get("text"), str):
                    messages.append(item["text"])
                elif item.get("type") == "error":
                    notices.append(str(item.get("message", "")))
                elif item.get("type") not in TEXT_ITEMS:
                    tool_used = True
            elif kind in {"item.started", "item.updated"} and item.get("type") not in TEXT_ITEMS:
                tool_used = True
            elif kind == "turn.completed":
                completed = True
                if isinstance(event.get("usage"), dict):
                    raw = event["usage"]
                    usage = usage_or_none(raw.get("input_tokens", 0), raw.get("output_tokens", 0))
            elif kind == "turn.failed":
                error = event.get("error") if isinstance(event.get("error"), dict) else {}
                failures.append(str(error.get("message", "")))
            elif kind == "error":
                # Also emitted for transient reconnects that later succeed.
                notices.append(str(event.get("message", "")))
        if not seen_event:
            raise classify_failure("") if proc.returncode != 0 else errors.provider_error("provider_invalid_output")
        if failures or not completed or proc.returncode != 0:
            raise classify_failure(" ".join(failures + notices[-3:]))
        if tool_used:
            # A tool ran (or was attempted) despite the instructions: not a plain answer.
            raise errors.provider_error()
        output = final_message if final_message and final_message.strip() else (messages[-1] if messages else "")
        if not output.strip():
            raise errors.provider_error("provider_empty_output")
        if len(output) > 100000:
            raise errors.provider_error("provider_output_too_large")
        return ProviderResult(output=output, usage=usage, finish_reason="unknown")


AUTH_FAILURE = re.compile(
    r"not logged in|unauthorized|status(?: code)? 401|\b401 unauthorized|token (?:has )?expired|"
    r"please (?:log|sign) ?in|refresh token", re.IGNORECASE)
QUOTA_FAILURE = re.compile(
    r"usage limit|rate limit|too many requests|status(?: code)? 429|\b429 too many|quota", re.IGNORECASE)


def classify_failure(text: str) -> errors.GatewayError:
    """Phrases only, never bare numbers: timestamps and ids contain digits."""
    if AUTH_FAILURE.search(text or ""):
        return errors.provider_unavailable(
            "provider_not_authenticated",
            "Rode `codex` no terminal e entre de novo com Sign in with ChatGPT.")
    if QUOTA_FAILURE.search(text or ""):
        return errors.quota_exceeded()
    return errors.provider_error()
