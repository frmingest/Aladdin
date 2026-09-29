"""Sprint 15 #5 — the nightly tripwire check: refreshes prices, fires and
clears tripwires without anyone opening a page, reports only what changed
during the pass, is due once per UTC day, and one failing holding never
stops the rest."""
from __future__ import annotations

from datetime import datetime, timedelta, timezone
from decimal import Decimal

from sqlalchemy import create_engine
from sqlalchemy.orm import Session

from app.models import Base, Holding
from app.models.market import MarketObservation
from app.providers.base import PricePoint
from app.services.thesis.nightly import (
    is_due,
    last_check,
    run_check_if_due,
    run_tripwire_check,
)
from app.services.thesis.tripwires import create_tripwire, update_tripwire

D = Decimal
NOW = datetime(2026, 9, 30, 4, 0, tzinfo=timezone.utc)


class _Market:
    name = "fake"

    def __init__(self, prices: dict[str, str | Exception]):
        self.prices = prices

    def get_current_price(self, ticker, *, currency_hint=None):
        value = self.prices[ticker]
        if isinstance(value, Exception):
            raise value
        return PricePoint(price=D(value), currency="USD", observed_at=datetime.now(timezone.utc), provider="fake")


def _db() -> Session:
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(engine)
    return Session(engine)


def _holding(db, ticker="AAA") -> Holding:
    holding = Holding(ticker=ticker, name=f"{ticker} Inc.", trading_currency="USD")
    db.add(holding)
    db.commit()
    return holding


def _stored_price(db, holding, price, when):
    db.add(MarketObservation(holding_id=holding.id, observed_at=when, price=D(price), currency="USD", provider="old"))
    db.commit()


def test_price_refresh_makes_a_tripwire_fire_and_reports_it_once():
    db = _db()
    holding = _holding(db)
    _stored_price(db, holding, "120", NOW - timedelta(days=2))
    tw = create_tripwire(db, holding, metric="share_price", operator="below", threshold=D("100"))

    first = run_tripwire_check(db, market_data_provider=_Market({"AAA": "90"}), now=NOW)
    assert [c.ticker for c in first.newly_fired] == ["AAA"]
    db.refresh(tw)
    assert tw.fired_at is not None

    second = run_tripwire_check(db, market_data_provider=_Market({"AAA": "85"}), now=NOW + timedelta(days=1))
    assert second.newly_fired == []  # already firing: not reported again
    assert second.tripwires_checked == 1


def test_recovery_is_reported_as_cleared():
    db = _db()
    holding = _holding(db)
    create_tripwire(db, holding, metric="share_price", operator="below", threshold=D("100"))
    run_tripwire_check(db, market_data_provider=_Market({"AAA": "90"}), now=NOW)

    result = run_tripwire_check(db, market_data_provider=_Market({"AAA": "110"}), now=NOW + timedelta(days=1))
    assert [c.ticker for c in result.cleared] == ["AAA"]
    assert result.newly_fired == []


def test_failed_price_refresh_is_reported_and_stored_data_is_used():
    db = _db()
    holding = _holding(db)
    _stored_price(db, holding, "80", NOW - timedelta(hours=1))
    create_tripwire(db, holding, metric="share_price", operator="below", threshold=D("100"))

    result = run_tripwire_check(db, market_data_provider=_Market({"AAA": RuntimeError("blocked")}), now=NOW)
    assert result.price_refresh_failed == ["AAA"]
    assert [c.ticker for c in result.newly_fired] == ["AAA"]  # stored 80 < 100


def test_no_data_is_counted_and_never_clears_a_firing():
    db = _db()
    holding = _holding(db)
    tw = create_tripwire(db, holding, metric="share_price", operator="below", threshold=D("100"))
    result = run_tripwire_check(db, market_data_provider=None, now=NOW)
    assert result.no_data == 1
    assert result.newly_fired == []
    db.refresh(tw)
    assert tw.fired_at is None


def test_paused_tripwires_and_holdings_without_tripwires_are_skipped():
    db = _db()
    paused_holding = _holding(db, "PAU")
    _holding(db, "NONE")
    tw = create_tripwire(db, paused_holding, metric="share_price", operator="below", threshold=D("100"))
    update_tripwire(db, tw, active=False)

    result = run_tripwire_check(db, market_data_provider=_Market({}), now=NOW)
    assert result.holdings_checked == 0
    assert result.tripwires_checked == 0


def test_one_holdings_failure_does_not_stop_the_others():
    db = _db()
    bad, good = _holding(db, "BAD"), _holding(db, "GOOD")
    create_tripwire(db, bad, metric="share_price", operator="below", threshold=D("100"))
    create_tripwire(db, good, metric="share_price", operator="below", threshold=D("100"))

    result = run_tripwire_check(db, market_data_provider=_Market({"BAD": RuntimeError("x"), "GOOD": "50"}), now=NOW)
    assert result.price_refresh_failed == ["BAD"]
    assert [c.ticker for c in result.newly_fired] == ["GOOD"]


def test_last_run_and_summary_are_remembered():
    db = _db()
    assert last_check(db) == (None, None)
    holding = _holding(db)
    create_tripwire(db, holding, metric="share_price", operator="below", threshold=D("100"))
    run_tripwire_check(db, market_data_provider=_Market({"AAA": "90"}), now=NOW)

    when, summary = last_check(db)
    assert when == NOW
    assert "1 newly fired" in summary and "AAA" in summary


def test_due_once_per_utc_day_after_the_configured_hour():
    db = _db()
    assert not is_due(db, now=NOW.replace(hour=2), hour_utc=3)  # too early
    assert is_due(db, now=NOW, hour_utc=3)  # never ran
    run_tripwire_check(db, market_data_provider=None, now=NOW)
    assert not is_due(db, now=NOW + timedelta(hours=5), hour_utc=3)  # already ran today
    assert is_due(db, now=NOW + timedelta(days=1), hour_utc=3)  # next day


def test_run_check_if_due_returns_none_when_not_due():
    db = _db()
    assert run_check_if_due(db, market_data_provider=None, hour_utc=3, now=NOW.replace(hour=1)) is None
    assert run_check_if_due(db, market_data_provider=None, hour_utc=3, now=NOW) is not None
    assert run_check_if_due(db, market_data_provider=None, hour_utc=3, now=NOW) is None
