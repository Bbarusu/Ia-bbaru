"""Sanitized failure signatures: what went wrong, never what was said.

A signature lets the user and the other fronts tell failures apart (e.g. the
`provider_error` seen in the panel on 11/11/2026) without exposing prompts,
sources, answers, stderr or credentials. Every field is a number, a boolean, a
value from a fixed list, or a short identifier that passed a strict pattern.
Free text from the CLI is only matched against known phrases; it is never kept.
"""
import re

# Phrases checked in Claude Code 2.1.322 (official package, read without an
# account). Order matters: the first match wins.
CATEGORIES = (
    # The CLI replaces a turn cut at max_tokens by this error; the partial
    # answer is not in the result.
    ("output_limit_reached", re.compile(r"output token maximum", re.I)),
    ("context_window_exceeded", re.compile(r"context window limit|prompt is too long", re.I)),
    ("usage_credits", re.compile(r"usage credits", re.I)),
    ("model_unavailable", re.compile(
        r"model substitution is disabled|forbids model substitution|issue with the selected model"
        r"|may not have access", re.I)),
    ("auth", re.compile(r"/login|not logged in|invalid api key|authentication|oauth|\b401\b", re.I)),
    ("quota", re.compile(r"usage limit|limit reached|rate limit|quota|resets", re.I)),
    ("overloaded", re.compile(r"overloaded|\b529\b", re.I)),
    ("api_timeout", re.compile(r"request timed out|timeout", re.I)),
    ("api_invalid_request", re.compile(r"invalid_request_error|\b400\b", re.I)),
    ("api_server_error", re.compile(r"api_error|internal server error|\b50[0-4]\b", re.I)),
)
KNOWN_SUBTYPES = {"success", "error_during_execution", "error_max_turns", "error_max_budget_usd",
                  "error_max_structured_output_retries"}
KNOWN_STOP = {"end_turn", "stop_sequence", "max_tokens", "refusal", "pause_turn", "tool_use",
              "model_context_window_exceeded"}
IDENT = re.compile(r"[a-z][a-z0-9_]{0,39}")
MODEL_KEY = re.compile(r"claude-[a-z0-9.-]{1,60}(\[1m\])?")
API_STATUS = re.compile(r"API Error:\s*(\d{3})\b")


def categorize(texts) -> str:
    joined = "\n".join(t for t in texts if isinstance(t, str))
    for name, pattern in CATEGORIES:
        if pattern.search(joined):
            return name
    return "none"


def _ident(value):
    if value is None:
        return None
    return value if isinstance(value, str) and IDENT.fullmatch(value) else "other"


def error_texts(data) -> list[str]:
    """Texts of an error result: `result` (API-error turns) and `errors`
    (error_* subtypes, which have no `result`)."""
    if not isinstance(data, dict):
        return []
    texts = [data.get("result")] if isinstance(data.get("result"), str) else []
    errors = data.get("errors")
    if isinstance(errors, list):
        texts += [e for e in errors[:20] if isinstance(e, str)]
    return texts


def signature(stage: str, *, model: str, cli_version=None, proc=None, data=None,
              category: str | None = None) -> dict:
    """Build the sanitized record. `stage` is where the gateway stopped."""
    sig = {"stage": stage, "model_requested": model[:100],
           "cli_version": (cli_version or "")[:40] or None}
    if proc is not None:
        sig.update(returncode=proc.returncode, stdout_bytes=len(proc.stdout or ""),
                   stderr_bytes=len(proc.stderr or ""))
    if isinstance(data, dict):
        texts = error_texts(data)
        status = API_STATUS.search("\n".join(texts))
        subtype = data.get("subtype")
        stop = data.get("stop_reason")
        usage = data.get("modelUsage")
        sig.update(
            result_subtype=subtype if subtype in KNOWN_SUBTYPES else _ident(subtype),
            is_error=bool(data.get("is_error")),
            has_result_text=isinstance(data.get("result"), str) and bool(data["result"].strip()),
            errors_count=len(data["errors"]) if isinstance(data.get("errors"), list) else 0,
            stop_reason=stop if stop in KNOWN_STOP or stop is None else "other",
            api_error=_ident(data.get("api_error")),
            terminal_reason=_ident(data.get("terminal_reason")),
            api_status=int(status.group(1)) if status else None,
            served_models=sorted(k for k in usage if MODEL_KEY.fullmatch(str(k)))[:5]
            if isinstance(usage, dict) else None,
            category=category or categorize(texts),
        )
    elif category:
        sig["category"] = category
    return sig
