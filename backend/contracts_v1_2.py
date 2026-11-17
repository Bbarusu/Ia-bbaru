"""Gateway 1.2: text generation with the provider-reported served model.

1/1.1 remain unchanged for strict older consumers. Streaming and images are
not introduced by this version; their capabilities remain false/unsupported.
"""
from typing import Literal
from pydantic import Field
from .contracts_v1_1 import GenerateRequestV11, GenerateResponseV11, ModelCatalogV11


class ModelCatalogV12(ModelCatalogV11):
    protocol_version: Literal["1.2"] = "1.2"


class GenerateRequestV12(GenerateRequestV11):
    protocol_version: Literal["1.2"]


class GenerateResponseV12(GenerateResponseV11):
    protocol_version: Literal["1.2"] = "1.2"
    served_model: str | None = Field(default=None, min_length=1, max_length=100,
                                   pattern=r"^claude-[A-Za-z0-9.\[\]-]+$")
