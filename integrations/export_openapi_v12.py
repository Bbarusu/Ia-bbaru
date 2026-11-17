"""Contract 1.2 adds served_model only; no streaming or vision."""
import json
from pathlib import Path
from fastapi import Depends, FastAPI
from fastapi.security import HTTPBearer
from backend.contracts_v1_2 import GenerateRequestV12, GenerateResponseV12, ModelCatalogV12

TARGET = Path(__file__).parent / "docs" / "openapi-gateway-1.2.json"


def build():
    gateway = FastAPI(title="Provider Gateway contract 1.2", version="1.2")
    security = HTTPBearer()

    @gateway.get("/v1.2/models", response_model=ModelCatalogV12, dependencies=[Depends(security)])
    def models():
        raise NotImplementedError("Schema generation only")

    @gateway.post("/v1.2/generate", response_model=GenerateResponseV12, dependencies=[Depends(security)])
    def generate(body: GenerateRequestV12):
        raise NotImplementedError("Schema generation only")

    return gateway.openapi()


if __name__ == "__main__":
    TARGET.write_text(json.dumps(build(), ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
