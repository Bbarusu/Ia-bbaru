"""Read CLI NDJSON internally; HTTP still delivers one complete response.

CLI 2.1.307/322/325 keeps only the last text block in result. Assistant events
are the evidence for reconstructing the complete final answer. No raw event is
persisted or logged. See ANALISE_CLI_CLAUDE.md section 7 (package inspection).
"""
import json


def model_fallback(event):
    subtype = event.get("subtype", "")
    return (event.get("type") == "system" and isinstance(subtype, str)
            and subtype.startswith("model_") and subtype.endswith("fallback"))


def decode_output(stdout, allow_legacy=False):
    if len(stdout) > 8_000_000:
        raise ValueError("Output too large")
    events = [json.loads(line) for line in stdout.splitlines() if line.strip()]
    if not events or any(not isinstance(item, dict) for item in events):
        raise ValueError("Invalid events")
    if allow_legacy and len(events) == 1:
        return events[0], []
    results = [item for item in events if item.get("type") == "result"]
    if len(results) != 1:
        raise ValueError("Missing final result")
    result = results[0]
    for event in events[events.index(result) + 1:]:
        if model_fallback(event):
            raise LookupError("Model fallback")
        if event.get("type") not in {"system", "rate_limit_event", "keep_alive"}:
            raise ValueError("Content after final result")
    return result, [event for event in events if event is not result]


def assemble(events, result, model_pattern):
    init = [event for event in events if event.get("type") == "system" and event.get("subtype") == "init"]
    if len(init) != 1 or init[0].get("tools") != []:
        raise ValueError("Unverified initialization")
    if not model_pattern.fullmatch(str(init[0].get("model", ""))):
        raise LookupError("Model changed")
    groups, current, seen = {}, None, {}
    for event in events:
        if model_fallback(event):
            raise LookupError("Model fallback")
        if event.get("type") != "assistant":
            continue
        uid = event.get("uuid")
        if isinstance(uid, str) and uid in seen:
            if seen[uid] != event:
                raise ValueError("Conflicting duplicate")
            continue
        if isinstance(uid, str):
            seen[uid] = event
        message = event.get("message")
        if not isinstance(message, dict):
            raise ValueError("Invalid assistant")
        if message.get("model") == "<synthetic>":
            continue
        mid, content = message.get("id"), message.get("content")
        if not isinstance(mid, str) or not mid or not isinstance(content, list):
            raise ValueError("Invalid content")
        if not model_pattern.fullmatch(str(message.get("model", ""))):
            raise LookupError("Model changed")
        if mid != current and mid in groups:
            raise ValueError("Noncontiguous response")
        current = mid
        blocks = groups.setdefault(mid, [])
        for block in content:
            if not isinstance(block, dict):
                raise ValueError("Invalid block")
            if block.get("type") == "text" and isinstance(block.get("text"), str):
                blocks.append(block["text"])
            elif block.get("type") not in {"thinking", "redacted_thinking"}:
                raise ValueError("Unexpected tool or content")
    blocks = groups.get(current, [])
    if not blocks or blocks[-1] != result.get("result"):
        raise ValueError("Result does not match final text block")
    output = "".join(blocks)
    if len(output) > 100000:
        raise OverflowError("Answer too large")
    return output


def echoed_images(events):
    images = []
    for event in events:
        if event.get("type") != "user":
            continue
        message = event.get("message")
        if not isinstance(message, dict) or not isinstance(message.get("content"), list):
            raise ValueError("Invalid input echo")
        images.extend(block for block in message["content"] if isinstance(block, dict) and block.get("type") == "image")
    return images
