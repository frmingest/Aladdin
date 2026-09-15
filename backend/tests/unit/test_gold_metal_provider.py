"""
Unit tests for GoldApiMarketDataProvider (§26 Phase 8, ADR 0011).

Monkeypatches `requests.get` with a fake response shaped like gold-api.com's
documented API (no real network call — this cloud sandbox's egress proxy
blocks api.gold-api.com outright, same as it blocks data.norges-bank.no; see
the module docstring). A live-network smoke test is a manual follow-up
outside CI, same convention as test_yfinance_provider.py /
test_norges_bank_provider.py.
"""

from datetime import datetime, timezone
from decimal import Decimal

import pytest

import app.providers.gold_metal_provider as gmp
from app.providers.base import MarketDataUnavailableError


class _FakeResponse:
    def __init__(self, payload=None, status=200, json_error=False):
        self._payload = payload
        self.status_code = status
        self._json_error = json_error

    def raise_for_status(self):
        if self.status_code >= 400:
            import requests

            raise requests.HTTPError(f"{self.status_code} error")

    def json(self):
        if self._json_error:
            raise ValueError("not json")
        return self._payload


@pytest.fixture()
def provider():
    return gmp.GoldApiMarketDataProvider()


def test_get_latest_price_maps_gold_api_response(monkeypatch, provider):
    seen_urls = []

    def _get(url, timeout):
        seen_urls.append(url)
        return _FakeResponse(
            {"name": "Gold", "price": 2451.32, "symbol": "XAU", "updatedAt": "2026-09-15T08:00:00Z"}
        )

    monkeypatch.setattr(gmp.requests, "get", _get)

    obs = provider.get_latest_price("xau")

    assert seen_urls == [f"{gmp.DEFAULT_BASE_URL}/XAU"]
    assert obs.ticker == "XAU"
    assert obs.price == Decimal("2451.32")
    assert obs.currency == "USD"
    assert obs.provider == "gold_api"
    assert obs.status == "delayed"
    assert obs.observed_at == datetime(2026, 9, 15, 8, 0, tzinfo=timezone.utc)


def test_get_latest_price_rejects_unsupported_ticker(provider):
    with pytest.raises(MarketDataUnavailableError):
        provider.get_latest_price("AAPL")


def test_get_latest_price_raises_when_price_field_missing(monkeypatch, provider):
    monkeypatch.setattr(gmp.requests, "get", lambda url, timeout: _FakeResponse({"symbol": "XAG"}))

    with pytest.raises(MarketDataUnavailableError):
        provider.get_latest_price("XAG")


def test_get_latest_price_raises_on_http_error(monkeypatch, provider):
    monkeypatch.setattr(gmp.requests, "get", lambda url, timeout: _FakeResponse(status=500))

    with pytest.raises(MarketDataUnavailableError):
        provider.get_latest_price("XAU")


def test_get_latest_price_falls_back_to_now_when_updated_at_missing(monkeypatch, provider):
    monkeypatch.setattr(
        gmp.requests, "get", lambda url, timeout: _FakeResponse({"price": 30.5, "symbol": "XAG"})
    )

    obs = provider.get_latest_price("XAG")

    assert obs.price == Decimal("30.5")
    assert obs.observed_at.tzinfo is not None


def test_get_historical_prices_is_unavailable(provider):
    with pytest.raises(MarketDataUnavailableError):
        provider.get_historical_prices(
            "XAU", datetime(2026, 1, 1, tzinfo=timezone.utc), datetime(2026, 9, 1, tzinfo=timezone.utc)
        )


def test_get_fx_rate_is_unavailable(provider):
    with pytest.raises(MarketDataUnavailableError):
        provider.get_fx_rate("USD", "NOK")


def test_get_dividends_is_empty(provider):
    assert provider.get_dividends("XAU") == []


def test_get_market_metadata_returns_usd_spot(provider):
    meta = provider.get_market_metadata("xag")

    assert meta.ticker == "XAG"
    assert meta.currency == "USD"
    assert meta.exchange == "spot"
    assert meta.provider == "gold_api"
