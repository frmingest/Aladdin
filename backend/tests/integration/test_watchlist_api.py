"""Integration tests for /watchlist (feature F7). Market data is a fake;
no real yfinance or FRED call is made."""
from __future__ import annotations

from datetime import datetime, timezone
from decimal import Decimal

import pytest

from app.main import app
from app.providers.base import (
    MarketDataUnavailableError,
    PricePoint,
    RiskFreeRateUnavailableError,
)
from app.providers.factory import get_market_data_provider, get_risk_free_rate_provider


class _Market:
    name = "fake"

    def __init__(self, price):
        self.price = price

    def get_current_price(self, ticker, *, currency_hint=None):
        return PricePoint(price=Decimal(self.price), currency="NOK",
                          observed_at=datetime.now(timezone.utc), provider="fake")

    def get_price_history(self, ticker, *, years=5, currency_hint=None):  # pragma: no cover
        raise NotImplementedError

    def get_fx_rate(self, from_currency, to_currency):
        raise MarketDataUnavailableError("no fx")

    def get_beta(self, ticker):
        return Decimal(1)


class _Rate:
    def get_risk_free_rate(self, currency):
        raise RiskFreeRateUnavailableError("no rate")


@pytest.fixture()
def priced(client):
    app.dependency_overrides[get_market_data_provider] = lambda: _Market("95")
    app.dependency_overrides[get_risk_free_rate_provider] = lambda: _Rate()
    yield client
    app.dependency_overrides.pop(get_market_data_provider, None)
    app.dependency_overrides.pop(get_risk_free_rate_provider, None)


def test_add_new_ticker_creates_holding_and_flags_buy_zone(priced):
    r = priced.post("/watchlist", json={"ticker": "ork.ol", "name": "Orkla ASA", "trading_currency": "nok",
                                        "buy_below_price": "100"})
    assert r.status_code == 201, r.text
    entry = r.json()
    assert entry["ticker"] == "ORK.OL"
    assert entry["buy_below_currency"] == "NOK"
    assert entry["owned"] is False

    holdings = priced.get("/holdings").json()
    assert [h["ticker"] for h in holdings] == ["ORK.OL"]
    assert holdings[0]["asset_class_raw"] == "stock"

    body = priced.get("/watchlist").json()
    assert body["buy_zone_count"] == 1
    row = body["rows"][0]
    assert row["status"] == "buy_zone"
    assert Decimal(row["distance_to_buy_pct"]) == Decimal(-5)
    assert Decimal(row["price"]) == 95


def test_unknown_ticker_without_name_is_rejected(client):
    r = client.post("/watchlist", json={"ticker": "NEW.OL"})
    assert r.status_code == 422
    assert "name and trading currency" in r.json()["detail"]


def test_duplicate_is_409_and_existing_holding_by_id(client):
    hid = client.post("/holdings", json={"ticker": "KO", "name": "Coca-Cola", "trading_currency": "USD"}).json()["id"]
    assert client.post("/watchlist", json={"holding_id": hid}).status_code == 201
    assert client.post("/watchlist", json={"ticker": "KO"}).status_code == 409
    entry = client.get(f"/watchlist/holdings/{hid}").json()
    assert entry["ticker"] == "KO"
    assert entry["status"] == "no_target"


def test_update_and_remove_requires_confirm(client):
    hid = client.post("/holdings", json={"ticker": "KO", "name": "Coca-Cola", "trading_currency": "USD"}).json()["id"]
    entry = client.post("/watchlist", json={"holding_id": hid}).json()

    updated = client.patch(f"/watchlist/{entry['id']}", json={"buy_below_price": "55.5", "notes": "wait"}).json()
    assert Decimal(updated["buy_below_price"]) == Decimal("55.5")
    assert updated["buy_below_currency"] == "USD"
    assert updated["notes"] == "wait"
    cleared = client.patch(f"/watchlist/{entry['id']}", json={"buy_below_price": None}).json()
    assert cleared["buy_below_price"] is None and cleared["notes"] == "wait"

    assert client.delete(f"/watchlist/{entry['id']}").status_code == 400
    assert client.delete(f"/watchlist/{entry['id']}", params={"confirm": True}).status_code == 204
    assert client.get(f"/watchlist/holdings/{hid}").json() is None
    assert client.get(f"/holdings/{hid}").status_code == 200  # the holding stays


def test_deleting_the_holding_removes_its_watchlist_entry(client):
    hid = client.post("/holdings", json={"ticker": "KO", "name": "Coca-Cola", "trading_currency": "USD"}).json()["id"]
    client.post("/watchlist", json={"holding_id": hid})
    assert client.delete(f"/holdings/{hid}", params={"confirm": True}).status_code == 204
    assert client.get("/watchlist").json()["rows"] == []
