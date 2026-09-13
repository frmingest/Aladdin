"""
Unit tests for YFinanceMarketDataProvider.

These monkeypatch yfinance.Ticker with fakes shaped like the real library's
1.7.0 API (history() returning a DataFrame with a DatetimeIndex and a
"Close" column; fast_info as a dict-like with "currency"/"exchange"/"shares";
dividends as a pandas Series indexed by ex-date) — no real network call.
Yahoo Finance isn't reachable from this environment's sandboxed egress
anyway, so this is the only way to verify the mapping logic; a live-network
smoke test is a manual follow-up outside CI (see the Phase 2 ADR).
"""

from datetime import datetime, timezone
from decimal import Decimal

import pandas as pd
import pytest

import app.providers.yfinance_provider as yfp
from app.providers.base import MarketDataUnavailableError


class _FakeFastInfo(dict):
    """yfinance's real FastInfo is dict-like (supports __getitem__/.get)."""


class _FakeTicker:
    def __init__(self, history_df=None, fast_info=None, dividends=None):
        self._history_df = history_df if history_df is not None else pd.DataFrame()
        self.fast_info = fast_info if fast_info is not None else _FakeFastInfo()
        self.dividends = dividends if dividends is not None else pd.Series(dtype=float)

    def history(self, *args, **kwargs):
        return self._history_df


def _history_df(rows: list[tuple[str, float]]) -> pd.DataFrame:
    index = pd.DatetimeIndex([pd.Timestamp(d, tz="UTC") for d, _ in rows])
    return pd.DataFrame({"Close": [v for _, v in rows]}, index=index)


@pytest.fixture()
def provider():
    return yfp.YFinanceMarketDataProvider()


def test_get_latest_price_uses_last_close_and_marks_delayed(monkeypatch, provider):
    fake = _FakeTicker(
        history_df=_history_df([("2026-09-10", 100.0), ("2026-09-11", 102.5)]),
        fast_info=_FakeFastInfo(currency="NOK", exchange="OSL"),
    )
    monkeypatch.setattr(yfp.yf, "Ticker", lambda symbol: fake)

    obs = provider.get_latest_price("VAR.OL")

    assert obs.ticker == "VAR.OL"
    assert obs.price == Decimal("102.5")
    assert obs.currency == "NOK"
    assert obs.status == "delayed"
    assert obs.provider == "yfinance"
    assert obs.observed_at.tzinfo is not None


def test_get_latest_price_raises_when_history_empty(monkeypatch, provider):
    fake = _FakeTicker(history_df=pd.DataFrame())
    monkeypatch.setattr(yfp.yf, "Ticker", lambda symbol: fake)

    with pytest.raises(MarketDataUnavailableError):
        provider.get_latest_price("NONEXISTENT.OL")


def test_get_historical_prices_maps_all_rows(monkeypatch, provider):
    fake = _FakeTicker(
        history_df=_history_df([("2026-09-01", 90.0), ("2026-09-02", 91.0), ("2026-09-03", 89.5)]),
        fast_info=_FakeFastInfo(currency="NOK"),
    )
    monkeypatch.setattr(yfp.yf, "Ticker", lambda symbol: fake)

    observations = provider.get_historical_prices(
        "VAR.OL", datetime(2026, 9, 1, tzinfo=timezone.utc), datetime(2026, 9, 3, tzinfo=timezone.utc)
    )

    assert [o.price for o in observations] == [Decimal("90.0"), Decimal("91.0"), Decimal("89.5")]
    assert all(o.currency == "NOK" and o.status == "delayed" for o in observations)


def test_get_fx_rate_same_currency_short_circuits_without_network(monkeypatch, provider):
    def _boom(symbol):
        raise AssertionError("should not hit the provider for a same-currency 'conversion'")

    monkeypatch.setattr(yfp.yf, "Ticker", _boom)

    rate = provider.get_fx_rate("nok", "NOK")

    assert rate.from_currency == "NOK"
    assert rate.to_currency == "NOK"
    assert rate.rate == Decimal("1")


def test_get_fx_rate_uses_yahoo_cross_ticker_convention(monkeypatch, provider):
    seen_symbols = []

    def _ticker(symbol):
        seen_symbols.append(symbol)
        return _FakeTicker(history_df=_history_df([("2026-09-11", 10.85)]))

    monkeypatch.setattr(yfp.yf, "Ticker", _ticker)

    rate = provider.get_fx_rate("usd", "nok")

    assert seen_symbols == ["USDNOK=X"]
    assert rate.from_currency == "USD"
    assert rate.to_currency == "NOK"
    assert rate.rate == Decimal("10.85")


def test_get_fx_rate_unavailable_wraps_reason(monkeypatch, provider):
    monkeypatch.setattr(yfp.yf, "Ticker", lambda symbol: _FakeTicker(history_df=pd.DataFrame()))

    with pytest.raises(MarketDataUnavailableError):
        provider.get_fx_rate("USD", "XYZ")


def test_get_dividends_maps_series(monkeypatch, provider):
    dividends = pd.Series(
        [1.5, 1.75],
        index=pd.DatetimeIndex([pd.Timestamp("2025-06-01", tz="UTC"), pd.Timestamp("2025-12-01", tz="UTC")]),
    )
    fake = _FakeTicker(dividends=dividends, fast_info=_FakeFastInfo(currency="NOK"))
    monkeypatch.setattr(yfp.yf, "Ticker", lambda symbol: fake)

    out = provider.get_dividends("VAR.OL")

    assert [d.amount for d in out] == [Decimal("1.5"), Decimal("1.75")]
    assert all(d.currency == "NOK" for d in out)


def test_get_dividends_empty_series_returns_empty_list(monkeypatch, provider):
    fake = _FakeTicker(dividends=pd.Series(dtype=float))
    monkeypatch.setattr(yfp.yf, "Ticker", lambda symbol: fake)

    assert provider.get_dividends("VAR.OL") == []


def test_get_market_metadata_maps_fast_info(monkeypatch, provider):
    fake = _FakeTicker(fast_info=_FakeFastInfo(currency="NOK", exchange="OSL", shares=1_000_000))
    monkeypatch.setattr(yfp.yf, "Ticker", lambda symbol: fake)

    meta = provider.get_market_metadata("VAR.OL")

    assert meta.currency == "NOK"
    assert meta.exchange == "OSL"
    assert meta.shares_outstanding == Decimal("1000000")


def test_get_market_metadata_raises_when_currency_missing(monkeypatch, provider):
    fake = _FakeTicker(fast_info=_FakeFastInfo())
    monkeypatch.setattr(yfp.yf, "Ticker", lambda symbol: fake)

    with pytest.raises(MarketDataUnavailableError):
        provider.get_market_metadata("VAR.OL")
