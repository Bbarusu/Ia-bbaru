"""Google account through the official Gemini CLI (`gemini -p`).

Checked against the official npm package @google/gemini-cli 0.67.0 by reading
its bundled code (not executed here, no account):

- `--prompt/-p` runs headless and is appended to stdin; `--output-format json`
  prints {"session_id", "response", "stats", "error", "warnings"};
  exit code 41 = authentication error;
- tools: the Policy Engine matches every tool with `toolName = "*"`; a deny rule
  loaded with `--admin-policy` (admin tier) and `--policy` (user tier) blocks all
  tool calls, MCP included. `--extensions none` loads no extension,
  `--allowed-mcp-server-names` with an unknown name starts no MCP server, and an
  untrusted folder (the empty temporary directory) disables MCP as well;
- headless runs require a trusted folder: `--skip-trust` trusts only the empty
  temporary directory, for this run (without it the CLI exits with code 55);
- `GOOGLE_GENAI_USE_GCA=true` selects Login with Google when the user's own
  settings select nothing; API-key variables are stripped. The CLI only reads
  system settings from an admin-owned folder, so the gateway cannot *force*
  Google login: if the user configured the Gemini CLI itself to use an API key,
  that choice would apply. Documented for the user; never configure one;
- `GEMINI_SYSTEM_MD` replaces the agent's system prompt with ours;
- `@path` in the input is expanded into file contents, so the document is sent
  with `@` escaped (see prompt.build_cli_document);
- no status command tells whether the user is logged in without reading the
  credential files, which this project must not read. The operator states it with
  IA_BBARU_GEMINI_CLI_LOGIN=google after logging in; a missing login still fails
  safely at generation time (exit 41, no model call).

No stop/truncation reason in the headless output and no output cap: every result
is `finish_reason: unknown`, `output_limit: none`. A tool that actually ran
(`stats.tools.totalSuccess > 0`) or an answer served by another model (automatic
fallback) is refused.
"""
import json
import re
import tempfile
from pathlib import Path

from .. import errors
from ..config import GeminiCliSettings
from ..contracts_v1_1 import ModelCapabilities
from ..prompt import CLI_ARGUMENT_PROMPT, SYSTEM_PROMPT, build_user_prompt
from ..runner import ProcessStartError, ProcessTimeout, run_process
from .base import CliAdapterBase, ConnectionStatus, NotStarted, ProviderResult, make_status, usage_or_none

PROVIDER = "gemini-cli"
REQUIRED_FLAGS = (
    "--prompt", "--output-format", "--model", "--extensions", "--allowed-mcp-server-names",
    "--admin-policy", "--policy", "--approval-mode", "--skip-trust",
)
AUTH_EXIT_CODE = 41
DENY_ALL_POLICY = """# Ia-bbaru: no tool may run. Matches every tool, MCP included.
[[rule]]
toolName = "*"
decision = "deny"
priority = 999
"""
NO_MCP_SERVER = "ia-bbaru-nenhum-servidor"
CAPABILITIES = ModelCapabilities(
    output_limit="none",
    cancellation="local_process_only",
    finish_reason="inferred",       # never reported in headless output: always "unknown"
    billing="subscription_quota",   # Login with Google selected, API-key variables stripped
    streaming=False,
    tools="disabled",               # deny-all policy; refused if a tool still ran
)
AUTH_FAILURE = re.compile(r"auth|login|credential|unauthenticated|permission_denied", re.IGNORECASE)
QUOTA_FAILURE = re.compile(r"resource_exhausted|quota|rate limit|too many requests|usage limit", re.IGNORECASE)


class GeminiCliAdapter(CliAdapterBase):
    provider = PROVIDER
    binary = "gemini"
    capabilities = CAPABILITIES

    def __init__(self, settings: GeminiCliSettings, runner=run_process):
        super().__init__(settings, runner)

    def label(self, model: str) -> str:
        return f"Gemini ({model}) - conta Google"

    def _probe(self) -> ConnectionStatus:
        found, failure = self.probe_cli(
            ["--help"], REQUIRED_FLAGS,
            "Instale a Gemini CLI oficial e confirme `gemini --version` no terminal.")
        if failure:
            return failure
        _command, installed = found
        if not self.settings.login_confirmed:
            return make_status(
                PROVIDER, **installed, reason="auth_status_unknown",
                next_action=("Rode `gemini` no terminal, escolha Login with Google e depois "
                             "defina IA_BBARU_GEMINI_CLI_LOGIN=google ao iniciar o gateway."))
        # Stated by the operator; verified for real only by the first generation.
        return make_status(PROVIDER, **installed, logged_in=True, auth_method="oauth-personal",
                           uses_subscription=True, ready=True)

    def build_args(self, model: str, policy_dir: Path) -> list[str]:
        return self.command() + [
            "--skip-trust",  # trusts only the empty temporary folder, for this run
            "--prompt", CLI_ARGUMENT_PROMPT,
            "--output-format", "json",
            "--model", model,
            "--extensions", "none",
            "--allowed-mcp-server-names", NO_MCP_SERVER,
            "--admin-policy", str(policy_dir),
            "--policy", str(policy_dir),
            "--approval-mode", "default",
        ]

    def generate(self, request) -> ProviderResult:
        model = self.model_for(request.model_id)
        with tempfile.TemporaryDirectory(prefix="ia-bbaru-gemini-") as folder:
            base = Path(folder)
            cwd = base / "trabalho"
            policy_dir = base / "politicas"
            cwd.mkdir()
            policy_dir.mkdir()
            (policy_dir / "ia-bbaru-sem-ferramentas.toml").write_text(DENY_ALL_POLICY, encoding="utf-8")
            system_file = base / "system.md"
            system_file.write_text(SYSTEM_PROMPT, encoding="utf-8")
            env = self.child_env({"GOOGLE_GENAI_USE_GCA": "true",
                                  "GEMINI_SYSTEM_MD": str(system_file), "NO_COLOR": "1"})
            document = build_user_prompt(request).replace("@", "\\u0040")
            try:
                proc = self.runner(self.build_args(model, policy_dir), document,
                                   self.settings.timeout_s, env, str(cwd))
            except ProcessStartError:
                raise NotStarted(errors.provider_unavailable("provider_cli_not_runnable"))
            except ProcessTimeout:
                raise errors.provider_timeout()
        return self.parse(model, proc)

    def parse(self, model: str, proc) -> ProviderResult:
        # The JSON result goes to stdout; some early failures print it on stderr.
        data = _json_object(proc.stdout) or _json_object(proc.stderr)
        if data is None:
            if proc.returncode == AUTH_EXIT_CODE:
                raise _not_authenticated()
            raise errors.provider_error("provider_invalid_output")
        error = data.get("error") if isinstance(data.get("error"), dict) else None
        warnings = " ".join(str(w) for w in data.get("warnings") or [] if isinstance(w, str))
        response = data.get("response")
        if error or proc.returncode != 0 or not isinstance(response, str):
            text = " ".join(str(error.get(k, "")) for k in ("type", "message", "code")) if error else ""
            if proc.returncode == AUTH_EXIT_CODE or AUTH_FAILURE.search(str(error.get("type", "")) if error else ""):
                raise _not_authenticated()
            if QUOTA_FAILURE.search(text + " " + warnings):
                raise errors.quota_exceeded()
            raise errors.provider_error()
        stats = data.get("stats") if isinstance(data.get("stats"), dict) else {}
        tools = stats.get("tools") if isinstance(stats.get("tools"), dict) else {}
        if int(tools.get("totalSuccess") or 0) > 0:
            raise errors.provider_error()  # a tool actually ran despite the deny-all policy
        models = stats.get("models") if isinstance(stats.get("models"), dict) else {}
        served = {name: m for name, m in models.items() if isinstance(m, dict)}
        main = [m for name, m in served.items() if name == model or name.startswith(model + "-")]
        if served and not any(int((m.get("tokens") or {}).get("candidates") or 0) > 0 for m in main):
            raise errors.provider_error("provider_model_mismatch")  # e.g. automatic fallback
        if not response.strip():
            if QUOTA_FAILURE.search(warnings):
                raise errors.quota_exceeded()
            raise errors.provider_error("provider_empty_output")
        if len(response) > 100000:
            raise errors.provider_error("provider_output_too_large")
        usage = None
        if served:
            usage = usage_or_none(
                sum(int((m.get("tokens") or {}).get("prompt") or 0) for m in served.values()),
                sum(int((m.get("tokens") or {}).get("candidates") or 0) for m in served.values()))
        return ProviderResult(output=response, usage=usage, finish_reason="unknown")


def _not_authenticated():
    return errors.provider_unavailable(
        "provider_not_authenticated",
        "Rode `gemini` no terminal e faça Login with Google de novo.")


def _json_object(text: str):
    text = (text or "").strip()
    start = text.find("{")
    if start < 0:
        return None
    try:
        value = json.loads(text[start:])
    except ValueError:
        return None
    return value if isinstance(value, dict) else None
