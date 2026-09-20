"""
Provider interfaces (architecture §3).

Business logic depends on these abstractions, never on a specific vendor.
Concrete implementations (e.g. a specific market-data API, a specific
object-storage vendor) live alongside these but are swapped via
app/config/settings.py, not by editing service code.
"""

from abc import ABC, abstractmethod
from dataclasses import dataclass
from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel


@dataclass(frozen=True)
class PriceObservation:
    ticker: str
    price: Decimal
    currency: str
    observed_at: datetime
    provider: str
    status: str  # current | delayed | stale | unavailable


@dataclass(frozen=True)
class FxRate:
    from_currency: str
    to_currency: str
    rate: Decimal
    observed_at: datetime
    provider: str


@dataclass(frozen=True)
class DividendObservation:
    ticker: str
    ex_date: datetime
    amount: Decimal
    currency: str


@dataclass(frozen=True)
class MarketMetadata:
    ticker: str
    currency: str
    exchange: str | None
    shares_outstanding: Decimal | None
    provider: str


class MarketDataUnavailableError(Exception):
    """Raised by a MarketDataProvider when no observation could be obtained
    for the given ticker/symbol.

    This is a normal, expected outcome (a delisted ticker, an unsupported
    FX pair, a transient provider issue) — not a bug. Callers must treat it
    as an explicit "unavailable" data-quality state (§8.3) and surface that
    to the user, never substitute a stale value or silently drop the holding
    from a total without saying so (§21: fail visibly rather than silently
    invent or omit).
    """

    def __init__(self, ticker: str, reason: str):
        self.ticker = ticker
        self.reason = reason
        super().__init__(f"market data unavailable for '{ticker}': {reason}")


class MarketDataProvider(ABC):
    """§8.1 — current/historical prices, dividends, metadata, FX.

    Implementations should raise MarketDataUnavailableError rather than
    returning a fabricated or zero value when a ticker/symbol can't be
    resolved — see that class's docstring.
    """

    @abstractmethod
    def get_latest_price(self, ticker: str) -> PriceObservation: ...

    @abstractmethod
    def get_historical_prices(self, ticker: str, start: datetime, end: datetime) -> list[PriceObservation]: ...

    @abstractmethod
    def get_fx_rate(self, from_currency: str, to_currency: str) -> FxRate: ...

    @abstractmethod
    def get_dividends(self, ticker: str) -> list[DividendObservation]: ...

    @abstractmethod
    def get_market_metadata(self, ticker: str) -> MarketMetadata: ...


@dataclass(frozen=True)
class MacroSeriesPoint:
    """One observation of a deterministic, numeric central-bank/macro series
    (§9.1: policy rates, inflation, real yields, breakevens, dollar index).

    `series_key` is the canonical key from the registry
    (app.domain.macro_series), not a vendor-specific series id — callers
    never see "DFII10" or a Norges Bank dataset/key, only "us_real_yield_10y"
    (§28 rule 8: provider details stay behind the provider)."""

    series_key: str
    value: Decimal
    unit: str
    observed_at: datetime
    """The period/date the observation covers, per the vendor (e.g. FRED's
    `date`) — not when this application retrieved it. See MacroObservation
    (app.models.research) for the separate `retrieved_at` provenance field."""
    provider: str
    region: str


class MacroDataUnavailableError(Exception):
    """Raised by a MacroDataProvider when a series can't be resolved —
    unknown series_key, vendor error, or no observation in range. Mirrors
    MarketDataUnavailableError's role and rationale (§21, §8.3): an expected,
    explicit failure mode the caller must surface, never paper over."""

    def __init__(self, series_key: str, reason: str):
        self.series_key = series_key
        self.reason = reason
        super().__init__(f"macro data unavailable for '{series_key}': {reason}")


class MacroDataProvider(ABC):
    """§9.1 — deterministic, numeric central-bank/macro data (policy rates,
    inflation, real yields, breakevens, dollar index). Deliberately separate
    from ResearchProvider below: this interface returns application-defined
    facts an application can do arithmetic on (§2.2), never LLM-mediated
    narrative — the qualitative "what does this mean" research streams
    (§9.2/§9.3) are ResearchProvider's job."""

    @abstractmethod
    def get_latest(self, series_key: str) -> MacroSeriesPoint: ...

    @abstractmethod
    def get_series(self, series_key: str, start: datetime, end: datetime) -> list[MacroSeriesPoint]: ...


@dataclass(frozen=True)
class ResearchItem:
    source_url: str
    source_name: str
    title: str
    summary: str
    source_type: str
    published_at: datetime | None
    retrieved_at: datetime


class ResearchUnavailableError(Exception):
    """Raised by a ResearchProvider when a research call fails outright
    (vendor/network error, no groundable response at all) — not when a
    grounded call simply finds nothing new, which is a legitimate empty
    result (see app.services.research), not an error. Mirrors
    LLMUnavailableError's role (§21, §28 rule 10)."""

    def __init__(self, reason: str):
        self.reason = reason
        super().__init__(f"research provider unavailable: {reason}")


@dataclass(frozen=True)
class LLMUsageMetrics:
    """Vendor-reported token/latency accounting for one LLM call (§28 rule
    8: vendor-agnostic — every provider fills this from its own SDK's usage
    fields, e.g. Gemini's `usage_metadata`). Exact, not estimated — these
    are the same counts the vendor bills/rate-limits against, which is what
    makes app.models.llm_usage/app.services.usage a reliable ledger rather
    than a guess (see docs/decisions/0013-llm-usage-ledger-and-rate-limit-
    estimation.md)."""

    input_tokens: int | None
    output_tokens: int | None
    latency_ms: float | None


class ResearchProvider(ABC):
    """§9.2/§9.3 — qualitative macro/world-news and sector research streams,
    each item traceable to a real source (§9.4). Numeric central-bank/macro
    data (policy rates, real yields, breakevens, dollar index — §9.1) is
    MacroDataProvider's job, not this interface's — see that class's
    docstring for why the split exists.

    get_company_research (Phase 11/Buffett-Munger redesign Sprint 2, see
    claude/buffett-munger-redesign-sprint-plan-2026-09-20.md) adds a third,
    per-holding stream for the Brain's opening step: company-specific
    industry/geography/competitive-environment risk (the Iran/energy
    example) that neither portfolio-wide macro nor generic-by-sector
    research covers. It takes plain strings, not a Holding ORM object, for
    the same reason get_sector_research takes `sector: str` rather than a
    Holding — this interface stays vendor-agnostic and decoupled from the
    application's persistence layer (§28 rule 8); the caller
    (app.services.research.company) is responsible for reading whatever it
    needs off the Holding row first."""

    # Set by a concrete provider after each get_macro_snapshot/
    # get_sector_research/get_company_research call, so app.services.research
    # can persist a usage-ledger row (app.models.llm_usage) without widening
    # this interface's return type (§28 rule 8 — the interface itself stays
    # vendor-agnostic; only a concrete provider knows what its vendor's SDK
    # reports). None for StubResearchProvider and for any call that raised
    # before a vendor response came back.
    last_usage: "LLMUsageMetrics | None" = None

    @abstractmethod
    def get_macro_snapshot(self) -> list[ResearchItem]:
        """Macro/geopolitical narrative and news (§9.2) — not the numeric
        series covered by MacroDataProvider."""
        ...

    @abstractmethod
    def get_sector_research(self, sector: str) -> list[ResearchItem]: ...

    @abstractmethod
    def get_company_research(self, company_name: str, ticker: str, sector: str | None) -> list[ResearchItem]:
        """Company-specific research (§9's per-holding extension, Sprint 2)
        — industry/geography/competitive-environment risk scoped to one
        holding, not the portfolio or its sector generically. `sector` may
        be None (a holding with no sector assigned still gets company-level
        research)."""
        ...


@dataclass(frozen=True)
class LLMResponse:
    content: str
    """Raw response text — a JSON string matching whatever `response_schema`
    was requested. Parsing/validation into the app's own pydantic models
    happens in the calling service (app.services.analysis.llm_analysis), not
    here, so this interface stays vendor-agnostic (§28 rule 8)."""
    model: str
    input_tokens: int | None
    output_tokens: int | None
    latency_ms: float | None


class LLMUnavailableError(Exception):
    """Raised by an LLMProvider when a generation call fails outright, or
    returns content that isn't usable (empty, blocked, not valid JSON for
    the requested schema). Mirrors MarketDataUnavailableError's role: this is
    an explicit, expected failure mode the caller must surface, not silently
    paper over with a plausible-looking fallback (§28 rule 10)."""

    def __init__(self, reason: str):
        self.reason = reason
        super().__init__(f"LLM generation unavailable: {reason}")


class LLMProvider(ABC):
    """§11 — the LLM interprets evidence; it is never the system of record.

    `response_schema` is a pydantic model class (not a raw JSON-schema dict)
    so callers get real validation for free via
    `response_schema.model_validate_json(response.content)` — the provider's
    job is only to ask its vendor's API to constrain generation to that
    shape, however that vendor's SDK expects the schema expressed.
    """

    @abstractmethod
    def generate_structured(
        self,
        *,
        system_prompt: str,
        user_content: str,
        response_schema: type[BaseModel],
        prompt_version: str,
    ) -> LLMResponse: ...


class ObjectStorageProvider(ABC):
    """§2.8 — original source documents live in storage the application controls."""

    @abstractmethod
    def store(self, key: str, content: bytes) -> str:
        """Returns the storage path/URI."""
        ...

    @abstractmethod
    def retrieve(self, key: str) -> bytes: ...
