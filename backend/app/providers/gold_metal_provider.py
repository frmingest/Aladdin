"""
gold-api.com-backed MarketDataProvider for physical precious metals (§26
Phase 8, ADR 0011) — the "MetalPriceProvider" that ADR designs, routing
XAU/XAG spot pricing in behind the existing MarketDataProvider abstraction
the same way app.providers.composite_macro_provider already routes macro
series between FRED and Norges Bank.

Why gold-api.com: free, no API key, no documented rate limit, CORS-enabled,
returns live XAU/XAG spot in USD (surveyed against metals-api.com — no free
tier at all, $19.99/mo minimum — and goldapi.io, whose free-tier terms
weren't confirmable from its own docs; see ADR 0011). yfinance itself already
carries gold/silver futures tickers (GC=F/SI=F) and would have been a
zero-new-code fallback, but futures pricing carries roll/contango quirks a
dedicated spot API avoids.

Like every other external provider in this codebase (yfinance, FRED, Norges
Bank — see ADRs 0004/0007), this was researched via web search from a
sandboxed build environment with no outbound path to verify the live API:
this cloud sandbox's egress proxy returns a 403 for api.gold-api.com (the
same kind of deliberate network policy block ADR 0014 hit for
data.norges-bank.no, not a flaky connection). The response parsing below
follows gold-api.com's documented shape
(`{"name", "price", "symbol", "updatedAt"}`); it degrades to
MarketDataUnavailableError rather than guessing if a live response ever
doesn't match that shape, so a schema drift fails visibly (§21) instead of
silently mispricing a holding. **Needs a live smoke test from an
unrestricted network before this is trusted in production** — see
docs/PROGRESS.md.
"""

from datetime import datetime, timezone
from decimal import Decimal, InvalidOperation
from typing import Any

import requests

from app.providers.base import (
    DividendObservation,
    FxRate,
    MarketDataProvider,
    MarketDataUnavailableError,
    MarketMetadata,
    PriceObservation,
)

PROVIDER_NAME = "gold_api"
DEFAULT_BASE_URL = "https://api.gold-api.com/price"
_REQUEST_TIMEOUT_SECONDS = 10

# gold-api.com quotes spot in USD only — FX conversion to the reporting
# currency reuses the primary market-data provider's get_fx_rate via
# app.providers.composite_market_provider, unchanged from how every other
# holding converts (Phase 2).
_QUOTE_CURRENCY = "USD"

# The only two symbols gold-api.com's free spot endpoint serves that this
# app has any use for (ADR 0011 scopes Phase 8 to gold/silver coins).
SUPPORTED_TICKERS = frozenset({"XAU", "XAG"})


def _to_decimal(value: Any) -> Decimal | None:
    if value is None:
        return None
    try:
        return Decimal(str(value))
    except InvalidOperation:
        return None


def _parse_updated_at(raw: Any) -> datetime:
    if raw:
        try:
            # gold-api.com documents an ISO-8601 timestamp; tolerate a
            # trailing "Z" that Python's fromisoformat only accepts from 3.11+.
            return datetime.fromisoformat(str(raw).replace("Z", "+00:00"))
        except ValueError:
            pass
    # A missing/unparseable timestamp still lets the price through (it's
    # real data, just without a vendor-reported observation time) — falls
    # back to "now" rather than failing the whole lookup over metadata.
    return datetime.now(timezone.utc)


class GoldApiMarketDataProvider(MarketDataProvider):
    """Spot-only: no historical series, no FX, no dividends — a coin/bar
    pays none and has no other issuer to pay them. Callers needing FX
    conversion or a fuller MarketDataProvider surface should route through
    app.providers.composite_market_provider, which pairs this with the
    primary provider (yfinance) for everything this class doesn't cover."""

    def __init__(self, base_url: str = DEFAULT_BASE_URL, timeout: float = _REQUEST_TIMEOUT_SECONDS):
        self._base_url = base_url
        self._timeout = timeout

    def get_latest_price(self, ticker: str) -> PriceObservation:
        symbol = ticker.strip().upper()
        if symbol not in SUPPORTED_TICKERS:
            raise MarketDataUnavailableError(
                ticker, f"gold_api only serves {sorted(SUPPORTED_TICKERS)}, not '{ticker}'"
            )

        try:
            response = requests.get(f"{self._base_url}/{symbol}", timeout=self._timeout)
            response.raise_for_status()
            payload = response.json()
        except requests.RequestException as exc:
            raise MarketDataUnavailableError(ticker, f"gold-api.com request failed: {exc}") from exc
        except ValueError as exc:  # response.json() failed to parse
            raise MarketDataUnavailableError(ticker, f"gold-api.com returned a non-JSON response: {exc}") from exc

        price = _to_decimal(payload.get("price"))
        if price is None:
            raise MarketDataUnavailableError(
                ticker, f"gold-api.com response had no usable 'price' field: {payload!r}"
            )

        return PriceObservation(
            ticker=symbol,
            price=price,
            currency=_QUOTE_CURRENCY,
            observed_at=_parse_updated_at(payload.get("updatedAt")),
            provider=PROVIDER_NAME,
            # Never "current" (§8.3) — no documented real-time SLA, same
            # honesty convention app.providers.yfinance_provider follows.
            status="delayed",
        )

    def get_historical_prices(self, ticker: str, start: datetime, end: datetime) -> list[PriceObservation]:
        raise MarketDataUnavailableError(
            ticker, "gold-api.com's free tier is spot-only — no historical series available"
        )

    def get_fx_rate(self, from_currency: str, to_currency: str) -> FxRate:
        raise MarketDataUnavailableError(
            f"{from_currency}{to_currency}",
            "GoldApiMarketDataProvider does not provide FX rates — route through the primary "
            "market data provider (see app.providers.composite_market_provider)",
        )

    def get_dividends(self, ticker: str) -> list[DividendObservation]:
        return []

    def get_market_metadata(self, ticker: str) -> MarketMetadata:
        symbol = ticker.strip().upper()
        if symbol not in SUPPORTED_TICKERS:
            raise MarketDataUnavailableError(
                ticker, f"gold_api only serves {sorted(SUPPORTED_TICKERS)}, not '{ticker}'"
            )
        return MarketMetadata(
            ticker=symbol,
            currency=_QUOTE_CURRENCY,
            exchange="spot",
            shares_outstanding=None,
            provider=PROVIDER_NAME,
        )
