"""Vendor-agnostic LLM provider interface.

Every provider (Gemini, Mistral, ...) implements this ABC so the analysis
pipeline (built in a later sprint) can call `generate_structured()` without
knowing which vendor is behind it — `app.providers.factory` decides that
from config. CLAUDE.md Rule 1 still applies here: a provider hands back the
raw structured record the model produced; nothing in this layer computes
financial arithmetic.
"""
from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass

from pydantic import BaseModel


class LLMUnavailableError(Exception):
    """Raised when a provider cannot produce a usable response.

    Covers both a non-retryable vendor error (auth failure, retired model,
    malformed request) and a retryable one that has exhausted its retries —
    callers don't need to distinguish the two, they just don't have a result.
    """


@dataclass(frozen=True)
class LLMUsageMetrics:
    """One provider call's real, vendor-reported token usage.

    Populated from the vendor's own usage field (Gemini's usage_metadata,
    Mistral's usage), not estimated — see
    claude/llm-usage-ledger-and-rate-limit-estimation.md. A later sprint
    persists these into an `llm_usage_events` ledger once the DB models
    exist; for now callers can log or discard them.
    """

    provider: str
    model: str
    input_tokens: int
    output_tokens: int
    total_tokens: int


@dataclass(frozen=True)
class LLMResponse:
    """A provider's raw response: the model's own JSON text, plus usage."""

    content: str
    usage: LLMUsageMetrics


class LLMProvider(ABC):
    """A vendor-agnostic chat/completion provider with structured output."""

    name: str

    @abstractmethod
    def generate_structured(
        self,
        *,
        system_prompt: str,
        user_prompt: str,
        response_schema: type[BaseModel],
    ) -> LLMResponse:
        """Ask the model for a response constrained to `response_schema`.

        Must raise LLMUnavailableError rather than return a malformed or
        partial response — callers validate `.content` directly against
        `response_schema.model_validate_json(...)` and expect it to succeed.
        """
        raise NotImplementedError
