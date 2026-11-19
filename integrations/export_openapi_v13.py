"""Bounded, opt-in multi-image contract. HTTP streaming remains disabled."""
import json
from pathlib import Path
from fastapi import Depends, FastAPI
from fastapi.security import HTTPBearer
from backend.contracts_v1_3 import GenerateRequestV13, GenerateResponseV13, ModelCatalogV13

TARGET = Path(__file__).parent / "docs" / "openapi-gateway-1.3.json"


def build():
    gateway = FastAPI(title="Provider Gateway contract 1.3", version="1.3")
    security = HTTPBearer()

    @gateway.get("/v1.3/models", response_model=ModelCatalogV13, dependencies=[Depends(security)])
    def models():
        raise NotImplementedError("Schema generation only")

    @gateway.post("/v1.3/generate", response_model=GenerateResponseV13, dependencies=[Depends(security)])
    def generate(body: GenerateRequestV13):
        raise NotImplementedError("Schema generation only")

    return gateway.openapi()


if __name__ == "__main__":
    TARGET.write_text(json.dumps(build(), ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
