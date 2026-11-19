"""Explicit test double for the Claude Code CLI. NOT the real binary.

Its output imitates `claude -p --output-format stream-json --verbose`
(result, session_id, usage) plus fields seen in practice but not documented
(is_error, subtype). Behaviour is selected with FAKE_CLAUDE_MODE:
  success (default) | auth_error | usage_limit | sleep | garbage | over_cap
  | max_tokens | no_stop_reason | null_stop_reason | refusal
  | fallback | mixed | idle_other_model | no_model_usage | credits | model_access
  | output_limit_error | execution_error | execution_error_auth | api_400 | overloaded
  | exit_nonzero_with_result
The failure shapes follow the result schema and messages of 2.1.322 (read from
the official package, not observed in a user run). Every error text carries
the canary FAKE_CANARY so tests can prove it never leaves the gateway.
modelUsage is keyed like 2.1.322: an alias resolves to the FAKE_ALIASES version
of its family (or FAKE_CLAUDE_SERVED, when set); a full name to itself.
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
         "--disable-slash-commands", "--permission-prompts", "--verbose", "--input-format", "--replay-user-messages")


FAKE_ALIASES = {"sonnet": "claude-sonnet-5-5", "haiku": "claude-haiku-5-5",
                "opus": "claude-opus-5-5", "fable": "claude-fable-5-2"}


FAKE_CANARY = "conteudo-sensivel-canario-7f3a"


def usage_entry(output_tokens):
    return {"inputTokens": 100, "outputTokens": output_tokens, "cacheReadInputTokens": 20,
            "cacheCreationInputTokens": 0, "costUSD": 0.0}


def stream_events(payload, model="claude-sonnet-5-5", mode="success"):
    events = [{"type": "system", "subtype": "init", "model": model, "tools": []}]
    parts = [payload["result"]]
    if mode in {"multi_block", "block_mismatch"}:
        parts = ["Primeira parte (fonte ", "Aula)."]
        payload["result"] = parts[-1] if mode == "multi_block" else "inconsistent"
    for i, part in enumerate(parts):
        events.append({"type": "assistant", "uuid": f"fixture-{i}", "message": {
            "id": "message-1", "model": model, "content": [{"type": "text", "text": part}]}})
    # Match the CLI lifecycle as well as the final result shape.
    stream = [{"type": "system", "subtype": "ui_invalidate"}] + events + [
        {"type": "rate_limit_event", "rate_limit_info": {"status": "allowed"}}, payload]
    if mode == "trailing_metadata":
        stream.append({"type": "system", "subtype": "turn_duration"})
    if mode in {"synthetic_notice", "trailing_assistant"}:
        synthetic = {"type": "assistant", "message": {"model": "<synthetic>",
            "content": [{"type": "text", "text": FAKE_CANARY}]}}
        stream.insert(len(stream) if mode == "trailing_assistant" else 1, synthetic)
    if mode in {"model_refusal_fallback", "model_consent_fallback", "model_refusal_no_fallback", "trailing_fallback"}:
        stream.insert(len(stream) if mode == "trailing_fallback" else 1, {"type": "system",
            "subtype": "model_refusal_fallback" if mode == "trailing_fallback" else mode})
    return stream


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

    if "stream-json" in args and "--verbose" not in args:
        print("Error: When using --print, --output-format=stream-json requires --verbose", file=sys.stderr)
        return 1

    # Read bytes and decode UTF-8 like the real (Node.js) CLI does. sys.stdin
    # would use the Windows ANSI code page (cp1252) and garble accents.
    stdin = sys.stdin.buffer.read().decode("utf-8")
    record = os.environ.get("FAKE_CLAUDE_RECORD")
    if record:
        with open(record, "w", encoding="utf-8") as fh:
            json.dump({"argv": args, "stdin": stdin, "env": {
                k: os.environ.get(k) for k in (
                    "ANTHROPIC_API_KEY", "GATEWAY_TOKEN", "CLAUDE_CODE_MAX_OUTPUT_TOKENS",
                    "CLAUDE_CODE_NO_MODEL_FALLBACK", "ANTHROPIC_DEFAULT_SONNET_MODEL",
                    "CLAUDE_CODE_MODEL_CATALOG_URL")
            }}, fh)
    mode = os.environ.get("FAKE_CLAUDE_MODE", "success")
    time.sleep(float(os.environ.get("FAKE_CLAUDE_DELAY", "0")))
    if mode == "sleep":
        time.sleep(30)
    if mode == "garbage":
        print("not json")
        return 1
    if mode in {"errors_auth", "errors_quota", "errors_unknown", "errors_budget"}:
        message = {
            "errors_auth": "Authentication failed. Please run /login",
            "errors_quota": "Usage limit reached",
            "errors_unknown": "Unrecognized execution failure",
            "errors_budget": "thinking.budget_tokens must be less than max_tokens",
        }[mode]
        # Synthetic examples of the errors[] envelope; not captured user output.
        print(json.dumps({"type": "result", "subtype": "error_during_execution",
                          "is_error": True, "errors": [message + " PRIVATE_SENTINEL"]}))
        print("PRIVATE_STDERR_SENTINEL", file=sys.stderr)
        return 1
    if mode == "auth_error":
        print(json.dumps({"type": "result", "subtype": "success", "is_error": True,
                          "result": "Not logged in · Please run /login", "session_id": "s-1"}))
        return 1
    if mode == "usage_limit":
        result = {"type": "result", "subtype": "success", "is_error": True,
                  "api_error": "usage_limit_reached", "api_error_status": 429,
                  "result": "You've hit your 5-hour limit " + FAKE_CANARY}
        if "stream-json" in args:
            print(json.dumps({"type": "system", "subtype": "init", "model": "claude-sonnet-5-5", "tools": []}))
            print(json.dumps({"type": "assistant", "is_api_error_message": True,
                "api_error": "usage_limit_reached", "message": {"model": "<synthetic>",
                "content": [{"type": "text", "text": result["result"]}]}}))
            print(json.dumps({"type": "rate_limit_event", "rate_limit_info": {
                "status": "rejected", "rateLimitType": "five_hour"}}))
        print(json.dumps(result))
        return 1
    cap_text = os.environ.get("CLAUDE_CODE_MAX_OUTPUT_TOKENS", "4096")
    failures = {
        # 2.1.322 turns a reply cut at max_tokens into this API error turn.
        "output_limit_error": {"subtype": "success", "stop_reason": "max_tokens", "api_error": "max_output_tokens",
                               "result": f"API Error: Claude's response exceeded the {cap_text} output token maximum. "
                                         "To configure this behavior, set the CLAUDE_CODE_MAX_OUTPUT_TOKENS environment "
                                         f"variable. {FAKE_CANARY}"},
        # error_* subtypes have no `result`, only `errors`.
        "execution_error": {"subtype": "error_during_execution", "stop_reason": None,
                            "errors": [f"Unexpected failure {FAKE_CANARY}"]},
        "execution_error_auth": {"subtype": "error_during_execution", "stop_reason": None,
                                 "errors": [f"Not logged in · Please run /login {FAKE_CANARY}"]},
        "api_400": {"subtype": "success", "stop_reason": None,
                    "result": 'API Error: 400 {"type":"error","error":{"type":"invalid_request_error",'
                              f'"message":"{FAKE_CANARY}"}}}}'},
        "overloaded": {"subtype": "success", "stop_reason": None,
                       "result": f'API Error: 529 {{"type":"error","error":{{"type":"overloaded_error","message":"{FAKE_CANARY}"}}}}'},
    }
    if mode in failures:
        print(json.dumps({"type": "result", "is_error": True, "session_id": "s-5", "num_turns": 1,
                          "modelUsage": {}, **failures[mode]}))
        return 1
    if mode in ("credits", "model_access"):
        text = {"credits": "Your model policy only allows Fable, which requires usage credits · /model to set it up",
                "model_access": "There's an issue with the selected model (x). It may not exist or you may not have access to it."}[mode]
        print(json.dumps({"type": "result", "subtype": "success", "is_error": True, "result": text, "session_id": "s-4"}))
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
    requested = args[args.index("--model") + 1]
    base = requested[:-4] if requested.endswith("[1m]") else requested
    served = os.environ.get("FAKE_CLAUDE_SERVED") or FAKE_ALIASES.get(base, base)
    other = "claude-haiku-5-5" if "haiku" not in served else "claude-sonnet-5-5"
    payload["modelUsage"] = {
        "fallback": {other: usage_entry(output_tokens)},
        "mixed": {served: usage_entry(1), other: usage_entry(output_tokens)},
        "idle_other_model": {other: usage_entry(0), served: usage_entry(output_tokens)},
    }.get(mode, {served: usage_entry(output_tokens)})
    if mode == "no_model_usage":
        del payload["modelUsage"]
    if mode == "no_stop_reason":
        del payload["stop_reason"]
    if "stream-json" in args:
        if "--input-format" in args and mode != "visual_no_echo":
            echo = json.loads(stdin)
            if mode == "visual_changed_echo":
                echo["message"]["content"][-1]["source"]["data"] = "wrong"
            print(json.dumps(echo))
        for event in stream_events(payload, served, mode):
            print(json.dumps(event))
    else:
        print(json.dumps(payload))
    return 1 if mode == "exit_nonzero_with_result" else 0


if __name__ == "__main__":
    sys.exit(main())
