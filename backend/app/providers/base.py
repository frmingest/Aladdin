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
class ResearchItem:
    source_url: str
    source_name: str
    title: str
    summary: str
    source_type: str
    published_at: datetime | None
    retrieved_at: datetime


class ResearchProvider(ABC):
    """§9 — macro, central-bank, and sector research streams."""

    @abstractmethod
    def get_macro_snapshot(self) -> list[ResearchItem]:
        """Real yields, breakevens, dollar index, policy rates — see §9.1."""
        ...

    @abstractmethod
    def get_sector_research(self, sector: str) -> list[ResearchItem]: ...


@dataclass(frozen=True)
class LLMResponse:
    content: str
    model: str
    input_tokens: int
    output_tokens: int


class LLMProvider(ABC):
    """§11 — the LLM interprets evidence; it is never the system of record."""

    @abstractmethod
    def analyze(self, prompt: str, prompt_version: str) -> LLMResponse: ...


class ObjectStorageProvider(ABC):
    """§2.8 — original source documents live in storage the application controls."""

    @abstractmethod
    def store(self, key: str, content: bytes) -> str:
        """Returns the storage path/URI."""
        ...

    @abstractmethod
    def retrieve(self, key: str) -> bytes: ...
