"""Structural CLI failure evidence. Never log provider text or request content."""
import hashlib
import json
import logging
from .failures import categorize, error_texts, verified_version

LOG = logging.getLogger("ia_bbaru.claude_failure")
ERROR_SUBTYPES = frozenset({
    "error_during_execution", "error_max_turns", "error_max_budget_usd",
    "error_max_structured_output_retries",
})


def log_failure(request, proc, code, cli_version=None):
    try:
        data = json.loads(proc.stdout)
        shape = "object" if isinstance(data, dict) else "other_json"
    except (ValueError, RecursionError):
        data, shape = None, "invalid_json"
    data = data if isinstance(data, dict) else {}
    subtype = data.get("subtype")
    # Unknown values, arbitrary keys, stderr and result never leave this function.
    subtype = subtype if isinstance(subtype, str) and subtype in ERROR_SUBTYPES | {"success"} else "unknown"
    category = categorize(error_texts(data))
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
        "category": category,
        "markers": [] if category == "none" else [category],
        # stderr is not used to contradict a structured result. Separate clue,
        # same classifier, no raw text and no effect on retry/error policy.
        "stderr_category": categorize([proc.stderr]),
        "cli_version": verified_version(cli_version),
        "cli_version_source": "last_verified",
    }
    LOG.warning("%s", json.dumps(facts, ensure_ascii=True, sort_keys=True))
