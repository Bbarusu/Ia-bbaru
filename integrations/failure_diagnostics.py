"""Structural CLI failure evidence. Never log provider text or request content."""
import hashlib
import json
import logging

LOG = logging.getLogger("ia_bbaru.claude_failure")
ERROR_SUBTYPES = frozenset({
    "error_during_execution", "error_max_turns", "error_max_budget_usd",
    "error_max_structured_output_retries",
})


def failure_text(data: dict) -> str:
    """CLI failures can use errors[] instead of result. For classification only."""
    parts = [data["result"]] if isinstance(data.get("result"), str) else []
    errors = data.get("errors")
    if isinstance(errors, list):
        parts.extend(item for item in errors if isinstance(item, str))
    return "\n".join(parts)


def log_failure(request, proc, code):
    try:
        data = json.loads(proc.stdout)
        shape = "object" if isinstance(data, dict) else "other_json"
    except ValueError:
        data, shape = None, "invalid_json"
    data = data if isinstance(data, dict) else {}
    subtype = data.get("subtype")
    # Unknown values, arbitrary keys, stderr and result never leave this function.
    subtype = subtype if isinstance(subtype, str) and subtype in ERROR_SUBTYPES | {"success"} else "unknown"
    text = (failure_text(data) + "\n" + proc.stderr).lower()
    markers = []
    for name, phrases in {
        "authentication": ("not logged in", "authentication", "/login", "oauth"),
        "quota": ("usage limit", "limit reached", "rate limit", "quota"),
        "model_access": ("issue with the selected model", "may not have access", "model substitution is disabled"),
        "usage_credits": ("usage credits",),
        "nested_session": ("cannot be launched inside another claude code session",),
        "argument_error": ("unknown option", "unknown argument", "invalid argument"),
    }.items():
        if any(phrase in text for phrase in phrases):
            markers.append(name)
    if "max_tokens" in text and ("budget_tokens" in text or "thinking" in text):
        markers.append("thinking_output_budget")
    errors = data.get("errors")
    facts = {
        "event": "claude_cli_failure",
        "request_fingerprint": hashlib.sha256(request.request_id.encode()).hexdigest()[:16],
        "code": code,
        "exit_code": proc.returncode,
        "stdout_shape": shape,
        "subtype": subtype,
        "has_result_text": isinstance(data.get("result"), str),
        "error_items": len(errors) if isinstance(errors, list) else 0,
        "stderr_present": bool(proc.stderr.strip()),
        "max_output_tokens": request.max_output_tokens,
        # These are textual clues, not a proven diagnosis or permission to retry.
        "markers": markers,
    }
    LOG.warning("%s", json.dumps(facts, ensure_ascii=True, sort_keys=True))
