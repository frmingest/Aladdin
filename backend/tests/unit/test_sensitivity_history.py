"""The worker job that stores the price history the Siege Simulator (v2) reads (2026-10-07)."""
from __future__ import annotations

from datetime import datetime, time, timedelta, timezone
from decimal import Decimal

import pytest
from sqlalchemy import create_engine, func, select
from sqlalchemy.orm import Session

from app.domain.game_mapping.siege_scenarios_v1 import (
    SIEGE_SCENARIOS_V1,
    get_siege_scenarios,
)
from app.models import Base
from app.models.account import Account
from app.models.document import Document
from app.models.holding import Holding
from app.models.portfolio import PortfolioPosition, PortfolioSnapshot
from app.models.risk import PriceHistoryObservation
from app.providers.base import MarketDataUnavailableError, PricePoint
from app.services.risk.sensitivity_history import (
    refresh_sensitivity_history,
    wanted_tickers,
)

D = Decimal
V2 = get_siege_scenarios("v2")


class _Market:
    name = "fake"

    def __init__(self, known):
        self.known = known
        self.calls = []

    def get_daily_price_history(self, ticker, *, days=400, currency_hint=None):
        self.calls.append((ticker, days))
        if ticker not in self.known:
            raise MarketDataUnavailableError(f"no history for {ticker}")
        today = datetime.now(timezone.utc).date()
        return [
            PricePoint(
                price=D(100 + i), currency=self.known[ticker],
                observed_at=datetime.combine(today - timedelta(days=5 - i), time(12), tzinfo=timezone.utc),
                provider="fake",
            )
            for i in range(5)
        ]


@pytest.fixture()
def db():
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(engine)
    with Session(engine) as session:
        yield session


def _own(db, ticker, currency, value):
    """One account, one current snapshot; each call adds a position to it."""
    snap = db.scalar(select(PortfolioSnapshot))
    if snap is None:
        account = Account(name="ASK", account_number="1")
        doc = Document(type="portfolio_export", original_filename="a.csv", mime_type="text/csv", size_bytes=1,
                       storage_path="a.csv", sha256="a" * 64, status="processed", quality_flags={})
        snap = PortfolioSnapshot(source_file=doc, reporting_currency="NOK", status="processed", account=account)
        db.add_all([account, doc, snap])
    holding = Holding(ticker=ticker, name=ticker, trading_currency=currency, asset_class_raw="equity_etf")
    db.add_all([holding, PortfolioPosition(snapshot=snap, holding=holding, market_value_nok=D(value))])
    db.commit()


def test_wants_every_owned_ticker_the_benchmark_and_the_fx_pairs(db):
    _own(db, "FUND.OL", "NOK", 100)
    _own(db, "GOLD.DE", "EUR", 200)
    wanted = wanted_tickers(db, V2)
    assert set(wanted) == {"OSEBX.OL", "FUND.OL", "GOLD.DE", "EURNOK=X"}


def test_stores_history_and_reports_a_ticker_that_failed(db):
    _own(db, "FUND.OL", "NOK", 100)
    _own(db, "GOLD.DE", "EUR", 200)
    market = _Market({"OSEBX.OL": "NOK", "FUND.OL": "NOK", "GOLD.DE": "EUR"})  # no EURNOK=X
    result = refresh_sensitivity_history(db, market, V2)
    assert sorted(result.fetched) == ["FUND.OL", "GOLD.DE", "OSEBX.OL"]
    assert len(result.problems) == 1 and "EURNOK=X" in result.problems[0]
    assert db.scalar(select(func.count()).select_from(PriceHistoryObservation)) == 15
    assert all(days >= V2.history_lookback_days for _, days in market.calls)
    assert "3 tickers" in result.summary() and "EURNOK=X" in result.summary()


def test_fresh_history_costs_no_vendor_call(db):
    _own(db, "FUND.OL", "NOK", 100)
    market = _Market({"OSEBX.OL": "NOK", "FUND.OL": "NOK"})
    refresh_sensitivity_history(db, market, V2)
    first = len(market.calls)
    refresh_sensitivity_history(db, market, V2)
    assert len(market.calls) == first


def test_v1_scenarios_fetch_nothing(db):
    _own(db, "FUND.OL", "NOK", 100)
    market = _Market({"FUND.OL": "NOK"})
    result = refresh_sensitivity_history(db, market, SIEGE_SCENARIOS_V1)
    assert market.calls == [] and result.fetched == []
