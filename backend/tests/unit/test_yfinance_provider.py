"""Unit tests for YFinanceMarketDataProvider, mocking yfinance.Ticker (no
real network call). Exercises the fast_info -> info -> history fallback
chain the provider docstring describes, since yfinance's own attribute
shapes are known to shift across releases."""
from decimal import Decimal
from unittest.mock import MagicMock, patch

import pandas as pd
import pytest

from app.providers.base import MarketDataUnavailableError
from app.providers.yfinance_provider import YFinanceMarketDataProvider


def _provider() -> YFinanceMarketDataProvider:
    return YFinanceMarketDataProvider()


def _history_df(closes: list[float], *, tz_aware: bool = True) -> pd.DataFrame:
    index = pd.date_range("2024-01-31", periods=len(closes), freq="ME", tz="UTC" if tz_aware else None)
    return pd.DataFrame({"Close": closes}, index=index)


def test_current_price_from_fast_info():
    provider = _provider()
    mock_ticker = MagicMock()
    mock_ticker.fast_info = {"last_price": 225.5, "currency": "usd"}
    with patch.object(provider, "_ticker", return_value=mock_ticker):
        point = provider.get_current_price("AAPL")
    assert point.price == Decimal("225.5")
    assert point.currency == "USD"
    assert point.provider == "yfinance"


def test_current_price_falls_back_to_info_when_fast_info_empty():
    provider = _provider()
    mock_ticker = MagicMock()
    mock_ticker.fast_info = {}
    mock_ticker.info = {"currentPrice": 100.25, "currency": "NOK"}
    with patch.object(provider, "_ticker", return_value=mock_ticker):
        point = provider.get_current_price("EQNR.OL")
    assert point.price == Decimal("100.25")
    assert point.currency == "NOK"


def test_current_price_falls_back_to_history_when_fast_info_and_info_empty():
    provider = _provider()
    mock_ticker = MagicMock()
    mock_ticker.fast_info = {}
    mock_ticker.info = {}
    mock_ticker.history.return_value = _history_df([10.0, 11.0, 12.5])
    with patch.object(provider, "_ticker", return_value=mock_ticker):
        point = provider.get_current_price("TEL.OL", currency_hint="NOK")
    assert point.price == Decimal("12.5")
    assert point.currency == "NOK"


def test_current_price_from_history_without_currency_hint_raises():
    provider = _provider()
    mock_ticker = MagicMock()
    mock_ticker.fast_info = {}
    mock_ticker.info = {}
    mock_ticker.history.return_value = _history_df([10.0, 11.0, 12.5])
    with (
        patch.object(provider, "_ticker", return_value=mock_ticker),
        pytest.raises(MarketDataUnavailableError),
    ):
        provider.get_current_price("TEL.OL")


def test_current_price_raises_when_every_path_fails():
    provider = _provider()
    mock_ticker = MagicMock()
    mock_ticker.fast_info = {}
    mock_ticker.info = {}
    mock_ticker.history.return_value = pd.DataFrame()
    with (
        patch.object(provider, "_ticker", return_value=mock_ticker),
        pytest.raises(MarketDataUnavailableError),
    ):
        provider.get_current_price("DELISTED")


def test_price_history_returns_oldest_first_points():
    provider = _provider()
    mock_ticker = MagicMock()
    mock_ticker.history.return_value = _history_df([10.0, 11.0, 12.0])
    mock_ticker.fast_info = {"currency": "USD"}
    with patch.object(provider, "_ticker", return_value=mock_ticker):
        points = provider.get_price_history("AAPL", years=1)
    assert [p.price for p in points] == [Decimal("10.0"), Decimal("11.0"), Decimal("12.0")]
    assert all(p.currency == "USD" for p in points)
    assert all(p.observed_at.tzinfo is not None for p in points)


def test_price_history_raises_on_empty_dataframe():
    provider = _provider()
    mock_ticker = MagicMock()
    mock_ticker.history.return_value = pd.DataFrame()
    with (
        patch.object(provider, "_ticker", return_value=mock_ticker),
        pytest.raises(MarketDataUnavailableError),
    ):
        provider.get_price_history("NOTHING")


def test_fx_rate_same_currency_short_circuits_without_a_ticker_call():
    provider = _provider()
    with patch.object(provider, "_ticker") as mock_ticker_fn:
        rate = provider.get_fx_rate("NOK", "NOK")
        mock_ticker_fn.assert_not_called()
    assert rate.rate == Decimal(1)


def test_fx_rate_uses_yfinance_pair_symbol_convention():
    provider = _provider()
    mock_ticker = MagicMock()
    mock_ticker.fast_info = {"last_price": 10.55, "currency": "NOK"}
    with patch.object(provider, "_ticker", return_value=mock_ticker) as mock_ticker_fn:
        rate = provider.get_fx_rate("usd", "nok")
        mock_ticker_fn.assert_called_once_with("USDNOK=X")
    assert rate.from_currency == "USD"
    assert rate.to_currency == "NOK"
    assert rate.rate == Decimal("10.55")


def test_beta_returns_none_when_unavailable_rather_than_raising():
    provider = _provider()
    mock_ticker = MagicMock()
    mock_ticker.info = {}
    with patch.object(provider, "_ticker", return_value=mock_ticker):
        assert provider.get_beta("AAPL") is None


def test_beta_returns_decimal_when_present():
    provider = _provider()
    mock_ticker = MagicMock()
    mock_ticker.info = {"beta": 1.23}
    with patch.object(provider, "_ticker", return_value=mock_ticker):
        assert provider.get_beta("AAPL") == Decimal("1.23")


def test_beta_returns_none_when_info_raises():
    provider = _provider()
    mock_ticker = MagicMock()
    type(mock_ticker).info = property(lambda self: (_ for _ in ()).throw(RuntimeError("boom")))
    with patch.object(provider, "_ticker", return_value=mock_ticker):
        assert provider.get_beta("AAPL") is None


def test_beta_is_cached_per_ticker():
    provider = _provider()
    mock_ticker = MagicMock()
    mock_ticker.info = {"beta": 0.9}
    with patch.object(provider, "_ticker", return_value=mock_ticker) as ticker_fn:
        assert provider.get_beta("EQNR.OL") == Decimal("0.9")
        assert provider.get_beta("eqnr.ol") == Decimal("0.9")
    assert ticker_fn.call_count == 1


def test_failed_beta_lookup_is_not_cached():
    provider = _provider()
    failing = MagicMock()
    type(failing).info = property(lambda self: (_ for _ in ()).throw(RuntimeError("boom")))
    working = MagicMock()
    working.info = {"beta": 1.1}
    with patch.object(provider, "_ticker", side_effect=[failing, working]):
        assert provider.get_beta("AAPL") is None
        assert provider.get_beta("AAPL") == Decimal("1.1")
