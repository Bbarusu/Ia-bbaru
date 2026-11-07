"""Write integrations/docs/openapi-gateway-1.1.json (contract 1.1 only).

    python -m integrations.export_openapi

Same approach as docs/export_contracts.py: schema generation only, no service.
"""
import json
from pathlib import Path

from fastapi import Depends, FastAPI
from fastapi.security import HTTPBearer

from .contracts_v1_1 import GenerateRequestV11, GenerateResponseV11, ModelCatalogV11

TARGET = Path(__file__).parent / "docs" / "openapi-gateway-1.1.json"


def build() -> dict:
    gateway = FastAPI(title="Provider Gateway contract 1.1 (Ia-bbaru integrations)", version="1.1")
    security = HTTPBearer()

    @gateway.get("/v1.1/models", response_model=ModelCatalogV11, dependencies=[Depends(security)])
    def models():
        raise NotImplementedError("Schema generation only")

    @gateway.post("/v1.1/generate", response_model=GenerateResponseV11, dependencies=[Depends(security)])
    def generate(body: GenerateRequestV11):
        raise NotImplementedError("Schema generation only")

    return gateway.openapi()


def main():
    TARGET.write_text(json.dumps(build(), ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"escrito {TARGET}")


if __name__ == "__main__":
    main()
