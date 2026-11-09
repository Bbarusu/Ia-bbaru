"""HTTP gateway on port 8010.

- Contract 1 (docs/openapi-gateway.json): /v1/models and /v1/generate, unchanged.
- Contract 1.1 (docs/DECISAO_CAPACIDADES.md): /v1.1/models and /v1.1/generate,
  with capabilities, per-task acceptance and finish_reason "unknown".
- /v1/connections: experimental diagnostics, outside both contracts.
"""
import hmac
import threading

from fastapi import Depends, FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from starlette.exceptions import HTTPException as StarletteHTTPException

from backend.contracts import GenerateRequest, GenerateResponse, ModelCatalog

from . import __version__, errors
from .adapters.claude_code import CAPABILITIES, ClaudeCodeAdapter, NotStarted, ProviderResult
from .config import Settings
from .contracts_v1_1 import GenerateRequestV11, GenerateResponseV11, ModelCatalogV11
from .dedup import DedupStore, payload_hash

# Once the provider process has started, the request_id is never released:
# a timeout is stored as uncertain (409 forever) and every other outcome,
# success or error, is stored and replayed. Only NotStarted frees the ID.
UNCERTAIN_CODES = {"provider_timeout"}
RESPONSE_MODELS = {"1": GenerateResponse, "1.1": GenerateResponseV11}


def to_v1(request: GenerateRequest, result: ProviderResult) -> GenerateResponse:
    """Contract 1 only knows stop|length and a hard output cap."""
    if result.finish_reason == "unknown":
        raise errors.completion_unconfirmed()
    if result.usage and result.usage.output_tokens > request.max_output_tokens:
        raise errors.provider_error("output_limit_not_honored")
    return GenerateResponse(
        request_id=request.request_id, model_id=request.model_id, output=result.output,
        usage=result.usage, provider_request_id=None, finish_reason=result.finish_reason,
    )


def to_v11(request: GenerateRequestV11, result: ProviderResult) -> GenerateResponseV11:
    # The task accepted a best-effort cap; the output is delivered as is.
    return GenerateResponseV11(
        request_id=request.request_id, model_id=request.model_id, output=result.output,
        usage=result.usage, provider_request_id=None, finish_reason=result.finish_reason,
    )


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
        return {"status": "ok", "protocol_versions": ["1", "1.1"]}

    # Catalogs are built from operator configuration + local status. No model call.
    @app.get("/v1/models", response_model=ModelCatalog, dependencies=protected)
    def models():
        return ModelCatalog(models=adapter.profiles())

    @app.get("/v1.1/models", response_model=ModelCatalogV11, dependencies=protected)
    def models_v11():
        return ModelCatalogV11(models=adapter.profiles_v11())

    @app.get("/v1/connections", dependencies=protected)
    def connections():
        """Experimental, outside the contracts: diagnostics and real capabilities."""
        status = adapter.status(refresh=True)
        return {"connections": [{
            **status.as_dict(),
            "contract_1_available": adapter.v1_gate().ready,
            "configured_models": [adapter.profile_id(m) for m in settings.claude_code.models],
            "capabilities": CAPABILITIES.model_dump(),
        }]}

    def run(body, convert):
        digest = payload_hash(body.model_dump(mode="json"))
        response_model = RESPONSE_MODELS[body.protocol_version]
        replay = _existing(store, body.request_id, digest, response_model)
        if replay is not None:
            return replay
        adapter.check_request(body)
        if not slots.acquire(blocking=False):
            raise errors.busy()
        try:
            if not store.reserve(body.request_id, digest):
                replay = _existing(store, body.request_id, digest, response_model)
                if replay is not None:
                    return replay
                raise errors.request_in_progress()
            try:
                result = convert(body, adapter.generate(body))
            except NotStarted as exc:
                store.release(body.request_id)
                raise exc.error
            except errors.GatewayError as exc:
                if exc.code in UNCERTAIN_CODES:
                    store.mark_uncertain(body.request_id, exc.status, exc.body())
                else:
                    store.complete(body.request_id, exc.status, exc.body())
                raise
            except Exception:
                # The provider may already have run: report the outcome as
                # uncertain from the first answer, as every repeat will (409).
                uncertain = errors.request_outcome_uncertain()
                store.mark_uncertain(body.request_id, uncertain.status, uncertain.body())
                raise uncertain
            store.complete(body.request_id, 200, result.model_dump(mode="json"))
            return result
        finally:
            slots.release()

    @app.post("/v1/generate", response_model=GenerateResponse, dependencies=protected)
    def generate(body: GenerateRequest):
        return run(body, to_v1)

    @app.post("/v1.1/generate", response_model=GenerateResponseV11, dependencies=protected)
    def generate_v11(body: GenerateRequestV11):
        return run(body, to_v11)

    return app


def _existing(store: DedupStore, request_id: str, digest: str, response_model):
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
        return response_model.model_validate(existing.body)
    return JSONResponse(existing.body, status_code=existing.status_code)
