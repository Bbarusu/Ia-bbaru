"""Run an official provider CLI as a child process with a hard timeout.

On timeout the whole process tree is killed (the npm launcher on Windows is a
cmd.exe wrapper around node, so killing only the parent is not enough).
"""
import os
import signal
import subprocess
import sys
from dataclasses import dataclass

# Variables that would switch the CLI from the user's subscription login to a
# paid API or cloud account, plus this project's own secrets. Never forwarded.
STRIPPED_ENV = (
    # Claude Code: API key / cloud providers instead of the subscription.
    "ANTHROPIC_API_KEY", "ANTHROPIC_AUTH_TOKEN", "CLAUDE_CODE_USE_BEDROCK",
    "CLAUDE_CODE_USE_VERTEX", "CLAUDE_CODE_USE_FOUNDRY", "ANTHROPIC_BASE_URL",
    # This project's own secrets.
    "GATEWAY_TOKEN", "LAUNCHER_API_TOKEN",
)


@dataclass
class ProcessResult:
    returncode: int
    stdout: str
    stderr: str


class ProcessTimeout(Exception):
    pass


class ProcessStartError(Exception):
    pass


def child_env(extra: dict | None = None) -> dict:
    env = {k: v for k, v in os.environ.items() if k not in STRIPPED_ENV}
    env.update(extra or {})
    return env


def _kill_tree(proc: subprocess.Popen):
    if sys.platform == "win32":
        subprocess.run(["taskkill", "/T", "/F", "/PID", str(proc.pid)],
                       capture_output=True, check=False)
    else:
        try:
            os.killpg(proc.pid, signal.SIGKILL)
        except ProcessLookupError:
            pass


def run_process(args: list[str], stdin_text: str, timeout_s: float,
                env: dict, cwd: str) -> ProcessResult:
    kwargs = {}
    if sys.platform == "win32":
        kwargs["creationflags"] = subprocess.CREATE_NEW_PROCESS_GROUP | subprocess.CREATE_NO_WINDOW
    else:
        kwargs["start_new_session"] = True
    try:
        proc = subprocess.Popen(
            args, stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.PIPE,
            cwd=cwd, env=env, text=True, encoding="utf-8", errors="replace", **kwargs,
        )
    except OSError as exc:
        # Type and OS error number only (e.g. WinError 193 = not a Windows program).
        code = getattr(exc, "winerror", None) or exc.errno
        raise ProcessStartError(f"{type(exc).__name__} {code}" if code else type(exc).__name__) from exc
    try:
        stdout, stderr = proc.communicate(stdin_text, timeout=timeout_s)
    except subprocess.TimeoutExpired:
        _kill_tree(proc)
        proc.communicate()
        raise ProcessTimeout()
    return ProcessResult(proc.returncode, stdout, stderr)
