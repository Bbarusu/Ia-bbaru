"""Explicit test double for the Gemini CLI. NOT the real CLI.

Imitates @google/gemini-cli 0.67.0 headless JSON output (checked by reading the
package, without an account). FAKE_GEMINI_MODE selects the generation:
  success (default) | auth | quota | tool | fallback | mixed | garbage | json_on_stderr
FAKE_GEMINI_LOGIN: google (default) | none      Google credentials present or not
FAKE_GEMINI_SAVED_AUTH: oauth-personal (default) | gemini-api-key   auth type saved in the CLI's own settings
FAKE_GEMINI_HONORS_OVERRIDE: 1 (default) | 0     whether GEMINI_CLI_AUTH_OVERRIDE is applied
FAKE_GEMINI_RECORD: file that receives argv, stdin, env, the policy file and the auth actually used.

Auth is imitated like the real CLI: the override replaces the saved type; an
isolated GEMINI_CLI_HOME reads its own settings.json; an API key saved in the
CLI works without any environment variable; empty input stops after auth with
"No input provided" (exit 42).
"""
import json
import os
import sys
from pathlib import Path

FLAGS = ("--prompt", "--output-format", "--model", "--extensions", "--allowed-mcp-server-names",
         "--admin-policy", "--policy", "--approval-mode", "--skip-trust")


def out(data, stream=sys.stdout):
    stream.write(json.dumps(data, ensure_ascii=False, indent=2) + "\n")


def main():
    args = sys.argv[1:]
    if args == ["--version"]:
        print("9.9.9")
        return 0
    if args == ["--help"]:
        print("Usage: gemini [options]\n" + "\n".join(f"  {f}" for f in FLAGS))
        return 0
    stdin = sys.stdin.buffer.read().decode("utf-8")
    model = args[args.index("--model") + 1]
    # --- authentication, in the order of the real CLI
    saved = os.environ.get("FAKE_GEMINI_SAVED_AUTH", "oauth-personal")
    isolated = os.environ.get("GEMINI_CLI_HOME")
    if isolated:
        settings = json.loads((Path(isolated) / ".gemini" / "settings.json").read_text(encoding="utf-8"))
        saved = settings["security"]["auth"]["selectedType"]
    override = os.environ.get("GEMINI_CLI_AUTH_OVERRIDE")
    effective = override if override and os.environ.get("FAKE_GEMINI_HONORS_OVERRIDE", "1") == "1" else saved
    if effective == "vertex-ai":
        sys.stderr.write("When using Vertex AI, you must specify either: GOOGLE_CLOUD_PROJECT ...\n")
        return 41
    if effective == "oauth-personal" and (isolated or os.environ.get("FAKE_GEMINI_LOGIN", "google") != "google"):
        sys.stderr.write("Manual authorization is required but the current session is non-interactive.\n")
        return 41
    prompt = args[args.index("--prompt") + 1]
    if not (prompt + stdin).strip():
        sys.stderr.write("No input provided via stdin. Input can be provided by piping data into gemini.\n")
        return 42
    policy_dir = Path(args[args.index("--admin-policy") + 1])
    record = os.environ.get("FAKE_GEMINI_RECORD")
    if record:
        with open(record, "w", encoding="utf-8") as fh:
            json.dump({"argv": args, "stdin": stdin, "cwd": os.getcwd(), "cwd_files": os.listdir(os.getcwd()),
                       "policy": "".join(p.read_text(encoding="utf-8") for p in policy_dir.glob("*.toml")),
                       "system_md": Path(os.environ["GEMINI_SYSTEM_MD"]).read_text(encoding="utf-8"),
                       "auth_used": effective,
                       "env": {k: os.environ.get(k) for k in (
                           "GEMINI_API_KEY", "GOOGLE_API_KEY", "GOOGLE_GENAI_USE_GCA", "GATEWAY_TOKEN",
                           "GEMINI_CLI_AUTH_OVERRIDE", "GEMINI_CLI_SYSTEM_SETTINGS_PATH")}}, fh)
    mode = os.environ.get("FAKE_GEMINI_MODE", "success")
    if mode == "garbage":
        print("not json")
        return 1
    if mode == "auth":
        out({"session_id": "s", "error": {"type": "Error", "message": "Manual authorization is required", "code": 41}},
            sys.stderr)
        return 41
    if mode == "quota":
        out({"session_id": "s", "error": {"type": "Error", "message": "RESOURCE_EXHAUSTED: quota exceeded", "code": 1}})
        return 1
    served = "gemini-2.5-flash" if mode == "fallback" else model
    tools = {"totalCalls": 1, "totalSuccess": 1 if mode == "tool" else 0, "totalFail": 0, "byName": {}}
    models = {served: {"tokens": {"prompt": 300, "candidates": 40, "total": 340}}}
    if mode == "mixed":  # requested model plus output from another one
        models = {model: {"tokens": {"prompt": 300, "candidates": 1}},
                  "gemini-2.5-flash": {"tokens": {"prompt": 10, "candidates": 40}}}
    result = {"session_id": "s", "response": "Resposta do dublê do Gemini",
              "stats": {"models": models, "tools": tools}}
    out(result, sys.stderr if mode == "json_on_stderr" else sys.stdout)
    return 0


if __name__ == "__main__":
    sys.exit(main())
