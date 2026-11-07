"""HTTP service implementing contract v1 (docs/openapi-gateway.json) on port 8010."""
import hmac
import threading

from fastapi import Depends, FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from starlette.exceptions import HTTPException as StarletteHTTPException

from backend.contracts import GenerateRequest, GenerateResponse, ModelCatalog

from . import __version__, errors
from .adapters.claude_code import ClaudeCodeAdapter, NotStarted
from .config import Settings
from .dedup import DedupStore, payload_hash

# After the provider process started: a timeout leaves the outcome uncertain
# (never re-run); a refusal before any generation (login missing, plan quota
# reached) frees the request_id; any other error is stored and replayed.
UNCERTAIN_CODES = {"provider_timeout"}
REFUSED_BEFORE_GENERATION = {"provider_not_authenticated", "provider_quota_exceeded"}


def create_app(settings: Settings | None = None, adapter: ClaudeCodeAdapter | None = None,
               max_concurrency: int = 1) -> FastAPI:
    settings = settings or Settings.from_env()
    settings.validate()
    adapter = adapter or ClaudeCodeAdapter(settings.claude_code)
    store = DedupStore(settings.db_path)
    slots = threading.BoundedSemaphore(max_concurrency)
    token = settings.gateway_token.encode()

    app = FastAPI(title="Ia-bbaru provider gateway", version=__version__)
    bearer = HTTPBearer(auto_error=False)

    def authenticate(credentials: HTTPAuthorizationCredentials | None = Depends(bearer)):
        given = (credentials.credentials if credentials else "").encode()
        if not hmac.compare_digest(given, token):
            raise errors.unauthorized()

    protected = [Depends(authenticate)]

    @app.exception_handler(errors.GatewayError)
    def gateway_error(_: Request, exc: errors.GatewayError):
        return JSONResponse(exc.body(), status_code=exc.status)

    @app.exception_handler(RequestValidationError)
    def validation_error(_: Request, __: RequestValidationError):
        # No echo of the input: it may contain private course material.
        return JSONResponse(errors.invalid_request().body(), status_code=422)

    @app.exception_handler(StarletteHTTPException)
    def http_error(_: Request, exc: StarletteHTTPException):
        code = {404: "not_found", 405: "method_not_allowed"}.get(exc.status_code, "http_error")
        return JSONResponse({"error": {"code": code, "message": "Requisição inválida"}},
                            status_code=exc.status_code)

    @app.get("/health")
    def health():
        return {"status": "ok"}

    @app.get("/v1/models", response_model=ModelCatalog, dependencies=protected)
    def models():
        # Built from operator configuration + local status. Never calls a model.
        return ModelCatalog(models=adapter.profiles())

    @app.get("/v1/connections", dependencies=protected)
    def connections():
        """Experimental, outside contract v1: diagnostics and real capabilities."""
        status = adapter.status(refresh=True)
        return {"connections": [{
            **status.as_dict(),
            "configured_models": [adapter.profile_id(m) for m in settings.claude_code.models],
            "capabilities": {
                "inference": True, "review": True, "streaming": False, "tools": "disabled",
                "output_limit": "best_effort", "cancellation": "local_process_only",
                "finish_reason": "inferred", "billing": "subscription_quota",
                "source_import": False,
            },
        }]}

    @app.post("/v1/generate", response_model=GenerateResponse, dependencies=protected)
    def generate(body: GenerateRequest):
        digest = payload_hash(body.model_dump(mode="json"))
        replay = _existing(store, body.request_id, digest)
        if replay is not None:
            return replay
        adapter.check_request(body)
        if not slots.acquire(blocking=False):
            raise errors.busy()
        try:
            if not store.reserve(body.request_id, digest):
                replay = _existing(store, body.request_id, digest)
                if replay is not None:
                    return replay
                raise errors.request_in_progress()
            try:
                result = adapter.generate(body)
            except NotStarted as exc:
                store.release(body.request_id)
                raise exc.error
            except errors.GatewayError as exc:
                if exc.code in UNCERTAIN_CODES:
                    store.mark_uncertain(body.request_id, exc.status, exc.body())
                elif exc.code in REFUSED_BEFORE_GENERATION:
                    store.release(body.request_id)
                else:
                    store.complete(body.request_id, exc.status, exc.body())
                raise
            except Exception:
                store.mark_uncertain(body.request_id, 502, errors.provider_error().body())
                raise errors.provider_error("gateway_internal_error")
            store.complete(body.request_id, 200, result.model_dump(mode="json"))
            return result
        finally:
            slots.release()

    return app


def _existing(store: DedupStore, request_id: str, digest: str):
    existing = store.get(request_id)
    if existing is None:
        return None
    if existing.payload_hash != digest:
        raise errors.request_id_conflict()
    if existing.state == "running":
        raise errors.request_in_progress()
    if existing.state == "uncertain":
        raise errors.request_outcome_uncertain()
    if existing.status_code == 200:
        return GenerateResponse.model_validate(existing.body)
    return JSONResponse(existing.body, status_code=existing.status_code)
