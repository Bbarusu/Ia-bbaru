"""Explicit test double for the Gemini CLI. NOT the real CLI.

Imitates @google/gemini-cli 0.67.0 headless JSON output (checked by reading the
package, without an account). FAKE_GEMINI_MODE selects the generation:
  success (default) | auth | quota | tool | fallback | garbage | json_on_stderr
FAKE_GEMINI_RECORD: file that receives argv, stdin, env and the policy file.
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
    policy_dir = Path(args[args.index("--admin-policy") + 1])
    record = os.environ.get("FAKE_GEMINI_RECORD")
    if record:
        with open(record, "w", encoding="utf-8") as fh:
            json.dump({"argv": args, "stdin": stdin, "cwd": os.getcwd(), "cwd_files": os.listdir(os.getcwd()),
                       "policy": "".join(p.read_text(encoding="utf-8") for p in policy_dir.glob("*.toml")),
                       "system_md": Path(os.environ["GEMINI_SYSTEM_MD"]).read_text(encoding="utf-8"),
                       "env": {k: os.environ.get(k) for k in (
                           "GEMINI_API_KEY", "GOOGLE_API_KEY", "GOOGLE_GENAI_USE_GCA", "GATEWAY_TOKEN")}}, fh)
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
    result = {"session_id": "s", "response": "Resposta do dublê do Gemini",
              "stats": {"models": {served: {"tokens": {"prompt": 300, "candidates": 40, "total": 340}}},
                        "tools": tools}}
    out(result, sys.stderr if mode == "json_on_stderr" else sys.stdout)
    return 0


if __name__ == "__main__":
    sys.exit(main())
