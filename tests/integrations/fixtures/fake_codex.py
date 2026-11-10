"""Explicit test double for the OpenAI Codex CLI (ChatGPT). NOT the real binary.

Imitates what @openai/codex 0.167.0 prints (checked without an account):
`--version`, `exec --help`, `login status`, `features list`, and `exec --json`
JSONL events. FAKE_CODEX_MODE selects the generation:
  success (default) | reconnect_then_success | tool | auth | quota | garbage | sleep
FAKE_CODEX_LOGIN: chatgpt (default) | none | apikey
FAKE_CODEX_FEATURE_ON: a feature that stays enabled despite --disable
FAKE_CODEX_RECORD: file that receives argv, stdin and selected env vars.
"""
import json
import os
import sys
import time

FLAGS = ("--json", "--ephemeral", "--ignore-user-config", "--ignore-rules", "--skip-git-repo-check",
         "--sandbox", "--disable", "--output-last-message", "--model", "--color")
FEATURES = ("shell_tool", "unified_exec", "unified_exec_tty", "view_image", "apps", "plugins",
            "remote_plugin", "browser_use", "browser_use_external", "browser_use_full_cdp_access",
            "computer_use", "image_generation", "in_app_browser", "in_app_local_automation",
            "multi_agent", "sleep_tool", "tool_suggest", "skill_search", "skill_mcp_dependency_install",
            "hooks", "goals", "workspace_dependencies", "code_mode_host", "unbounded_connection_retries",
            "fast_mode")


def emit(event):
    print(json.dumps(event, ensure_ascii=False))


def main():
    args = sys.argv[1:]
    if args == ["--version"]:
        print("codex-cli 9.9.9 (test double)")
        return 0
    if args[:2] == ["exec", "--help"]:
        print("Run Codex non-interactively\n" + "\n".join(f"  {f}" for f in FLAGS))
        return 0
    if args[:2] == ["login", "status"]:
        login = os.environ.get("FAKE_CODEX_LOGIN", "chatgpt")
        print({"chatgpt": "Logged in using ChatGPT", "none": "Not logged in",
               "apikey": "Logged in using an API key - sk-****"}[login])
        return 0
    if args[:2] == ["features", "list"]:
        disabled = {args[i + 1] for i, a in enumerate(args) if a == "--disable" and i + 1 < len(args)}
        forced = os.environ.get("FAKE_CODEX_FEATURE_ON")
        for name in FEATURES:
            on = name == "unified_exec" or name == forced or name not in disabled
            print(f"{name:<40} stable             {'true' if on else 'false'}")
        return 0

    stdin = sys.stdin.buffer.read().decode("utf-8")
    record = os.environ.get("FAKE_CODEX_RECORD")
    if record:
        with open(record, "w", encoding="utf-8") as fh:
            json.dump({"argv": args, "stdin": stdin, "cwd": os.getcwd(), "cwd_files": os.listdir(os.getcwd()), "env": {
                k: os.environ.get(k) for k in ("OPENAI_API_KEY", "CODEX_API_KEY", "GATEWAY_TOKEN")}}, fh)
    mode = os.environ.get("FAKE_CODEX_MODE", "success")
    last = args[args.index("--output-last-message") + 1] if "--output-last-message" in args else None
    emit({"type": "thread.started", "thread_id": "0000-test"})
    emit({"type": "turn.started"})
    if mode == "sleep":
        time.sleep(30)
    if mode == "garbage":
        print("not json at all")
        return 1
    if mode == "auth":
        emit({"type": "turn.failed", "error": {"message": "unexpected status 401 Unauthorized"}})
        return 1
    if mode == "quota":
        emit({"type": "turn.failed", "error": {"message": "You've hit your usage limit. Try again later."}})
        return 1
    if mode == "reconnect_then_success":
        emit({"type": "error", "message": "Reconnecting... 1/5 (stream disconnected before completion)"})
    if mode == "tool":
        emit({"type": "item.started", "item": {"id": "item_1", "type": "command_execution", "command": "ls"}})
        emit({"type": "item.completed", "item": {"id": "item_1", "type": "command_execution", "command": "ls"}})
    text = "Resposta do dublê do ChatGPT"
    emit({"type": "item.completed", "item": {"id": "item_2", "type": "agent_message", "text": text}})
    emit({"type": "turn.completed", "usage": {"input_tokens": 200, "cached_input_tokens": 50, "output_tokens": 30}})
    if last:
        with open(last, "w", encoding="utf-8") as fh:
            fh.write(text)
    return 0


if __name__ == "__main__":
    sys.exit(main())
