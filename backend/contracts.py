"""Versioned interface shared with the provider gateway implemented by Claude."""
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, model_validator


class StrictModel(BaseModel):
    model_config = ConfigDict(extra="forbid")


TaskKind = Literal["general", "study", "writing", "coding", "analysis"]


class ModelProfile(StrictModel):
    # Globally unique ID, for example provider:model-id. Never a UI subscription.
    id: str = Field(min_length=1, max_length=200)
    provider: str = Field(min_length=1, max_length=80)
    label: str = Field(min_length=1, max_length=200)
    available: bool
    # Manually configured suitability, not an objective benchmark.
    task_kinds: list[TaskKind] = Field(min_length=1, max_length=5)
    context_char_limit: int = Field(ge=1000, le=1000000)
    max_output_tokens: int = Field(ge=1, le=32768)


class ModelCatalog(StrictModel):
    protocol_version: Literal["1"] = "1"
    models: list[ModelProfile] = Field(max_length=100)

    @model_validator(mode="after")
    def unique_ids(self):
        if len({model.id for model in self.models}) != len(self.models):
            raise ValueError("Duplicate model IDs")
        return self


class ContextItem(StrictModel):
    id: str
    title: str
    content: str


class GenerateRequest(StrictModel):
    protocol_version: Literal["1"] = "1"
    request_id: str = Field(min_length=1, max_length=200)
    model_id: str = Field(min_length=1, max_length=200)
    role: Literal["answer", "review"]
    instruction: str = Field(min_length=1, max_length=8000)
    context: list[ContextItem] = Field(max_length=20)
    previous_output: str | None = Field(default=None, max_length=100000)
    max_output_tokens: int = Field(ge=1, le=4096)


class TokenUsage(StrictModel):
    input_tokens: int = Field(ge=0)
    output_tokens: int = Field(ge=0)


class GenerateResponse(StrictModel):
    protocol_version: Literal["1"] = "1"
    request_id: str
    model_id: str
    output: str = Field(min_length=1, max_length=100000)
    usage: TokenUsage | None = None
    provider_request_id: str | None = None
    finish_reason: Literal["stop", "length"]
