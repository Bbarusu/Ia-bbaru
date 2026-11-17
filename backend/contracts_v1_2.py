"""Gateway 1.2: served model and explicit, bounded raster attachments.

1/1.1 remain unchanged. HTTP streaming remains false. Vision requires a
configured model capability and separate per-request acceptance.
"""
from typing import Literal
import base64
import hashlib
from pydantic import Field, model_validator
from .contracts import StrictModel
from .contracts_v1_1 import GenerateRequestV11, GenerateResponseV11, ModelCatalogV11, ModelProfileV11
from .media import MediaInput, validate_media


class ImageCapability(StrictModel):
    supported: bool = False
    mime_types: list[Literal["image/png", "image/jpeg"]] = Field(default_factory=lambda: ["image/png", "image/jpeg"])
    max_images: Literal[1] = 1
    max_bytes_per_image: Literal[480000] = 480000
    max_pixels: Literal[16000000] = 16000000
    transport: Literal["cli_stream_input"] = "cli_stream_input"


class InputCapabilities(StrictModel):
    image: ImageCapability = Field(default_factory=ImageCapability)


class ModelProfileV12(ModelProfileV11):
    input: InputCapabilities = Field(default_factory=InputCapabilities)


class AttachmentReceipt(StrictModel):
    id: str = Field(pattern=r"^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$")
    sha256: str = Field(pattern=r"^[a-f0-9]{64}$")


class VisualAttachment(AttachmentReceipt):
    project_id: str = Field(pattern=r"^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$")
    kind: Literal["image", "screenshot"]
    mime_type: Literal["image/png", "image/jpeg"]
    byte_count: int = Field(ge=1, le=480000, strict=True)
    width: int = Field(ge=1, le=8000, strict=True)
    height: int = Field(ge=1, le=8000, strict=True)
    data_base64: str = Field(min_length=1, max_length=640000)

    @model_validator(mode="after")
    def valid_image(self):
        verified = validate_media(MediaInput(kind=self.kind, data_url=f"data:{self.mime_type};base64,{self.data_base64}"))
        if any(getattr(self, key) != verified[key] for key in ("width", "height", "byte_count")):
            raise ValueError("Image metadata mismatch")
        if hashlib.sha256(base64.b64decode(self.data_base64, validate=True)).hexdigest() != self.sha256:
            raise ValueError("Image hash mismatch")
        return self


class ModelCatalogV12(ModelCatalogV11):
    protocol_version: Literal["1.2"] = "1.2"
    models: list[ModelProfileV12]


class GenerateRequestV12(GenerateRequestV11):
    protocol_version: Literal["1.2"]
    attachments: list[VisualAttachment] = Field(default_factory=list, max_length=1)
    allow_visual_input: bool = Field(default=False, strict=True)


class GenerateResponseV12(GenerateResponseV11):
    protocol_version: Literal["1.2"] = "1.2"
    served_model: str | None = Field(default=None, min_length=1, max_length=100,
                                   pattern=r"^claude-[A-Za-z0-9.\[\]-]+$")
    attachments_used: list[AttachmentReceipt] = Field(default_factory=list, max_length=1)
