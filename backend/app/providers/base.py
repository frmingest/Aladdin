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
from decimal import Decimal

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


# --- Market data provider interface (Sprint 3 — valuation engine) ---
#
# A third, deliberately separate interface: unlike ResearchProvider (goes
# out and finds new qualitative evidence) or LLMProvider (reasons over
# evidence it's handed), a MarketDataProvider's job is narrow and purely
# numeric — the live share price, FX rate, and beta a DCF/multiple needs
# that isn't in a filing (app/models/financial_line_item.py already covers
# everything document-sourced; CLAUDE.md Rule 1 still applies — this layer
# hands back raw market facts, the arithmetic lives in
# app/services/valuation/ and app/services/calculations.py).


class MarketDataUnavailableError(Exception):
    """Raised when a MarketDataProvider cannot produce a usable result — a
    bad/delisted ticker, a vendor outage, or an unrecognized currency pair.
    Mirrors ResearchUnavailableError's role: callers persist a real failure
    (CLAUDE.md: fail visibly) rather than silently substituting a guess."""


@dataclass(frozen=True)
class PricePoint:
    """One point-in-time share price, as app/models/market.py's
    MarketObservation persists it."""

    price: Decimal
    currency: str
    observed_at: datetime
    provider: str


@dataclass(frozen=True)
class FxRate:
    """One point-in-time FX rate, as app/models/market.py's FxObservation
    persists it."""

    from_currency: str
    to_currency: str
    rate: Decimal
    observed_at: datetime
    provider: str


class MarketDataProvider(ABC):
    """A vendor-agnostic live market-data provider (current/historical
    share price, FX, beta)."""

    name: str

    @abstractmethod
    def get_current_price(self, ticker: str, *, currency_hint: str | None = None) -> PricePoint:
        """The latest traded price for `ticker`.

        `currency_hint` is the holding's own `trading_currency` (already
        known, real data — app/models/holding.py) — used only as a last
        resort if the vendor's own history-only fallback path can't
        determine a currency itself; never overrides a currency the vendor
        *did* report, so a real vendor/our-data mismatch stays visible
        rather than getting silently papered over.
        """
        raise NotImplementedError

    @abstractmethod
    def get_price_history(
        self, ticker: str, *, years: int = 5, currency_hint: str | None = None
    ) -> list[PricePoint]:
        """Historical closing prices for `ticker`, oldest first — feeds
        multiples-over-time (app/services/valuation/multiples.py)."""
        raise NotImplementedError

    @abstractmethod
    def get_fx_rate(self, from_currency: str, to_currency: str) -> FxRate:
        """The latest from_currency -> to_currency rate. Implementations
        should return rate=1 immediately (no vendor call) when the two
        currencies are identical."""
        raise NotImplementedError

    @abstractmethod
    def get_beta(self, ticker: str) -> Decimal | None:
        """5-year monthly beta vs. the ticker's home index, if the vendor
        publishes one. None (not an error) when unavailable — callers fall
        back to a versioned default (see
        app/domain/valuation_assumptions/)."""
        raise NotImplementedError

    def get_shares_outstanding(self, ticker: str) -> Decimal:
        """The vendor's current count of shares outstanding (2026-09-25,
        app/services/market_data/shares.py). Not abstract: a provider that
        has no share counts simply raises, and the share-count service falls
        back to the next source."""
        raise MarketDataUnavailableError(f"{self.name} does not provide share counts")

    def get_daily_price_history(
        self, ticker: str, *, days: int = 400, currency_hint: str | None = None
    ) -> list[PricePoint]:
        """Daily closing prices for `ticker` over roughly the last `days`
        calendar days, oldest first (2026-09-26, Sprint 12 —
        app/services/risk/). Distinct from `get_price_history` above, which
        is monthly and feeds multiples-over-time: portfolio risk needs
        genuine daily returns to compute a correlation matrix and
        volatility-based stress sizing. Not abstract, same discipline as
        `get_shares_outstanding`: a provider with no daily history simply
        raises, and the caller (app/services/risk/price_history.py) falls
        back to a cached observation or excludes the holding with a stated
        reason — it never invents a price."""
        raise MarketDataUnavailableError(f"{self.name} does not provide daily price history")


# --- Risk-free-rate provider interface (Sprint 3 — DCF discount rate) ---


class RiskFreeRateUnavailableError(Exception):
    """Raised when a RiskFreeRateProvider cannot produce a usable rate — an
    unmapped currency (app/domain/risk_free_rate_series.py has no series
    for it) or a vendor/API failure."""


@dataclass(frozen=True)
class RiskFreeRate:
    """One point-in-time government-bond-yield observation, as
    app/models/market.py's RiskFreeRateObservation persists it.

    `rate` is a PERCENTAGE, e.g. Decimal("4.25") for 4.25% — matching how
    FRED itself publishes these series. app/services/valuation/discount_rate.py
    is the one place this gets divided by 100 into a fraction before use in
    CAPM; every other value in app/domain/valuation_assumptions/ (ERP,
    terminal growth) is already stored as a fraction (e.g. 0.045) precisely
    so the two never get mixed up unconverted.
    """

    currency: str
    rate: Decimal
    observed_at: datetime
    provider: str
    source_series_id: str


class RiskFreeRateProvider(ABC):
    """A vendor-agnostic live risk-free-rate provider, one rate per
    currency (the long end of that currency's own government bond curve —
    10-year, matching standard cost-of-equity practice)."""

    name: str

    @abstractmethod
    def get_risk_free_rate(self, currency: str) -> RiskFreeRate:
        raise NotImplementedError


# --- Primary-source filings providers (2026-09-22 — SEC EDGAR + Oslo Børs
# Newsweb, claude/free-market-data-research-providers-2026-09-21.md) ---
#
# FundamentalsProvider: structured, filer-reported financial facts (today:
# SEC EDGAR XBRL company facts). Hands back the *raw* reported values plus
# their filing provenance — never a derived ratio (CLAUDE.md Rule 1; the
# arithmetic stays in app/services/calculations.py).
#
# Regulatory announcements (Newsweb) reuse ResearchItem/ResearchUnavailableError
# above: an announcement is a citable, source-attributed item exactly like a
# grounded research finding, so it persists through the same
# research_runs/research_items tables (no new migration).


class FundamentalsUnavailableError(Exception):
    """Raised when a FundamentalsProvider cannot produce a usable result —
    unknown ticker/company, network failure, missing config, or a response
    with no usable annual facts."""


@dataclass(frozen=True)
class ReportedFact:
    """One filer-reported annual value for one canonical metric
    (app/domain/financial_metrics.py's CANONICAL_METRICS)."""

    metric: str
    value: Decimal
    unit: str
    currency: str | None
    period: str  # "FY2025" — the same free-text convention uploaded filings use
    period_end: str  # ISO date the value is reported for
    concept: str  # e.g. "us-gaap:Revenues" — which XBRL tag it came from
    form: str  # e.g. "10-K", "20-F"
    accession_number: str
    filed: str  # ISO date


@dataclass(frozen=True)
class CompanyFundamentals:
    source_name: str  # e.g. "SEC EDGAR"
    source_url: str  # human-readable filing index for the company
    company_id: str  # e.g. zero-padded CIK
    entity_name: str
    facts: list[ReportedFact]
    raw_payload: bytes  # stored verbatim as the Document for audit/traceability
    retrieved_at: datetime
    # The filer's current share count from the latest cover page (SEC
    # dei:EntityCommonStockSharesOutstanding), when reported.
    cover_shares: ReportedFact | None = None


class FundamentalsProvider(ABC):
    name: str

    @abstractmethod
    def resolve_company(self, ticker: str) -> tuple[str, str] | None:
        """(company_id, entity_name) for a ticker, or None if unknown."""
        raise NotImplementedError

    @abstractmethod
    def get_annual_fundamentals(self, company_id: str) -> CompanyFundamentals:
        raise NotImplementedError
