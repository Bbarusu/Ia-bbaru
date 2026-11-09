"""Gateway contract 1.1, as decided in docs/DECISAO_CAPACIDADES.md (Codex branch).

Separate schemas and routes (/v1.1/models, /v1.1/generate) so strict v1
consumers keep working unchanged. Sub-objects identical to v1 are reused.

These models are the gateway-side implementation of the decision. When the
backend publishes its own 1.1 schemas, both sides must be compared field by
field (see integrations/docs/openapi-gateway-1.1.json and its test).
"""
from typing import Literal

from pydantic import Field, model_validator

from backend.contracts import ContextItem, StrictModel, TaskKind, TokenUsage


class ModelCapabilities(StrictModel):
    output_limit: Literal["enforced", "best_effort", "none"]
    cancellation: Literal["provider", "local_process_only", "none"]
    finish_reason: Literal["reported", "inferred"]
    billing: Literal["api_key", "subscription_quota", "unknown"]
    streaming: bool
    tools: Literal["disabled", "restricted"]


class ModelProfileV11(StrictModel):
    id: str = Field(min_length=1, max_length=200)
    provider: str = Field(min_length=1, max_length=80)
    label: str = Field(min_length=1, max_length=200)
    available: bool
    task_kinds: list[TaskKind] = Field(min_length=1, max_length=5)
    context_char_limit: int = Field(ge=1000, le=1000000)
    # Read together with capabilities.output_limit: a hard cap only when "enforced".
    max_output_tokens: int = Field(ge=1, le=32768)
    capabilities: ModelCapabilities
    unavailable_reason: str | None = Field(default=None, max_length=80)


class ModelCatalogV11(StrictModel):
    protocol_version: Literal["1.1"] = "1.1"
    models: list[ModelProfileV11] = Field(max_length=100)

    @model_validator(mode="after")
    def unique_ids(self):
        if len({model.id for model in self.models}) != len(self.models):
            raise ValueError("Duplicate model IDs")
        return self


class GenerateRequestV11(StrictModel):
    protocol_version: Literal["1.1"]
    request_id: str = Field(min_length=1, max_length=200)
    model_id: str = Field(min_length=1, max_length=200)
    role: Literal["answer", "review"]
    instruction: str = Field(min_length=1, max_length=8000)
    context: list[ContextItem] = Field(max_length=20)
    previous_output: str | None = Field(default=None, max_length=100000)
    max_output_tokens: int = Field(ge=1, le=4096)
    # Per-task acceptance persisted by the backend; checked before the provider starts.
    allow_unenforced_output_limit: bool = False


class GenerateResponseV11(StrictModel):
    protocol_version: Literal["1.1"] = "1.1"
    request_id: str
    model_id: str
    output: str = Field(min_length=1, max_length=100000)
    usage: TokenUsage | None = None
    provider_request_id: str | None = None
    # unknown = completion not confirmed by the provider; never equivalent to stop.
    finish_reason: Literal["stop", "length", "unknown"]
