"""Integration tests for /precious-metals (app/api/precious_metals.py) --
against the shared FastAPI TestClient fixture (tests/integration/conftest.py),
with fake metal/FX providers swapped in via dependency_overrides so nothing
here calls gold-api.com or yfinance for real."""
from __future__ import annotations

from datetime import datetime, timezone
from decimal import Decimal

import pytest

from app.main import app
from app.providers.base import PricePoint
from app.providers.factory import get_market_data_provider, get_metal_price_provider


class _FakeProvider:
    """Same shape as app/providers/base.MarketDataProvider's daily-history
    method -- routes XAUUSD/XAGUSD to different fixed prices, and treats
    any other ticker (USDNOK=X) as the FX leg."""

    def __init__(self, *, gold_price: Decimal, silver_price: Decimal, fx_rate: Decimal):
        self._gold_price = gold_price
        self._silver_price = silver_price
        self._fx_rate = fx_rate

    def get_daily_price_history(self, ticker, *, days=400, currency_hint=None):
        if ticker == "XAUUSD":
            price = self._gold_price
        elif ticker == "XAGUSD":
            price = self._silver_price
        else:
            price = self._fx_rate
        return [
            PricePoint(
                price=price,
                currency=currency_hint or "USD",
                observed_at=datetime.now(timezone.utc),
                provider="fake",
            )
        ]


@pytest.fixture(autouse=True)
def _fake_price_providers():
    fake = _FakeProvider(gold_price=Decimal(4000), silver_price=Decimal(50), fx_rate=Decimal(10))
    app.dependency_overrides[get_metal_price_provider] = lambda: fake
    app.dependency_overrides[get_market_data_provider] = lambda: fake
    yield
    app.dependency_overrides.pop(get_metal_price_provider, None)
    app.dependency_overrides.pop(get_market_data_provider, None)


def test_list_coin_series_has_fifteen_gold_and_fifteen_silver(client):
    resp = client.get("/precious-metals/coin-series")
    assert resp.status_code == 200
    series = resp.json()
    gold = [s for s in series if s["metal"] == "gold"]
    silver = [s for s in series if s["metal"] == "silver"]
    assert len(gold) == 15
    assert len(silver) == 15
    codes = {s["code"] for s in series}
    assert "canadian_maple_leaf_gold" in codes
    assert "krugerrand_gold" in codes
    assert "australian_kangaroo_gold" in codes


def test_add_holding_rejects_unknown_coin_series(client):
    resp = client.post("/precious-metals", json={"coin_series": "not_a_real_coin", "quantity": "1"})
    assert resp.status_code == 422


def test_add_get_update_delete_holding_lifecycle(client):
    create_resp = client.post(
        "/precious-metals",
        json={
            "coin_series": "canadian_maple_leaf_gold",
            "quantity": "2",
            "purchase_price_nok": "50000",
        },
    )
    assert create_resp.status_code == 201
    body = create_resp.json()
    assert body["metal"] == "gold"
    assert body["coin_series_label"]
    holding_id = body["id"]

    overview_resp = client.get("/precious-metals/overview")
    assert overview_resp.status_code == 200
    overview = overview_resp.json()
    gold_spot = next(s for s in overview["spots"] if s["metal"] == "gold")
    assert gold_spot["available"] is True
    assert float(gold_spot["price_nok_per_oz"]) == 40000  # 4000 USD * 10 NOK/USD
    gold_row = next(h for h in overview["holdings"] if h["id"] == holding_id)
    assert float(gold_row["value_nok"]) == 80000  # 2 oz * 40000
    assert float(gold_row["unrealized_pnl_nok"]) == 30000  # 80000 - 50000
    assert float(overview["total_value_nok"]) == 80000

    patch_resp = client.patch(f"/precious-metals/{holding_id}", json={"quantity": "3", "storage_location": "Home safe"})
    assert patch_resp.status_code == 200
    assert float(patch_resp.json()["quantity"]) == 3
    assert patch_resp.json()["storage_location"] == "Home safe"

    delete_resp = client.delete(f"/precious-metals/{holding_id}")
    assert delete_resp.status_code == 204

    missing_patch = client.patch(f"/precious-metals/{holding_id}", json={"quantity": "1"})
    assert missing_patch.status_code == 404

    missing_delete = client.delete(f"/precious-metals/{holding_id}")
    assert missing_delete.status_code == 404


def test_price_history_endpoint_returns_points_for_known_metal(client):
    resp = client.get("/precious-metals/price-history/gold")
    assert resp.status_code == 200
    body = resp.json()
    assert body["metal"] == "gold"
    assert len(body["points"]) >= 1
    assert float(body["points"][0]["price_nok"]) == 40000
    assert body.get("method_note")


def test_price_history_endpoint_rejects_unknown_metal(client):
    resp = client.get("/precious-metals/price-history/platinum")
    assert resp.status_code == 404
