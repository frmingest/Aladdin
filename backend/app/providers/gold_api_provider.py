"""gold-api.com-backed metal spot-price provider (2026-09-26).

Free, keyless, no documented rate limit for the current-price endpoint
(https://gold-api.com/, confirmed via its own /llms.txt on 2026-09-26):

    GET https://api.gold-api.com/price/{symbol}   (symbol: XAU or XAG)
    -> {"currency": "USD", "price": 4165.20, "symbol": "XAU", "updatedAt": "..."}

Its historical-data endpoint (`/history`) needs an `x-api-key` — not free
— so this provider does NOT use it. Instead it implements
`get_daily_price_history()` to return just *today's* spot price as a
single-point list; app/services/risk/price_history.py's
`get_or_refresh_daily_history()` (Sprint 12, reused as-is for metals —
see app/services/precious_metals/pricing.py) merges a fetch into
whatever's already cached rather than overwriting it, so calling this once
a day organically builds up real history in
app/models/risk.py's PriceHistoryObservation over time. There is no
backfill: a chart built from this only has data from the day metals
tracking was turned on onward (fail-visibly, CLAUDE.md — never invent past
prices this app didn't itself observe).

Implements the full MarketDataProvider ABC (app/providers/base.py) so it
can be passed to `get_or_refresh_daily_history()` unchanged; the methods
metals genuinely don't need (`get_price_history`, `get_fx_rate`,
`get_beta`) just raise — nothing calls them for a metal "ticker".
"""
from __future__ import annotations

from datetime import datetime, timezone
from decimal import Decimal, InvalidOperation

import httpx

from app.providers.base import (
    FxRate,
    MarketDataProvider,
    MarketDataUnavailableError,
    PricePoint,
)

_PROVIDER_NAME = "gold_api"
_BASE_URL = "https://api.gold-api.com"

# This app's own ticker -> gold-api.com symbol mapping (app/domain/
# precious_metals.py's SPOT_TICKER is the reverse of this).
_SYMBOL_BY_TICKER = {"XAUUSD": "XAU", "XAGUSD": "XAG"}


class GoldApiProvider(MarketDataProvider):
    name = _PROVIDER_NAME

    def __init__(self, *, timeout_seconds: float = 10.0) -> None:
        self._timeout_seconds = timeout_seconds

    def _symbol(self, ticker: str) -> str:
        symbol = _SYMBOL_BY_TICKER.get(ticker.upper())
        if symbol is None:
            raise MarketDataUnavailableError(
                f"{self.name} only serves {sorted(_SYMBOL_BY_TICKER)}, not {ticker!r}"
            )
        return symbol

    def get_current_price(self, ticker: str, *, currency_hint: str | None = None) -> PricePoint:
        symbol = self._symbol(ticker)
        try:
            response = httpx.get(f"{_BASE_URL}/price/{symbol}", timeout=self._timeout_seconds)
            response.raise_for_status()
            payload = response.json()
        except httpx.HTTPError as exc:
            raise MarketDataUnavailableError(f"{self.name} request failed for {symbol}: {exc}") from exc

        try:
            price = Decimal(str(payload["price"]))
        except (KeyError, InvalidOperation, ValueError) as exc:
            raise MarketDataUnavailableError(
                f"{self.name} returned an unusable price payload for {symbol}: {payload!r}"
            ) from exc

        currency = str(payload.get("currency") or "USD").upper()
        observed_at = _parse_timestamp(payload.get("updatedAt"))
        return PricePoint(price=price, currency=currency, observed_at=observed_at, provider=self.name)

    def get_daily_price_history(
        self, ticker: str, *, days: int = 400, currency_hint: str | None = None
    ) -> list[PricePoint]:
        """Only today's spot price — see this module's docstring for why.
        `days` is accepted (interface compatibility) but ignored."""
        return [self.get_current_price(ticker, currency_hint=currency_hint)]

    def get_price_history(
        self, ticker: str, *, years: int = 5, currency_hint: str | None = None
    ) -> list[PricePoint]:
        raise MarketDataUnavailableError(f"{self.name} does not provide monthly price history")

    def get_fx_rate(self, from_currency: str, to_currency: str) -> FxRate:
        raise MarketDataUnavailableError(f"{self.name} does not provide FX rates")

    def get_beta(self, ticker: str) -> Decimal | None:
        raise MarketDataUnavailableError(f"{self.name} does not provide beta")


def _parse_timestamp(raw: object) -> datetime:
    if isinstance(raw, str):
        try:
            return datetime.fromisoformat(raw.replace("Z", "+00:00"))
        except ValueError:
            pass
    return datetime.now(timezone.utc)
