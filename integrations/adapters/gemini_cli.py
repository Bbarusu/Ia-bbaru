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
- Login with Google is **forced**, not assumed. `GEMINI_CLI_AUTH_OVERRIDE` (the
  variable the CLI itself uses when it relaunches) replaces the auth type saved
  in the user's settings: with "gemini-api-key" saved and the override set to
  "oauth-personal", the CLI takes the Google path (tested on 0.67.0, no account).
  Because the variable is internal, every status check runs a self-test in an
  isolated empty home (settings select Vertex AI, input empty): only a CLI that
  honours the override is accepted. API-key and endpoint variables are stripped;
  a system-wide settings file (admin, highest precedence) cannot be overridden,
  so its presence keeps the provider unavailable;
- login is **verified by the CLI**, never by reading credential files: a run
  with the override and an **empty prompt** authenticates and then stops with
  "No input provided" (exit 42) when the Google login is valid, or exits 41 with
  "Manual authorization is required" when it is not. An empty input cannot
  generate; the probe also names a model that does not exist;
- `GEMINI_SYSTEM_MD` replaces the agent's system prompt with ours;
- `@path` in the input is expanded into file contents, so the document is sent
  with `@` escaped (see prompt.build_cli_document);
- IA_BBARU_GEMINI_CLI_LOGIN=google only *allows* that verification (it makes
  the CLI contact Google with the user's login); it never counts as evidence.

No stop/truncation reason in the headless output and no output cap: every result
is `finish_reason: unknown`, `output_limit: none`. A tool that actually ran
(`stats.tools.totalSuccess > 0`) is refused, and so is any output token from a
model other than the one requested, even mixed with the requested one.
"""
import json
import re
import sys
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
NO_INPUT_EXIT_CODE = 42
GOOGLE_LOGIN = "oauth-personal"
AUTH_OVERRIDE_ENV = "GEMINI_CLI_AUTH_OVERRIDE"
NOT_LOGGED_IN_TEXT = "Manual authorization is required"
NO_INPUT_TEXT = "No input provided"
PROBE_MODEL = "ia-bbaru-sonda-sem-geracao"  # does not exist: a probe can never generate
# Variables that could select another auth type or project inside the self-test.
SELF_TEST_STRIPPED = ("GOOGLE_CLOUD_PROJECT", "GOOGLE_CLOUD_LOCATION", "GOOGLE_GENAI_USE_GCA", "CLOUD_SHELL")
SYSTEM_SETTINGS = {
    "win32": r"C:\ProgramData\gemini-cli\settings.json",
    "darwin": "/Library/Application Support/GeminiCli/settings.json",
}
SYSTEM_SETTINGS_DEFAULT = "/etc/gemini-cli/settings.json"
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
    billing="subscription_quota",   # Login with Google forced and verified (see _probe)
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

    def system_settings_present(self) -> bool:
        """Existence only; the file is never opened."""
        return Path(SYSTEM_SETTINGS.get(sys.platform, SYSTEM_SETTINGS_DEFAULT)).exists()

    def _probe_args(self, command) -> list[str]:
        return command + ["--skip-trust", "--prompt", "", "--model", PROBE_MODEL,
                          "--extensions", "none", "--allowed-mcp-server-names", NO_MCP_SERVER,
                          "--output-format", "text"]

    def override_honoured(self, command, version: str) -> bool:
        """Self-test in an isolated empty home: the saved auth type is Vertex AI
        and nothing else is configured. Only a CLI that applies the override
        reaches the Google path. Empty input: it cannot generate."""
        cache = self.__dict__.setdefault("_override_checked", {})
        if version in cache:
            return cache[version]
        with tempfile.TemporaryDirectory(prefix="ia-bbaru-gemini-teste-") as folder:
            home = Path(folder) / "home"
            (home / ".gemini").mkdir(parents=True)
            (home / ".gemini" / "settings.json").write_text(
                json.dumps({"security": {"auth": {"selectedType": "vertex-ai"}}}), encoding="utf-8")
            work = Path(folder) / "trabalho"
            work.mkdir()
            env = {k: v for k, v in self.child_env().items() if k not in SELF_TEST_STRIPPED}
            env.update({"GEMINI_CLI_HOME": str(home), "HOME": str(home), "USERPROFILE": str(home),
                        AUTH_OVERRIDE_ENV: GOOGLE_LOGIN, "NO_BROWSER": "true", "NO_COLOR": "1"})
            try:
                proc = self.runner(self._probe_args(command), "", 30, env, str(work))
            except (ProcessStartError, ProcessTimeout):
                return False  # not cached: may be transient
        text = proc.stdout + proc.stderr
        honoured = ((proc.returncode == AUTH_EXIT_CODE and NOT_LOGGED_IN_TEXT in text)
                    or (proc.returncode == NO_INPUT_EXIT_CODE and NO_INPUT_TEXT in text))
        cache[version] = honoured
        return honoured

    def login_probe(self, command):
        """The CLI authenticates with the forced Google login and stops at the
        empty input. Returns (state, exit_code): verified | not_logged_in | unknown."""
        with tempfile.TemporaryDirectory(prefix="ia-bbaru-gemini-login-") as work:
            env = self.child_env({AUTH_OVERRIDE_ENV: GOOGLE_LOGIN, "GOOGLE_GENAI_USE_GCA": "true",
                                  "NO_BROWSER": "true", "NO_COLOR": "1"})
            try:
                proc = self.runner(self._probe_args(command), "", 45, env, work)
            except (ProcessStartError, ProcessTimeout):
                return "unknown", None
        text = proc.stdout + proc.stderr
        if proc.returncode == NO_INPUT_EXIT_CODE and NO_INPUT_TEXT in text:
            return "verified", proc.returncode
        if proc.returncode == AUTH_EXIT_CODE and NOT_LOGGED_IN_TEXT in text:
            return "not_logged_in", proc.returncode
        return "unknown", proc.returncode

    def _probe(self) -> ConnectionStatus:
        found, failure = self.probe_cli(
            ["--help"], REQUIRED_FLAGS,
            "Instale a Gemini CLI oficial e confirme `gemini --version` no terminal.")
        if failure:
            return failure
        command, installed = found
        if not self.settings.login_confirmed:
            # Without the user's go-ahead nothing contacts Google, so nothing is known.
            return make_status(
                PROVIDER, **installed, reason="auth_status_unknown",
                next_action=("Rode `gemini` no terminal, escolha Login with Google e depois "
                             "defina IA_BBARU_GEMINI_CLI_LOGIN=google ao iniciar o gateway."))
        if self.system_settings_present():
            return make_status(
                PROVIDER, **installed, reason="auth_status_unknown",
                detail="há configuração de sistema da Gemini CLI; o modo de login não pode ser garantido",
                next_action="Remova a configuração de sistema da Gemini CLI ou use outro agente.")
        if not self.override_honoured(command, installed["version"] or ""):
            return make_status(
                PROVIDER, **{**installed, "missing_flags": [AUTH_OVERRIDE_ENV]}, reason="cli_version_unsupported",
                detail="esta versão não permitiu forçar o Login with Google",
                next_action="Use uma versão da Gemini CLI em que o Login with Google possa ser forçado.")
        state, code = self.login_probe(command)
        if state == "verified":
            return make_status(PROVIDER, **installed, logged_in=True, auth_method=GOOGLE_LOGIN,
                               uses_subscription=True, ready=True)
        if state == "not_logged_in":
            return make_status(PROVIDER, **installed, logged_in=False, auth_method="none",
                               uses_subscription=False, reason="not_logged_in",
                               next_action=("Rode `gemini` no terminal e escolha Sign in with Google. Se a CLI "
                                            "recusar o login (contas individuais: o Google pede migração para "
                                            "o Antigravity), este agente não pode ser usado com a conta Google."))
        return make_status(
            PROVIDER, **installed, reason="auth_status_unknown",
            detail=("a verificação de login não respondeu" if code is None
                    else f"a verificação de login terminou com código {code}"),
            next_action="Rode `gemini` no terminal, confira o Login with Google e tente de novo.")

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
            env = self.child_env({AUTH_OVERRIDE_ENV: GOOGLE_LOGIN, "GOOGLE_GENAI_USE_GCA": "true",
                                  "GEMINI_SYSTEM_MD": str(system_file), "NO_BROWSER": "true",
                                  "NO_COLOR": "1"})
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
        if not served:
            raise errors.provider_error("provider_invalid_output")  # the serving model cannot be checked
        produced = {name: _tokens(m, "candidates") for name, m in served.items()}
        # Exact identity only. Output from any other model, even mixed with the
        # requested one (automatic fallback, helper models), is not accepted.
        if produced.get(model, 0) <= 0 or any(n > 0 for name, n in produced.items() if name != model):
            raise errors.provider_error("provider_model_mismatch")
        if not response.strip():
            if QUOTA_FAILURE.search(warnings):
                raise errors.quota_exceeded()
            raise errors.provider_error("provider_empty_output")
        if len(response) > 100000:
            raise errors.provider_error("provider_output_too_large")
        usage = usage_or_none(sum(_tokens(m, "prompt") for m in served.values()), produced[model])
        return ProviderResult(output=response, usage=usage, finish_reason="unknown")


def _tokens(model_stats: dict, key: str) -> int:
    tokens = model_stats.get("tokens") if isinstance(model_stats.get("tokens"), dict) else {}
    try:
        return int(tokens.get(key) or 0)
    except (TypeError, ValueError):
        return 0


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
