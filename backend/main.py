import hmac
import json
import os
from contextlib import asynccontextmanager
from datetime import datetime, timezone
from typing import Literal
from uuid import uuid4

from fastapi import Depends, FastAPI, HTTPException, Query
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from pydantic import Field, field_validator

from .contracts import ContextItem, GenerateRequest, ModelCatalog, StrictModel, TaskKind
from .contracts_v1_1 import GenerateRequestV11, ModelCatalogV11
from .capabilities import plan_step, policy_error, preflight_error
from .gateway import GatewayUnavailable, HttpGateway
from .store import Store


def now():
    return datetime.now(timezone.utc).isoformat()


class ProjectInput(StrictModel):
    title: str = Field(min_length=1, max_length=120)

    @field_validator("title")
    @classmethod
    def nonblank(cls, value):
        if not value.strip():
            raise ValueError("Title must not be blank")
        return value.strip()


class SourceInput(ProjectInput):
    content: str = Field(min_length=1, max_length=40000)


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


def create_app(db_path=None, api_token=None, gateway=None):
    token = api_token if api_token is not None else os.environ.get("LAUNCHER_API_TOKEN", "")
    gateway = gateway or HttpGateway(os.environ.get("GATEWAY_URL"), os.environ.get("GATEWAY_TOKEN"),
                                     os.environ.get("GATEWAY_PROTOCOL_VERSION", "1"))
    store = Store(db_path or os.environ.get("LAUNCHER_DB_PATH", "data/launcher.sqlite3"))

    @asynccontextmanager
    async def lifespan(app):
        if len(token) < 32:
            raise RuntimeError("Set LAUNCHER_API_TOKEN to a random token with at least 32 characters")
        store.recover()
        yield

    app = FastAPI(title="AI Launcher backend", version="0.1.0", lifespan=lifespan)
    app.state.store = store
    security = HTTPBearer(auto_error=False)

    def authorize(credentials: HTTPAuthorizationCredentials | None = Depends(security)):
        if (not credentials or len(token) < 32 or
                not hmac.compare_digest(credentials.credentials.encode(), token.encode())):
            raise HTTPException(401, "invalid_credentials", headers={"WWW-Authenticate": "Bearer"})

    protected = [Depends(authorize)]

    def project_exists(project_id):
        with store.connect() as conn:
            row = conn.execute("SELECT id FROM projects WHERE id=?", (project_id,)).fetchone()
        if not row:
            raise HTTPException(404, "project_not_found")

    def load_task(task_id):
        task = store.task(task_id)
        if task is None:
            raise HTTPException(404, "task_not_found")
        return task

    @app.get("/health")
    def health():
        return {"status": "ok", "version": "0.1.0"}

    @app.get("/v1/models", response_model=ModelCatalog | ModelCatalogV11, dependencies=protected)
    def models():
        try:
            return gateway.catalog()
        except GatewayUnavailable:
            raise HTTPException(503, "gateway_unavailable")

    @app.post("/v1/projects", status_code=201, dependencies=protected)
    def create_project(data: ProjectInput):
        project = {"id": str(uuid4()), "title": data.title, "created_at": now()}
        with store.connect() as conn:
            conn.execute("INSERT INTO projects VALUES (:id,:title,:created_at)", project)
        return project

    @app.get("/v1/projects", dependencies=protected)
    def list_projects(limit: int = Query(50, ge=1, le=100), offset: int = Query(0, ge=0)):
        with store.connect() as conn:
            rows = conn.execute("SELECT * FROM projects ORDER BY created_at DESC, id LIMIT ? OFFSET ?", (limit + 1, offset)).fetchall()
            return {"items": [dict(r) for r in rows[:limit]], "next_offset": offset + limit if len(rows) > limit else None}

    @app.post("/v1/projects/{project_id}/sources", status_code=201, dependencies=protected)
    def add_source(project_id: str, data: SourceInput):
        project_exists(project_id)
        source = {"id": str(uuid4()), "project_id": project_id,
                  "title": data.title, "content": data.content, "created_at": now()}
        with store.connect() as conn:
            conn.execute("INSERT INTO sources VALUES (:id,:project_id,:title,:content,:created_at)", source)
        return source

    @app.get("/v1/projects/{project_id}/sources", dependencies=protected)
    def list_sources(project_id: str, limit: int = Query(20, ge=1, le=100),
                     offset: int = Query(0, ge=0), summary: bool = False):
        project_exists(project_id)
        with store.connect() as conn:
            rows = conn.execute("SELECT * FROM sources WHERE project_id=? ORDER BY created_at, id LIMIT ? OFFSET ?",
                                (project_id, limit + 1, offset)).fetchall()
            items = [dict(r) for r in rows[:limit]]
            if summary:
                for item in items:
                    content = item.pop("content")
                    item.update(preview=content[:160], char_count=len(content))
            return {"items": items, "next_offset": offset + limit if len(rows) > limit else None}

    @app.get("/v1/projects/{project_id}/sources/{source_id}", dependencies=protected)
    def get_source(project_id: str, source_id: str):
        project_exists(project_id)
        with store.connect() as conn:
            row = conn.execute("SELECT * FROM sources WHERE id=? AND project_id=?", (source_id, project_id)).fetchone()
        if not row:
            raise HTTPException(404, "source_not_found")
        return dict(row)

    @app.post("/v1/projects/{project_id}/tasks", status_code=201, dependencies=protected)
    def create_task(project_id: str, data: TaskInput):
        project_exists(project_id)
        if data.mode == "single" and data.reviewer_model_id:
            raise HTTPException(422, "reviewer_requires_review_mode")
        context = []
        with store.connect() as conn:
            for source_id in data.source_ids:
                row = conn.execute("SELECT id,title,content FROM sources WHERE id=? AND project_id=?",
                                   (source_id, project_id)).fetchone()
                if row is None:
                    raise HTTPException(422, "source_not_in_project")
                context.append(dict(row))
        chars = len(data.instruction) + sum(len(s["content"]) + len(s["title"]) for s in context)
        if chars > 80000:
            raise HTTPException(422, "context_too_large")
        try:
            catalog = gateway.catalog()
        except GatewayUnavailable:
            raise HTTPException(503, "gateway_unavailable")
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
        writer = available[data.preferred_model_id] if data.preferred_model_id else candidates[0]
        plan = [plan_step("answer", writer)]
        if data.mode == "review":
            # Review receives the answer too. Recheck its actual size at execution.
            reviewers = [m for m in candidates if m.id != writer.id]
            if data.reviewer_model_id:
                reviewers = [m for m in reviewers if m.id == data.reviewer_model_id]
            if not reviewers:
                raise HTTPException(422, "review_requires_second_eligible_model")
            reviewer = reviewers[0]
            plan.append(plan_step("review", reviewer))
        task = {
            "id": str(uuid4()), "project_id": project_id, "created_at": now(),
            "status": "planned", "instruction": data.instruction, "kind": data.kind,
            "gateway_protocol_version": catalog.protocol_version,
            "allow_unenforced_output_limit": data.allow_unenforced_output_limit,
            "allowed_model_ids": data.allowed_model_ids, "context": context, "plan": plan,
            "routing": {"method": "configured_tags_and_user_preference",
                        "reason": "Escolha explícita" if data.preferred_model_id else
                        "Compatibilidade de contexto, categorias configuradas e sua ordem de preferência. Não é um ranking de qualidade."},
            "results": [], "error": None, "output": None,
        }
        with store.connect() as conn:
            conn.execute("INSERT INTO tasks VALUES (?,?,?,?)",
                         (task["id"], project_id, task["status"], json.dumps(task)))
        return task

    @app.get("/v1/projects/{project_id}/tasks", dependencies=protected)
    def list_tasks(project_id: str, limit: int = Query(20, ge=1, le=100),
                   offset: int = Query(0, ge=0), summary: bool = False):
        project_exists(project_id)
        with store.connect() as conn:
            rows = conn.execute("SELECT body FROM tasks WHERE project_id=? ORDER BY rowid DESC LIMIT ? OFFSET ?",
                                (project_id, limit + 1, offset)).fetchall()
            items = [json.loads(r["body"]) for r in rows[:limit]]
            if summary:
                items = [{k: t[k] for k in ("id", "project_id", "created_at", "status", "instruction", "kind", "plan", "error")} for t in items]
            return {"items": items, "next_offset": offset + limit if len(rows) > limit else None}

    @app.get("/v1/tasks/{task_id}", dependencies=protected)
    def get_task(task_id: str):
        return load_task(task_id)

    @app.post("/v1/tasks/{task_id}/execute", dependencies=protected)
    def execute_task(task_id: str):
        load_task(task_id)
        task = store.claim(task_id)
        if task is None:
            raise HTTPException(409, "task_already_executed_or_running")
        previous = None
        for index, step in enumerate(task["plan"]):
            # Check every remaining model before the first call, then refresh
            # before review. No generation is repeated on any preflight failure.
            try:
                error = preflight_error(task, gateway.catalog(), task["plan"][index:])
            except GatewayUnavailable:
                error = "gateway_preflight_failed"
            if error:
                task.update(status="failed", error=error, output=previous)
                store.save_task(task)
                return task
            input_chars = len(task["instruction"]) + sum(
                len(s["content"]) + len(s["title"]) for s in task["context"]
            ) + len(previous or "")
            if input_chars > step["context_char_limit"]:
                task.update(status="failed", error="review_context_too_large")
                store.save_task(task)
                return task
            request_fields = dict(
                request_id=f"{task_id}:{index}", model_id=step["model_id"], role=step["role"],
                instruction=task["instruction"], context=[ContextItem(**s) for s in task["context"]],
                previous_output=previous, max_output_tokens=step["max_output_tokens"],
            )
            if task.get("gateway_protocol_version", "1") == "1.1":
                request = GenerateRequestV11(
                    **request_fields, protocol_version="1.1",
                    allow_unenforced_output_limit=task.get("allow_unenforced_output_limit", False))
            else:
                request = GenerateRequest(**request_fields)
            try:
                result = gateway.generate(request)
            except GatewayUnavailable:
                task.update(status="failed", error="gateway_failed_outcome_may_be_unknown")
                store.save_task(task)
                return task
            task["results"].append({"role": step["role"], **result.model_dump()})
            previous = result.output
            store.save_task(task)
            if result.finish_reason in {"length", "unknown"}:
                task.update(status="incomplete", output=previous,
                            error="completion_unconfirmed" if result.finish_reason == "unknown"
                            else "output_token_limit_reached")
                store.save_task(task)
                return task
        task.update(status="completed", output=previous, completed_at=now())
        store.save_task(task)
        return task

    return app
