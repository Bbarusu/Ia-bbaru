"""Generate OpenAPI artifacts without starting either HTTP service."""
import json
import tempfile
from pathlib import Path

from fastapi import Depends, FastAPI
from fastapi.security import HTTPBearer

from backend.contracts import GenerateRequest, GenerateResponse, ModelCatalog
from backend.main import create_app


def main():
    target = Path(__file__).parent
    with tempfile.TemporaryDirectory() as directory:
        backend = create_app(Path(directory) / "schema.db", "schema-only-token-not-a-real-credential")
        (target / "openapi-backend.json").write_text(
            json.dumps(backend.openapi(), ensure_ascii=False, indent=2) + "\n")

    gateway = FastAPI(title="Provider Gateway contract (not an implementation)", version="1")
    security = HTTPBearer()

    @gateway.get("/v1/models", response_model=ModelCatalog, dependencies=[Depends(security)])
    def models():
        raise NotImplementedError("Schema generation only")

    @gateway.post("/v1/generate", response_model=GenerateResponse, dependencies=[Depends(security)])
    def generate(body: GenerateRequest):
        raise NotImplementedError("Schema generation only")

    (target / "openapi-gateway.json").write_text(
        json.dumps(gateway.openapi(), ensure_ascii=False, indent=2) + "\n")


if __name__ == "__main__":
    main()
