"""Shared schema selection; never silently change a persisted task's protocol."""
from .contracts import GenerateRequest, GenerateResponse, ModelCatalog
from .contracts_v1_1 import GenerateRequestV11, GenerateResponseV11, ModelCatalogV11
from .contracts_v1_2 import GenerateRequestV12, GenerateResponseV12, ModelCatalogV12

REQUESTS = {"1": GenerateRequest, "1.1": GenerateRequestV11, "1.2": GenerateRequestV12}
RESPONSES = {"1": GenerateResponse, "1.1": GenerateResponseV11, "1.2": GenerateResponseV12}
CATALOGS = {"1": ModelCatalog, "1.1": ModelCatalogV11, "1.2": ModelCatalogV12}
