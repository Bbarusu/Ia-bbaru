"""Compatibility imports: the backend owns the shared gateway 1.1 contract."""
from backend.contracts_v1_1 import (
    ModelCapabilities, ModelProfileV11, ModelCatalogV11,
    GenerateRequestV11, GenerateResponseV11,
)

__all__ = ["ModelCapabilities", "ModelProfileV11", "ModelCatalogV11",
           "GenerateRequestV11", "GenerateResponseV11"]
