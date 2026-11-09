"""Explicit test double for the Claude Code CLI. NOT the real binary.

Its output imitates the documented shape of `claude -p --output-format json`
(result, session_id, usage) plus fields seen in practice but not documented
(is_error, subtype). Behaviour is selected with FAKE_CLAUDE_MODE:
  success (default) | auth_error | usage_limit | sleep | garbage | over_cap
  | max_tokens | no_stop_reason | null_stop_reason | refusal
FAKE_CLAUDE_LOGIN: claude.ai (default) | api_key | none
FAKE_CLAUDE_RECORD: file that receives argv, stdin and selected env vars.
FAKE_CLAUDE_DELAY: seconds to wait before answering a generation (default 0).
"""
import json
import os
import sys
import time

FLAGS = ("--print", "--output-format", "--model", "--system-prompt", "--tools",
         "--strict-mcp-config", "--safe-mode", "--no-session-persistence",
         "--disable-slash-commands", "--permission-prompts")


def main():
    args = sys.argv[1:]
    if args == ["--version"]:
        print("9.9.9 (Claude Code test double)")
        return 0
    if args == ["--help"]:
        legacy = os.environ.get("FAKE_CLAUDE_OLD") == "1"
        print("\n".join(f"  {f}" for f in FLAGS if not (legacy and f == "--safe-mode")))
        return 0
    if args[:2] == ["auth", "status"]:
        login = os.environ.get("FAKE_CLAUDE_LOGIN", "claude.ai")
        print(json.dumps({"loggedIn": login != "none", "authMethod": login, "apiProvider": "firstParty"}))
        return 0 if login != "none" else 1

    # Read bytes and decode UTF-8 like the real (Node.js) CLI does. sys.stdin
    # would use the Windows ANSI code page (cp1252) and garble accents.
    stdin = sys.stdin.buffer.read().decode("utf-8")
    record = os.environ.get("FAKE_CLAUDE_RECORD")
    if record:
        with open(record, "w", encoding="utf-8") as fh:
            json.dump({"argv": args, "stdin": stdin, "env": {
                k: os.environ.get(k) for k in (
                    "ANTHROPIC_API_KEY", "GATEWAY_TOKEN", "CLAUDE_CODE_MAX_OUTPUT_TOKENS")
            }}, fh)
    mode = os.environ.get("FAKE_CLAUDE_MODE", "success")
    time.sleep(float(os.environ.get("FAKE_CLAUDE_DELAY", "0")))
    if mode == "sleep":
        time.sleep(30)
    if mode == "garbage":
        print("not json")
        return 1
    if mode == "auth_error":
        print(json.dumps({"type": "result", "subtype": "success", "is_error": True,
                          "result": "Not logged in · Please run /login", "session_id": "s-1"}))
        return 1
    if mode == "usage_limit":
        print(json.dumps({"type": "result", "subtype": "success", "is_error": True,
                          "result": "Claude usage limit reached. Your limit resets 5pm", "session_id": "s-2"}))
        return 1
    cap = int(os.environ.get("CLAUDE_CODE_MAX_OUTPUT_TOKENS", "4096"))
    output_tokens = cap + 50 if mode == "over_cap" else 42
    # stop_reason is in the CLI's embedded result schema (nullable), not in its docs.
    stop_reason = {"max_tokens": "max_tokens", "null_stop_reason": None,
                   "refusal": "refusal"}.get(mode, "end_turn")
    payload = {
        "type": "result", "subtype": "success", "is_error": False,
        "result": "Resposta do dublê de teste", "session_id": "s-3",
        "stop_reason": stop_reason, "total_cost_usd": 0.0,
        "usage": {"input_tokens": 100, "cache_read_input_tokens": 20, "output_tokens": output_tokens},
    }
    if mode == "no_stop_reason":
        del payload["stop_reason"]
    print(json.dumps(payload))
    return 0


if __name__ == "__main__":
    sys.exit(main())
