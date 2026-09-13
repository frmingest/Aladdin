"""
yfinance-backed MarketDataProvider — the §29 open question resolved for
Phase 2 (architecture §26).

Why yfinance: it is free, needs no API key/account, and covers Oslo Børs
(.OL) tickers, which matter here since the portfolio holds Norwegian names.
It is an unofficial wrapper around Yahoo Finance's undocumented endpoints —
no SLA, no authentication, and it can break or change shape without notice.
That is an accepted tradeoff of "free/low-cost first" (§2.9), not a claim of
production-grade reliability. See
docs/decisions/0004-phase2-market-data-and-financial-metrics.md for the
full tradeoff discussion and the swap-out path — application/service code
depends only on the MarketDataProvider interface (§3), never on yfinance
directly, so replacing it later is a one-file change plus a settings flip.

Every observation this provider returns is marked "delayed", never
"current": Yahoo's quote data carries no documented real-time guarantee, and
§8.3 requires the application to distinguish real-time from delayed data
rather than overstate freshness we can't verify.
"""

from datetime import datetime, timezone
from decimal import Decimal, InvalidOperation
from typing import Any

import yfinance as yf

from app.providers.base import (
    DividendObservation,
    FxRate,
    MarketDataProvider,
    MarketDataUnavailableError,
    MarketMetadata,
    PriceObservation,
)

PROVIDER_NAME = "yfinance"

# Yahoo Finance's convention for FX cross tickers (§8.1 get_fx_rate).
_FX_TICKER_SUFFIX = "=X"


def _to_decimal(value: Any) -> Decimal | None:
    if value is None:
        return None
    try:
        if isinstance(value, float) and (value != value):  # NaN
            return None
        return Decimal(str(value))
    except (InvalidOperation, ValueError):
        return None


def _ensure_utc(dt: datetime) -> datetime:
    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc)


def _fx_ticker(from_currency: str, to_currency: str) -> str:
    return f"{from_currency.upper()}{to_currency.upper()}{_FX_TICKER_SUFFIX}"


class YFinanceMarketDataProvider(MarketDataProvider):
    def get_latest_price(self, ticker: str) -> PriceObservation:
        return self._latest_close(ticker, resolve_currency=True)

    def get_historical_prices(
        self, ticker: str, start: datetime, end: datetime
    ) -> list[PriceObservation]:
        history = yf.Ticker(ticker).history(start=start, end=end, auto_adjust=False)
        if history is None or history.empty:
            raise MarketDataUnavailableError(ticker, "no historical price data returned")

        currency = self._safe_currency_of(ticker)
        observations: list[PriceObservation] = []
        for observed_at, row in history.iterrows():
            price = _to_decimal(row.get("Close"))
            if price is None:
                continue
            observations.append(
                PriceObservation(
                    ticker=ticker,
                    price=price,
                    currency=currency,
                    observed_at=_ensure_utc(observed_at.to_pydatetime()),
                    provider=PROVIDER_NAME,
                    status="delayed",
                )
            )
        if not observations:
            raise MarketDataUnavailableError(ticker, "historical data had no usable close prices")
        return observations

    def get_fx_rate(self, from_currency: str, to_currency: str) -> FxRate:
        from_currency = from_currency.upper()
        to_currency = to_currency.upper()

        # Short-circuit rather than round-tripping to Yahoo for a trivial
        # same-currency "conversion" — also avoids depending on a
        # same-currency FX ticker existing at all (it doesn't).
        if from_currency == to_currency:
            return FxRate(
                from_currency=from_currency,
                to_currency=to_currency,
                rate=Decimal("1"),
                observed_at=datetime.now(timezone.utc),
                provider=PROVIDER_NAME,
            )

        symbol = _fx_ticker(from_currency, to_currency)
        try:
            observation = self._latest_close(symbol, resolve_currency=False, currency_override=to_currency)
        except MarketDataUnavailableError as exc:
            raise MarketDataUnavailableError(
                symbol, f"FX pair {from_currency}/{to_currency} unavailable: {exc.reason}"
            ) from exc
        return FxRate(
            from_currency=from_currency,
            to_currency=to_currency,
            rate=observation.price,
            observed_at=observation.observed_at,
            provider=PROVIDER_NAME,
        )

    def get_dividends(self, ticker: str) -> list[DividendObservation]:
        series = yf.Ticker(ticker).dividends
        if series is None or series.empty:
            return []
        currency = self._safe_currency_of(ticker)
        out: list[DividendObservation] = []
        for ex_date, amount in series.items():
            value = _to_decimal(amount)
            if value is None:
                continue
            out.append(
                DividendObservation(
                    ticker=ticker,
                    ex_date=_ensure_utc(ex_date.to_pydatetime()),
                    amount=value,
                    currency=currency,
                )
            )
        return out

    def get_market_metadata(self, ticker: str) -> MarketMetadata:
        info = yf.Ticker(ticker).fast_info
        try:
            currency = info["currency"]
        except Exception as exc:  # noqa: BLE001 — yfinance raises assorted internal errors
            raise MarketDataUnavailableError(ticker, f"could not read market metadata: {exc}") from exc
        if not currency:
            raise MarketDataUnavailableError(ticker, "provider returned no currency for this ticker")

        exchange = _safe_get(info, "exchange")
        shares = _to_decimal(_safe_get(info, "shares"))
        return MarketMetadata(
            ticker=ticker,
            currency=currency,
            exchange=exchange,
            shares_outstanding=shares,
            provider=PROVIDER_NAME,
        )

    # --- internal helpers ---

    def _safe_currency_of(self, ticker: str) -> str:
        """Best-effort currency lookup for annotating an observation that
        already succeeded (e.g. dividends) — never blocks on this failing."""
        try:
            return self.get_market_metadata(ticker).currency
        except MarketDataUnavailableError:
            return "UNKNOWN"

    def _latest_close(
        self,
        ticker: str,
        *,
        resolve_currency: bool,
        currency_override: str | None = None,
    ) -> PriceObservation:
        history = yf.Ticker(ticker).history(period="5d", auto_adjust=False)
        if history is None or history.empty or "Close" not in history:
            raise MarketDataUnavailableError(ticker, "no recent price data returned")

        closes = history.dropna(subset=["Close"])
        if closes.empty:
            raise MarketDataUnavailableError(ticker, "no usable close price in recent history")

        last_row = closes.iloc[-1]
        price = _to_decimal(last_row["Close"])
        if price is None:
            raise MarketDataUnavailableError(ticker, "close price was not numeric")

        if currency_override is not None:
            currency = currency_override
        elif resolve_currency:
            currency = self.get_market_metadata(ticker).currency
        else:
            currency = "UNKNOWN"

        return PriceObservation(
            ticker=ticker,
            price=price,
            currency=currency,
            observed_at=_ensure_utc(last_row.name.to_pydatetime()),
            provider=PROVIDER_NAME,
            status="delayed",
        )


def _safe_get(fast_info: Any, key: str) -> Any:
    try:
        return fast_info.get(key)
    except Exception:  # noqa: BLE001
        return None
