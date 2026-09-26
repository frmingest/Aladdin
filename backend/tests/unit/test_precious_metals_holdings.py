"""Unit tests for app/services/precious_metals/holdings.py: CRUD and the
spot-valued overview -- against an in-memory SQLite DB and fake metal/FX
providers (no real gold-api.com or yfinance calls)."""
from datetime import datetime, timezone
from decimal import Decimal

from sqlalchemy import create_engine
from sqlalchemy.orm import Session

from app.models import Base
from app.providers.base import MarketDataUnavailableError, PricePoint
from app.services.precious_metals.holdings import (
    InvalidCoinSeriesError,
    compute_overview,
    create_holding,
    delete_holding,
    list_holdings,
    update_holding,
)

D = Decimal


def _session() -> Session:
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(engine)
    return Session(engine)


class _FakeProvider:
    def __init__(self, *, price=None, error=None):
        self._price = price
        self._error = error
        self.calls = 0

    def get_daily_price_history(self, ticker, *, days=400, currency_hint=None):
        self.calls += 1
        if self._error is not None:
            raise self._error
        return [
            PricePoint(price=self._price, currency=currency_hint or "USD", observed_at=datetime.now(timezone.utc), provider="fake")
        ]


def test_create_holding_rejects_unknown_series():
    db = _session()
    try:
        create_holding(db, coin_series="not_a_real_series", quantity=D(1))
        assert False, "should have raised"
    except InvalidCoinSeriesError:
        pass


def test_create_holding_rejects_non_positive_quantity():
    db = _session()
    try:
        create_holding(db, coin_series="american_eagle_gold", quantity=D(0))
        assert False, "should have raised"
    except ValueError:
        pass


def test_create_holding_derives_metal_from_series():
    db = _session()
    holding = create_holding(db, coin_series="american_eagle_silver", quantity=D(3))
    assert holding.metal == "silver"
    assert len(list_holdings(db)) == 1


def test_update_and_delete_holding():
    db = _session()
    holding = create_holding(db, coin_series="canadian_maple_leaf_gold", quantity=D(2))

    updated = update_holding(db, holding.id, quantity=D(5), storage_location="Bank vault")
    assert updated.quantity == D(5)
    assert updated.storage_location == "Bank vault"

    assert delete_holding(db, holding.id) is True
    assert list_holdings(db) == []
    assert delete_holding(db, holding.id) is False  # already gone


def test_update_holding_can_clear_purchase_price():
    db = _session()
    holding = create_holding(db, coin_series="krugerrand_gold", quantity=D(1), purchase_price_nok=D("30000"))
    updated = update_holding(db, holding.id, clear_purchase_price=True)
    assert updated.purchase_price_nok is None


def test_overview_values_holdings_at_spot_and_computes_pnl():
    db = _session()
    create_holding(db, coin_series="american_eagle_gold", quantity=D(2), purchase_price_nok=D("50000"))
    create_holding(db, coin_series="american_eagle_silver", quantity=D(10))

    gold_provider = _FakeProvider(price=D("4000"))  # USD/oz
    fx_provider = _FakeProvider(price=D("10"))  # USD -> NOK
    silver_provider = _FakeProvider(price=D("50"))

    class _MetalRouter:
        def get_daily_price_history(self, ticker, *, days=400, currency_hint=None):
            if ticker == "XAUUSD":
                return gold_provider.get_daily_price_history(ticker, days=days, currency_hint=currency_hint)
            return silver_provider.get_daily_price_history(ticker, days=days, currency_hint=currency_hint)

    overview = compute_overview(db, _MetalRouter(), fx_provider)

    gold_spot = overview.spots["gold"]
    assert gold_spot.available
    assert gold_spot.price_nok_per_oz == D("40000")  # 4000 USD * 10 NOK/USD

    gold_row = next(h for h in overview.holdings if h.metal == "gold")
    assert gold_row.value_nok == D("80000")  # 2 oz * 40000
    assert gold_row.unrealized_pnl_nok == D("30000")  # 80000 - 50000

    silver_row = next(h for h in overview.holdings if h.metal == "silver")
    assert silver_row.value_nok == D("5000")  # 10 oz * (50 * 10)

    assert overview.total_value_nok == D("85000")
    assert overview.total_oz_by_metal["gold"] == D(2)
    assert overview.total_oz_by_metal["silver"] == D(10)


def test_overview_reports_unavailable_spot_without_crashing():
    db = _session()
    create_holding(db, coin_series="american_eagle_gold", quantity=D(1))
    failing = _FakeProvider(error=MarketDataUnavailableError("gold-api.com is down"))
    fx = _FakeProvider(price=D("10"))

    overview = compute_overview(db, failing, fx)

    gold_spot = overview.spots["gold"]
    assert not gold_spot.available
    assert "gold-api.com is down" in (gold_spot.reason or "")
    gold_row = next(h for h in overview.holdings if h.metal == "gold")
    assert gold_row.value_nok is None
