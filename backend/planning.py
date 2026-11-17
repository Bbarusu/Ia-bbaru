"""Shared planning for legacy tasks and persistent chat turns (no provider calls)."""
from datetime import datetime, timezone
from typing import Literal
from uuid import uuid4
from fastapi import HTTPException
from pydantic import Field, field_validator
from .contracts import StrictModel, TaskKind
from .capabilities import plan_step, policy_error, model_family, review_eligible
from .gateway import GatewayUnavailable
from .gateway_errors import ERROR_STATUS


def now():
    return datetime.now(timezone.utc).isoformat()


class TaskInput(StrictModel):
    instruction: str = Field(min_length=1, max_length=8000)
    kind: TaskKind = "general"
    source_ids: list[str] = Field(default_factory=list, max_length=20)
    allowed_model_ids: list[str] = Field(min_length=1, max_length=20)
    mode: Literal["single", "review"] = "single"
    # Omit to recommend using configured task tags and the user's preference order.
    preferred_model_id: str | None = None
    reviewer_model_id: str | None = None
    allow_unenforced_output_limit: bool = Field(default=False, strict=True)
    max_output_tokens: int | None = Field(default=None, ge=1, le=4096, strict=True)
    response_profile: Literal["quick", "normal", "deep"] | None = None

    @field_validator("instruction")
    @classmethod
    def nonblank(cls, value):
        if not value.strip():
            raise ValueError("Instruction must not be blank")
        return value.strip()

    @field_validator("source_ids", "allowed_model_ids")
    @classmethod
    def unique(cls, value):
        if len(value) != len(set(value)):
            raise ValueError("IDs must be unique")
        return value


def build_task(project_id, data, context, gateway, catalog=None):
    if data.mode == "single" and data.reviewer_model_id:
        raise HTTPException(422, "reviewer_requires_review_mode")
    chars = len(data.instruction) + sum(len(s["content"]) + len(s["title"]) for s in context)
    if chars > 80000 or len(context) > 20:
        raise HTTPException(422, "context_too_large")
    try:
        catalog = catalog if catalog is not None else gateway.catalog()
    except GatewayUnavailable as exc:
        raise HTTPException(503, exc.code if exc.code in ERROR_STATUS else "gateway_unavailable")
    available = {m.id: m for m in catalog.models if m.available}
    if any(mid not in available for mid in data.allowed_model_ids):
        raise HTTPException(422, "model_unknown_or_unavailable")
    policy_errors = {mid: policy_error(available[mid], data.allow_unenforced_output_limit)
                     for mid in data.allowed_model_ids}
    for explicit in (data.preferred_model_id, data.reviewer_model_id):
        if policy_errors.get(explicit):
            raise HTTPException(422, policy_errors[explicit])
    candidates = [available[mid] for mid in data.allowed_model_ids
                  if not policy_errors[mid] and available[mid].context_char_limit >= chars]
    # Stable sorting preserves the order explicitly supplied by the user.
    candidates.sort(key=lambda model: data.kind not in model.task_kinds)
    if not candidates:
        if all(policy_errors.values()):
            raise HTTPException(422, next(iter(policy_errors.values())))
        raise HTTPException(422, "no_model_fits_context")
    candidate_ids = {m.id for m in candidates}
    if data.preferred_model_id and data.preferred_model_id not in candidate_ids:
        raise HTTPException(422, "preferred_model_not_eligible")
    automatic = [m for m in candidates if model_family(m) != "fable"]
    if data.response_profile:
        preferred_family = {"quick": "haiku", "normal": "sonnet", "deep": "opus"}[data.response_profile]
        automatic.sort(key=lambda m: model_family(m) != preferred_family)
    if not data.preferred_model_id and not automatic:
        raise HTTPException(422, "explicit_model_selection_required")
    writer = available[data.preferred_model_id] if data.preferred_model_id else automatic[0]
    plan = [plan_step("answer", writer)]
    if data.mode == "review":
        # Review receives the answer too. Recheck its actual size at execution.
        reviewers = [m for m in candidates if m.id != writer.id]
        if data.reviewer_model_id:
            reviewers = [m for m in reviewers if m.id == data.reviewer_model_id]
        else:
            reviewers = [m for m in reviewers if model_family(m) != "fable" and review_eligible(writer, m)]
        if not reviewers:
            raise HTTPException(422, "review_requires_second_eligible_model")
        reviewer = reviewers[0]
        plan.append(plan_step("review", reviewer))
    if data.max_output_tokens is not None:
        for step in plan:
            step["max_output_tokens"] = min(step["max_output_tokens"], data.max_output_tokens)
    task = {
        "id": str(uuid4()), "project_id": project_id, "created_at": now(),
        "status": "planned", "instruction": data.instruction, "kind": data.kind,
        "gateway_protocol_version": catalog.protocol_version,
        "allow_unenforced_output_limit": data.allow_unenforced_output_limit,
        "allowed_model_ids": data.allowed_model_ids, "context": context, "plan": plan,
        "response_profile": data.response_profile,
        "routing": {"method": "configured_profile_and_preferences" if data.response_profile else "configured_tags_and_user_preference",
                    "reason": "Escolha explícita" if data.preferred_model_id else
                    f"Perfil {data.response_profile}; preferência de família configurada, sem garantia de qualidade ou acesso." if data.response_profile else
                    "Compatibilidade de contexto, categorias configuradas e sua ordem de preferência. Não é um ranking de qualidade."},
        "results": [], "error": None, "output": None,
    }
    return task
