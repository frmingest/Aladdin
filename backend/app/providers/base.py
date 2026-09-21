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
from datetime import datetime

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


# --- Research provider interface (Sprint 2 — live, evidence-first research) ---
#
# A second, deliberately separate interface from LLMProvider above: an
# LLMProvider's job is structured JSON reasoning over evidence it's handed
# (CLAUDE.md Rule 1 — never arithmetic); a ResearchProvider's job is going
# OUT to find new, source-attributed evidence in the first place (macro/
# geopolitical, sector, or per-company). Keeping them separate means a
# caller is never tempted to blur "reason over given evidence" with
# "go find evidence" behind one interface.


class ResearchUnavailableError(Exception):
    """Raised when a ResearchProvider cannot produce a usable result — a
    non-retryable vendor error, retries exhausted, missing config, or a
    response with no grounding at all. Mirrors LLMUnavailableError's role
    for LLMProvider: callers don't need to distinguish the cause, only that
    there's no result to persist."""


@dataclass(frozen=True)
class ResearchItem:
    """One source-attributed finding a ResearchProvider returned.

    CLAUDE.md Rule 2 (evidence-first, always traceable): every field here
    exists so app/services/research can persist a real, citable source —
    never a paraphrase with the citation dropped.
    """

    source_url: str
    source_name: str
    title: str
    summary: str
    source_type: str
    retrieved_at: datetime
    published_at: datetime | None = None


class ResearchProvider(ABC):
    """A vendor-agnostic, grounded/search-backed research provider."""

    name: str

    @abstractmethod
    def get_macro_research(self) -> list[ResearchItem]:
        """Portfolio-wide macro/geopolitical research (rates, inflation,
        conflicts, currencies, regulation, sector trends) — the Brain's
        Opening step."""
        raise NotImplementedError

    @abstractmethod
    def get_sector_research(self, sector: str) -> list[ResearchItem]:
        """Research scoped to one sector, shared by every holding in it."""
        raise NotImplementedError

    @abstractmethod
    def get_company_research(
        self, *, company_name: str, ticker: str, sector: str | None
    ) -> list[ResearchItem]:
        """Research scoped to one company — industry/geography/competitive
        environment specific to that holding (the Iran/energy example)."""
        raise NotImplementedError
