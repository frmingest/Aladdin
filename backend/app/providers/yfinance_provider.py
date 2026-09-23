"""yfinance-backed MarketDataProvider (Sprint 3 — valuation engine).

yfinance wraps Yahoo Finance's public (unofficial, unauthenticated) chart
API — no API key, but also no SLA: Yahoo has changed response shapes
without notice often enough that yfinance's own `fast_info` has broken
across releases (see e.g. ranaroussi/yfinance issues #1636, #1951). Every
lookup here therefore tries `fast_info` first, then falls back to the
`.info` dict, then to the most recent row of `.history()` before giving
up — three independent paths to the same number rather than betting the
whole feature on one attribute staying stable. Every vendor call is
wrapped and re-raised as MarketDataUnavailableError (CLAUDE.md: fail
visibly, never silently invent a price) so
app/services/market_data/common.py can persist a real failure and fall
back to a still-cached observation, exactly like
app/providers/gemini_research_provider.py does for research.

FX pairs use yfinance's own ticker convention: "{from}{to}=X" (e.g.
"USDNOK=X" for how many NOK one USD buys) — a real, documented Yahoo
Finance symbol format, not invented here.
"""
from __future__ import annotations

import threading
import time
from datetime import datetime, timezone
from decimal import Decimal, InvalidOperation

from app.providers.base import (
    FxRate,
    MarketDataProvider,
    MarketDataUnavailableError,
    PricePoint,
)

_PROVIDER_NAME = "yfinance"

# Beta moves slowly and, unlike price/FX/risk-free rate, has no DB-backed
# staleness cache (app/services/market_data/) — so every valuation used to
# re-fetch it live. That's fine for one holding and slow for the
# margin-of-safety board (F3), which values every holding at once. The
# provider is an lru_cache'd singleton (app/providers/factory.py), so an
# in-process cache here is shared across requests.
BETA_CACHE_TTL_SECONDS = 24 * 3600


def _to_decimal(value: object) -> Decimal | None:
    if value is None:
        return None
    try:
        return Decimal(str(value))
    except (InvalidOperation, ValueError):
        return None


def _get(obj: object, key: str) -> object:
    """`fast_info` is dict-like on some yfinance versions and attribute-like
    on others (see module docstring) — try both rather than assuming."""
    if obj is None:
        return None
    if hasattr(obj, "get"):
        try:
            return obj.get(key)
        except Exception:  # noqa: BLE001, S110 - fast_info can be dict-like or attribute-like
            # depending on yfinance version (see module docstring); either access style
            # failing just means "try the next fallback", never a real error to surface.
            pass
    try:
        return getattr(obj, key, None)
    except Exception:  # noqa: BLE001 - fast_info's lazy properties fetch on access
        # and raise KeyError (not AttributeError) when Yahoo is unreachable or
        # returns no data, which getattr's default does not catch. Found
        # 2026-09-23: this surfaced as a 500 on GET /watchlist instead of
        # "price unavailable".
        return None


class YFinanceMarketDataProvider(MarketDataProvider):
    name = _PROVIDER_NAME

    def __init__(self) -> None:
        try:
            import yfinance  # noqa: F401  (import-time dependency check)
        except ImportError as exc:  # pragma: no cover - environment issue, not logic
            raise MarketDataUnavailableError(
                "yfinance is not installed — add it to backend/requirements.txt"
            ) from exc
        self._beta_cache: dict[str, tuple[float, Decimal | None]] = {}
        self._beta_lock = threading.Lock()

    def _ticker(self, symbol: str):
        import yfinance as yf

        return yf.Ticker(symbol)

    def _price_and_currency(
        self, yf_ticker, *, currency_hint: str | None = None
    ) -> tuple[Decimal | None, str | None]:
        """Three independent fallback paths, in order of cost/reliability.
        `currency_hint` only fills in a currency the vendor itself never
        reported (the history-only path) — it never overrides one the
        vendor did report."""
        try:
            fast_info = yf_ticker.fast_info
        except Exception:  # noqa: BLE001 - vendor SDK can raise anything; falls through to the next path
            fast_info = None
        price = _to_decimal(_get(fast_info, "last_price") or _get(fast_info, "lastPrice"))
        currency = _get(fast_info, "currency")
        if price is not None and currency:
            return price, str(currency).upper()

        try:
            info = yf_ticker.info
        except Exception:  # noqa: BLE001 - vendor SDK can raise anything; falls through to the next path
            info = None
        if info:
            price = _to_decimal(info.get("currentPrice") or info.get("regularMarketPrice"))
            currency = info.get("currency")
            if price is not None and currency:
                return price, str(currency).upper()

        try:
            history = yf_ticker.history(period="5d", interval="1d", auto_adjust=True)
        except Exception:  # noqa: BLE001 - vendor SDK can raise anything; falls through to failure
            history = None
        if history is not None and not history.empty:
            last_row = history.iloc[-1]
            price = _to_decimal(last_row.get("Close"))
            resolved_currency = currency or currency_hint
            if price is not None and resolved_currency:
                return price, str(resolved_currency).upper()

        return None, None

    def get_current_price(self, ticker: str, *, currency_hint: str | None = None) -> PricePoint:
        yf_ticker = self._ticker(ticker)
        price, currency = self._price_and_currency(yf_ticker, currency_hint=currency_hint)
        if price is None or currency is None:
            raise MarketDataUnavailableError(
                f"yfinance has no current price/currency for {ticker!r} "
                "(tried fast_info, info, and history — all empty or unusable)"
            )
        return PricePoint(
            price=price, currency=currency, observed_at=datetime.now(timezone.utc), provider=self.name
        )

    def get_price_history(
        self, ticker: str, *, years: int = 5, currency_hint: str | None = None
    ) -> list[PricePoint]:
        yf_ticker = self._ticker(ticker)
        try:
            history = yf_ticker.history(period=f"{years}y", interval="1mo", auto_adjust=True)
        except Exception as exc:  # pragma: no cover
            raise MarketDataUnavailableError(f"yfinance history lookup failed for {ticker!r}: {exc}") from exc

        if history is None or history.empty:
            raise MarketDataUnavailableError(f"yfinance returned no price history for {ticker!r}")

        try:
            fast_info = yf_ticker.fast_info
        except Exception:  # noqa: BLE001 - currency is best-effort here; currency_hint covers the rest
            fast_info = None
        currency = _get(fast_info, "currency") or currency_hint
        currency = str(currency).upper() if currency else "USD"

        points: list[PricePoint] = []
        for observed_at, row in history.iterrows():
            close = _to_decimal(row.get("Close"))
            if close is None:
                continue
            ts = observed_at.to_pydatetime()
            if ts.tzinfo is None:
                ts = ts.replace(tzinfo=timezone.utc)
            points.append(PricePoint(price=close, currency=currency, observed_at=ts, provider=self.name))

        if not points:
            raise MarketDataUnavailableError(f"yfinance history for {ticker!r} had no usable close prices")
        return points

    def get_fx_rate(self, from_currency: str, to_currency: str) -> FxRate:
        from_currency = from_currency.upper()
        to_currency = to_currency.upper()
        now = datetime.now(timezone.utc)
        if from_currency == to_currency:
            return FxRate(
                from_currency=from_currency, to_currency=to_currency, rate=Decimal(1),
                observed_at=now, provider=self.name,
            )

        symbol = f"{from_currency}{to_currency}=X"
        yf_ticker = self._ticker(symbol)
        rate, _currency = self._price_and_currency(yf_ticker)
        if rate is None:
            raise MarketDataUnavailableError(f"yfinance has no FX rate for {symbol!r}")

        return FxRate(
            from_currency=from_currency, to_currency=to_currency, rate=rate,
            observed_at=now, provider=self.name,
        )

    def get_beta(self, ticker: str) -> Decimal | None:
        key = ticker.upper()
        now = time.monotonic()
        with self._beta_lock:
            cached = self._beta_cache.get(key)
        if cached is not None and now - cached[0] < BETA_CACHE_TTL_SECONDS:
            return cached[1]

        yf_ticker = self._ticker(ticker)
        try:
            info = yf_ticker.info
            beta = info.get("beta") if info else None
        except Exception:  # noqa: BLE001 - beta is best-effort, never fatal to the caller
            return None  # a failed lookup is not cached, so the next call retries
        value = _to_decimal(beta)
        with self._beta_lock:
            self._beta_cache[key] = (now, value)
        return value
