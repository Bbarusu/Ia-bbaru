"""Planning policy and preflight checks; capabilities never grant tool access."""
import re


def model_family(model):
    if model.provider != "claude-code":
        return None
    name = model.id.split(":", 1)[-1].lower()
    match = re.match(r"^(?:claude-)?(haiku|sonnet|opus|fable)(?:$|[-\[])", name)
    return match.group(1) if match else None


def review_eligible(writer, reviewer):
    # Product ordering, not measured quality. Explicit reviewer choice overrides it.
    tiers = {"haiku": 0, "sonnet": 1, "opus": 2, "fable": 3}
    if writer.provider != "claude-code":
        return True  # Legacy non-Claude fixtures/in-process gateways retain their policy.
    a, b = tiers.get(model_family(writer)), tiers.get(model_family(reviewer))
    return a is not None and b is not None and b >= a

# Only legacy v1 may omit capabilities: these are that contract's assumptions,
# not a claim that an arbitrary provider enforces limits or reports termination.
LEGACY_CAPABILITIES = {
    "output_limit": "enforced", "cancellation": "none", "finish_reason": "reported",
    "billing": "unknown", "streaming": False, "tools": "disabled",
}


def capabilities(model):
    declared = getattr(model, "capabilities", None)
    return declared.model_dump() if declared is not None else dict(LEGACY_CAPABILITIES)


def policy_error(model, accepted):
    caps = capabilities(model)
    if caps["tools"] != "disabled":
        return "model_tools_not_supported"
    if caps["output_limit"] != "enforced" and accepted is not True:
        return "output_limit_not_accepted"
    return None


def plan_step(role, model):
    step = {"role": role, "model_id": model.id, "provider": model.provider,
            "context_char_limit": model.context_char_limit,
            "max_output_tokens": min(4096, model.max_output_tokens),
            "capabilities": capabilities(model)}
    if getattr(model, "input", None):
        step["input"] = model.input.model_dump()
    return step


def preflight_error(task, catalog, steps):
    if any("AnexoVisual:" in item["content"] for item in task.get("context", [])):
        return "visual_context_not_supported"
    if catalog.protocol_version != task.get("gateway_protocol_version", "1"):
        return "gateway_protocol_changed_replan_required"
    available = {model.id: model for model in catalog.models if model.available}
    accepted = task.get("allow_unenforced_output_limit", False)
    for step in steps:
        model = available.get(step["model_id"])
        if model is None:
            return "model_unavailable_replan_required"
        if task.get("attachment_refs"):
            from .visual import visual_policy
            if catalog.protocol_version not in {"1.2", "1.3"} or visual_policy(model) or not task.get("allow_visual_input"):
                return "visual_input_not_supported"
        error = policy_error(model, accepted)
        if error:
            return error
        previous = step.get("capabilities")
        if previous is None:
            if catalog.protocol_version != "1":
                return "model_capabilities_missing_replan_required"
            previous = LEGACY_CAPABILITIES
        current = capabilities(model)
        # Compare guarantees, not labels or category recommendations. Even an
        # accepted indicative limit cannot silently degrade further after planning.
        ranks = {
            "output_limit": {"enforced": 0, "best_effort": 1, "none": 2},
            "cancellation": {"provider": 0, "local_process_only": 1, "none": 2},
            "finish_reason": {"reported": 0, "inferred": 1},
        }
        if (any(order[current[key]] > order[previous[key]] for key, order in ranks.items())
                or current["billing"] != previous["billing"]
                or model.provider != step.get("provider", model.provider)
                or model.context_char_limit < step["context_char_limit"]
                or model.max_output_tokens < step["max_output_tokens"]):
            return "model_capabilities_changed_replan_required"
    return None
