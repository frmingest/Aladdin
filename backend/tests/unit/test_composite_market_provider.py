"""
Unit tests for CompositeMarketDataProvider (§26 Phase 8, ADR 0011) — routes a
ticker to the commodity provider (XAU/XAG) or the default provider (every
other ticker), mirroring test_composite_macro_provider.py's approach: simple
fakes for both children, so this only tests routing.
"""

from datetime import datetime, timezone
from decimal import Decimal

import pytest

from app.providers.base import (
    FxRate,
    MarketDataProvider,
    MarketMetadata,
    PriceObservation,
)
from app.providers.composite_market_provider import CompositeMarketDataProvider


class _FakeProvider(MarketDataProvider):
    def __init__(self, name):
        self.name = name
        self.calls = []

    def get_latest_price(self, ticker):
        self.calls.append(("get_latest_price", ticker))
        return PriceObservation(
            ticker=ticker,
            price=Decimal("1"),
            currency="USD",
            observed_at=datetime(2026, 9, 15, tzinfo=timezone.utc),
            provider=self.name,
            status="delayed",
        )

    def get_historical_prices(self, ticker, start, end):
        self.calls.append(("get_historical_prices", ticker, start, end))
        return []

    def get_fx_rate(self, from_currency, to_currency):
        self.calls.append(("get_fx_rate", from_currency, to_currency))
        return FxRate(
            from_currency=from_currency,
            to_currency=to_currency,
            rate=Decimal("10"),
            observed_at=datetime(2026, 9, 15, tzinfo=timezone.utc),
            provider=self.name,
        )

    def get_dividends(self, ticker):
        self.calls.append(("get_dividends", ticker))
        return []

    def get_market_metadata(self, ticker):
        self.calls.append(("get_market_metadata", ticker))
        return MarketMetadata(ticker=ticker, currency="USD", exchange=None, shares_outstanding=None, provider=self.name)


@pytest.fixture()
def composite():
    default = _FakeProvider("default")
    commodity = _FakeProvider("commodity")
    return CompositeMarketDataProvider(
        default=default, commodity=commodity, commodity_tickers=frozenset({"XAU", "XAG"})
    ), default, commodity


def test_routes_commodity_ticker_to_commodity_provider(composite):
    provider, default, commodity = composite

    obs = provider.get_latest_price("XAU")

    assert obs.provider == "commodity"
    assert commodity.calls == [("get_latest_price", "XAU")]
    assert default.calls == []


def test_routes_ordinary_ticker_to_default_provider(composite):
    provider, default, commodity = composite

    obs = provider.get_latest_price("VAR.OL")

    assert obs.provider == "default"
    assert default.calls == [("get_latest_price", "VAR.OL")]
    assert commodity.calls == []


def test_routing_is_case_insensitive(composite):
    provider, default, commodity = composite

    provider.get_latest_price("xau")

    assert commodity.calls == [("get_latest_price", "xau")]


def test_fx_rate_always_goes_to_default_provider_even_for_commodity_ticker(composite):
    provider, default, commodity = composite

    provider.get_fx_rate("USD", "NOK")

    assert default.calls == [("get_fx_rate", "USD", "NOK")]
    assert commodity.calls == []


def test_get_market_metadata_routes_by_ticker(composite):
    provider, default, commodity = composite

    provider.get_market_metadata("XAG")

    assert commodity.calls == [("get_market_metadata", "XAG")]
    assert default.calls == []
