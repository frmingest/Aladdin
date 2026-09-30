"""Page-load work (2026-09-30): stored snapshots, stale price history and
the Server-Timing header."""
from __future__ import annotations

from datetime import datetime, timedelta, timezone
from decimal import Decimal

from fastapi import FastAPI
from fastapi.testclient import TestClient
from pydantic import BaseModel
from sqlalchemy import create_engine
from sqlalchemy.orm import Session

from app.models import Base, Holding
from app.models.risk import PriceHistoryObservation
from app.models.snapshot import ComputedSnapshot
from app.models.watchlist import WatchlistItem
from app.services import snapshots
from app.services.risk.price_history import get_or_refresh_daily_history
from app.timing import TimingMiddleware


class Payload(BaseModel):
    value: int
    snapshot_at: datetime | None = None


def _db() -> Session:
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(engine)
    return Session(engine)


def _holding(db, ticker="ABC"):
    h = Holding(ticker=ticker, name=ticker, trading_currency="NOK", asset_class_raw="stock")
    db.add(h)
    db.commit()
    return h


def test_second_read_is_served_from_the_snapshot():
    db = _db()
    calls = []

    def build():
        calls.append(1)
        return Payload(value=len(calls))

    first = snapshots.get_or_build(db, "k", Payload, build)
    second = snapshots.get_or_build(db, "k", Payload, build)
    assert len(calls) == 1
    assert first.value == second.value == 1
    assert second.snapshot_at is not None


def test_refresh_rebuilds_and_replaces_the_snapshot():
    db = _db()
    n = {"v": 0}

    def build():
        n["v"] += 1
        return Payload(value=n["v"])

    snapshots.get_or_build(db, "k", Payload, build)
    assert snapshots.get_or_build(db, "k", Payload, build, refresh=True).value == 2
    assert snapshots.get_or_build(db, "k", Payload, build).value == 2  # the new one is served


def test_changed_inputs_invalidate_the_snapshot():
    db = _db()
    holding = _holding(db)
    n = {"v": 0}

    def build():
        n["v"] += 1
        return Payload(value=n["v"])

    snapshots.get_or_build(db, "k", Payload, build)
    db.add(WatchlistItem(holding_id=holding.id, buy_below_price=Decimal(10)))
    db.commit()
    assert snapshots.get_or_build(db, "k", Payload, build).value == 2


def test_buy_below_edit_invalidates_the_snapshot():
    db = _db()
    holding = _holding(db)
    item = WatchlistItem(holding_id=holding.id, buy_below_price=Decimal(10))
    db.add(item)
    db.commit()
    before = snapshots.fingerprint(db)
    item.buy_below_price = Decimal(12)
    db.commit()
    assert snapshots.fingerprint(db) != before


def test_expired_snapshot_is_rebuilt():
    db = _db()
    n = {"v": 0}

    def build():
        n["v"] += 1
        return Payload(value=n["v"])

    snapshots.get_or_build(db, "k", Payload, build)
    row = db.get(ComputedSnapshot, "k")
    row.computed_at = datetime.now(timezone.utc) - timedelta(days=5)
    db.commit()
    assert snapshots.get_or_build(db, "k", Payload, build).value == 2


def test_unreadable_snapshot_falls_back_to_a_live_build():
    db = _db()
    snapshots.get_or_build(db, "k", Payload, lambda: Payload(value=1))
    row = db.get(ComputedSnapshot, "k")
    row.payload = "not json"
    db.commit()
    assert snapshots.get_or_build(db, "k", Payload, lambda: Payload(value=7)).value == 7


class _ExplodingProvider:
    def get_daily_price_history(self, *a, **k):  # pragma: no cover - must not be called
        raise AssertionError("a live fetch happened")


def _stale_history(db, ticker="ABC"):
    old = datetime.now(timezone.utc) - timedelta(days=10)
    for i in range(5):
        db.add(PriceHistoryObservation(
            ticker=ticker, observed_on=datetime.now(timezone.utc).date() - timedelta(days=20 - i), close=Decimal(100),
            currency="NOK", provider="test", fetched_at=old,
        ))
    db.commit()


def test_serve_stale_returns_stored_history_without_a_live_call():
    db = _db()
    _stale_history(db)
    history = get_or_refresh_daily_history(
        db, _ExplodingProvider(), ticker="ABC", currency_hint="NOK", lookback_days=60, serve_stale=True
    )
    assert history.available and len(history.points) == 5


def test_without_serve_stale_a_stale_history_is_refetched():
    db = _db()
    _stale_history(db)
    try:
        get_or_refresh_daily_history(
            db, _ExplodingProvider(), ticker="ABC", currency_hint="NOK", lookback_days=60
        )
    except AssertionError:
        return
    raise AssertionError("expected a live fetch attempt")


def test_serve_stale_still_fetches_a_ticker_with_nothing_stored():
    db = _db()
    try:
        get_or_refresh_daily_history(
            db, _ExplodingProvider(), ticker="NEW", currency_hint="NOK", lookback_days=60, serve_stale=True
        )
    except AssertionError:
        return
    raise AssertionError("expected a live fetch for a never-fetched ticker")


def test_server_timing_header_reports_queries():
    engine = create_engine("sqlite:///:memory:")
    app = FastAPI()
    app.add_middleware(TimingMiddleware)

    @app.get("/x")
    def x() -> dict:
        with Session(engine) as s:
            s.execute(__import__("sqlalchemy").text("select 1"))
            s.execute(__import__("sqlalchemy").text("select 2"))
        return {"ok": True}

    response = TestClient(app).get("/x")
    assert response.headers["X-DB-Queries"] == "2"
    assert "total;dur=" in response.headers["Server-Timing"]
    assert "2 queries" in response.headers["Server-Timing"]


def test_nightly_refresh_stores_each_page_and_survives_one_failure(monkeypatch):
    from app.api import performance, risk, valuation, watchlist
    from app.services import snapshot_refresh

    db = _db()
    monkeypatch.setattr(risk, "build_risk_out", lambda *a, **k: Payload(value=1))
    monkeypatch.setattr(performance, "build_performance_out", lambda *a, **k: Payload(value=2))
    monkeypatch.setattr(valuation, "build_board_out", lambda *a, **k: Payload(value=3))

    def boom(*a, **k):
        raise RuntimeError("provider down")

    monkeypatch.setattr(watchlist, "build_watchlist_out", boom)

    summary = snapshot_refresh.refresh_all_snapshots(db, market_data_provider=None, risk_free_rate_provider=None)

    assert "FAILED: watchlist" in summary
    assert db.get(ComputedSnapshot, snapshots.RISK_KEY) is not None
    assert db.get(ComputedSnapshot, snapshots.BOARD_KEY) is not None
    assert db.get(ComputedSnapshot, snapshots.WATCHLIST_KEY) is None
    when, text = snapshot_refresh.last_run(db)
    assert when is not None and "FAILED" in text


def test_nightly_refresh_is_due_once_per_utc_day():
    from app.models.app_setting import AppSetting  # noqa: F401
    from app.services import snapshot_refresh

    db = _db()
    at = datetime(2026, 9, 30, 5, 0, tzinfo=timezone.utc)
    assert snapshot_refresh.is_due(db, now=at.replace(hour=3), hour_utc=4) is False  # too early
    assert snapshot_refresh.is_due(db, now=at, hour_utc=4) is True  # never ran
    snapshot_refresh._write(db, snapshot_refresh.LAST_RUN_KEY, at.isoformat())
    db.commit()
    assert snapshot_refresh.is_due(db, now=at + timedelta(hours=3), hour_utc=4) is False
    assert snapshot_refresh.is_due(db, now=at + timedelta(days=1), hour_utc=4) is True
