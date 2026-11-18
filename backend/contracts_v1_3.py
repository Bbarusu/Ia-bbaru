"""Opt-in 1.3: bounded multi-image input; these are product limits, not CLI claims."""
from typing import Literal
from pydantic import Field, model_validator
from .contracts import StrictModel
from .contracts_v1_2 import (VisualAttachment, AttachmentReceipt, GenerateRequestV12,
    GenerateResponseV12, ModelProfileV12, ModelCatalogV12, ImageCapability)

class ImageCapabilityV13(ImageCapability):
    max_images: Literal[4] = 4
    max_total_bytes: Literal[1920000] = 1920000
    max_total_pixels: Literal[32000000] = 32000000

class InputCapabilitiesV13(StrictModel):
    image: ImageCapabilityV13 = Field(default_factory=ImageCapabilityV13)

class ModelProfileV13(ModelProfileV12):
    input: InputCapabilitiesV13 = Field(default_factory=InputCapabilitiesV13)

class ModelCatalogV13(ModelCatalogV12):
    protocol_version: Literal["1.3"] = "1.3"
    models: list[ModelProfileV13]

class GenerateRequestV13(GenerateRequestV12):
    protocol_version: Literal["1.3"]
    attachments: list[VisualAttachment] = Field(default_factory=list, max_length=4)

    @model_validator(mode="after")
    def bounded_images(self):
        if len({a.id for a in self.attachments}) != len(self.attachments):
            raise ValueError("Duplicate attachments")
        if sum(a.byte_count for a in self.attachments) > 1920000 or sum(a.width * a.height for a in self.attachments) > 32000000:
            raise ValueError("Total image budget exceeded")
        return self

class GenerateResponseV13(GenerateResponseV12):
    protocol_version: Literal["1.3"] = "1.3"
    attachments_used: list[AttachmentReceipt] = Field(default_factory=list, max_length=4)
