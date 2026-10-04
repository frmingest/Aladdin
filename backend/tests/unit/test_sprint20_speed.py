"""Sprint 20 (2026-10-03): speed without hiding anything.

* a plain GET never makes a first-ever vendor call (price / FX / rate /
  share count / beta / research) — it says what is missing;
* beta is stored in the database, so a restart does not empty it;
* the warm-up service fetches the first values off the request;
* the worker rebuilds stored pages whose inputs changed, between runs."""
from __future__ import annotations

import time
from datetime import datetime, timedelta, timezone
from decimal import Decimal

from pydantic import BaseModel
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from app.config.settings import Settings
from app.models import Base, Holding
from app.models.market import MarketObservation
from app.models.portfolio import PortfolioPosition, PortfolioSnapshot
from app.models.snapshot import ComputedSnapshot
from app.models.watchlist import WatchlistItem
from app.providers.base import (
    FxRate,
    MarketDataUnavailableError,
    PricePoint,
    RiskFreeRate,
)
from app.services import snapshot_refresh, snapshots, warmup
from app.services.market_data import beta as beta_service
from app.services.market_data.common import (
    COLD_REASON,
    cold_fetch_allowed,
    get_or_refresh,
)
from app.services.market_data.fx import get_or_refresh_fx
from app.services.market_data.price import get_or_refresh_price
from app.services.market_data.risk_free_rate import get_or_refresh_risk_free_rate
from app.worker.runner import RAN, AnalysisWorker, WorkerProviders

D = Decimal


def _db() -> Session:
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(engine)
    return Session(engine)


def _holding(db, ticker="ABC", currency="NOK") -> Holding:
    h = Holding(ticker=ticker, name=ticker, trading_currency=currency, asset_class_raw="stock")
    db.add(h)
    db.commit()
    return h


class _Market:
    name = "fake"

    def __init__(self, *, price="100", currency="NOK", beta="1.2", shares=None, fail=False):
        self.price, self.currency, self.beta, self.shares, self.fail = price, currency, beta, shares, fail
        self.calls = {"price": 0, "fx": 0, "beta": 0, "shares": 0}

    def get_current_price(self, ticker, *, currency_hint=None):
        self.calls["price"] += 1
        if self.fail:
            raise MarketDataUnavailableError("yahoo says no")
        return PricePoint(price=D(self.price), currency=self.currency, observed_at=datetime.now(timezone.utc), provider="fake")

    def get_fx_rate(self, a, b):
        self.calls["fx"] += 1
        return FxRate(from_currency=a, to_currency=b, rate=D("10"), observed_at=datetime.now(timezone.utc), provider="fake")

    def get_beta(self, ticker, *, allow_live_fetch=True):
        self.calls["beta"] += 1
        return None if self.beta is None else D(self.beta)

    def get_shares_outstanding(self, ticker):
        self.calls["shares"] += 1
        if self.shares is None:
            raise MarketDataUnavailableError("no share count")
        return D(self.shares)



class _Rate:
    def __init__(self):
        self.calls = 0

    def get_risk_free_rate(self, currency):
        self.calls += 1
        return RiskFreeRate(currency=currency, rate=D("4"), observed_at=datetime.now(timezone.utc), provider="fake", source_series_id="X")


# --- the cold rule ---------------------------------------------------------


def test_get_with_nothing_stored_does_not_call_the_vendor():
    db = _db()
    holding = _holding(db)
    market = _Market()
    snap = get_or_refresh_price(db, market, holding=holding, refresh_live=False)
    assert snap.available is False and snap.reason == COLD_REASON
    assert market.calls["price"] == 0


def test_get_with_a_stale_value_serves_it_and_does_not_call_the_vendor():
    db = _db()
    holding = _holding(db)
    old = datetime.now(timezone.utc) - timedelta(days=5)
    db.add(MarketObservation(holding_id=holding.id, observed_at=old, price=D("90"), currency="NOK", provider="fake"))
    db.commit()
    market = _Market()
    snap = get_or_refresh_price(db, market, holding=holding, refresh_live=False)
    assert snap.available and snap.value.price == D("90")
    assert "click refresh" in snap.reason
    assert market.calls["price"] == 0


def test_force_and_default_still_fetch():
    db = _db()
    holding = _holding(db)
    market = _Market()
    assert get_or_refresh_price(db, market, holding=holding).available  # default = live
    assert get_or_refresh_price(db, market, holding=holding, force=True, refresh_live=False).available
    assert market.calls["price"] == 2


def test_fx_and_rate_follow_the_same_cold_rule():
    db = _db()
    market, rate = _Market(), _Rate()
    fx = get_or_refresh_fx(db, market, from_currency="USD", to_currency="NOK", refresh_live=False)
    rf = get_or_refresh_risk_free_rate(db, rate, currency="USD", refresh_live=False)
    assert not fx.available and not rf.available
    assert market.calls["fx"] == 0 and rate.calls == 0


def test_the_analysis_scope_lifts_only_the_cold_rule():
    db = _db()
    holding = _holding(db)
    market = _Market()
    with cold_fetch_allowed():
        assert get_or_refresh_price(db, market, holding=holding, refresh_live=False).available
    assert market.calls["price"] == 1
    # outside the scope the rule is back, and a stale value is still not refetched
    other = _holding(db, "XYZ")
    assert get_or_refresh_price(db, market, holding=other, refresh_live=False).available is False


def test_generic_get_or_refresh_cold_message_is_shared():
    db = _db()
    snap = get_or_refresh(
        db, latest=lambda: None, observed_at_of=lambda x: x, fetch_and_persist=lambda: 1 / 0,
        stale_after_hours=1, unavailable_error=MarketDataUnavailableError, refresh_live=False,
    )
    assert snap.reason == COLD_REASON


# --- stored beta -----------------------------------------------------------


def test_beta_is_stored_and_survives_a_new_provider_instance():
    db = _db()
    first = beta_service.get_or_refresh_beta(db, _Market(beta="1.35"), "abc")
    assert first.value == D("1.35")
    assert db.get(ComputedSnapshot, "beta:ABC") is not None  # no new table, no migration

    restarted = _Market(beta="9.99")  # a fresh process: its own cache is empty
    second = beta_service.get_or_refresh_beta(db, restarted, "ABC", refresh_live=False)
    assert second.value == D("1.35")
    assert restarted.calls["beta"] == 0


def test_beta_get_with_nothing_stored_does_not_call_yahoo():
    db = _db()
    market = _Market()
    result = beta_service.get_or_refresh_beta(db, market, "ABC", refresh_live=False)
    assert result.value is None and result.reason == COLD_REASON
    assert market.calls["beta"] == 0


def test_stale_beta_is_served_on_a_get_and_refreshed_on_demand():
    db = _db()
    beta_service.get_or_refresh_beta(db, _Market(beta="1.0"), "ABC")
    row = db.get(ComputedSnapshot, "beta:ABC")
    row.computed_at = datetime.now(timezone.utc) - timedelta(days=30)
    db.commit()

    market = _Market(beta="1.5")
    on_get = beta_service.get_or_refresh_beta(db, market, "ABC", refresh_live=False)
    assert on_get.value == D("1.0") and "click refresh" in on_get.reason and market.calls["beta"] == 0

    forced = beta_service.get_or_refresh_beta(db, market, "ABC", force=True)
    assert forced.value == D("1.5") and forced.reason is None


def test_a_failed_beta_refresh_keeps_the_stored_value():
    db = _db()
    beta_service.get_or_refresh_beta(db, _Market(beta="1.1"), "ABC")
    result = beta_service.get_or_refresh_beta(db, _Market(beta=None), "ABC", force=True)
    assert result.value == D("1.1") and "refresh failed" in result.reason


def test_no_beta_anywhere_says_so():
    db = _db()
    result = beta_service.get_or_refresh_beta(db, _Market(beta=None), "ABC")
    assert result.value is None and "no beta" in result.reason


# --- warm-up ---------------------------------------------------------------


def _own(db, holding):
    from app.models.document import Document

    document = Document(
        type="portfolio_export", original_filename="x.csv", mime_type="text/csv", size_bytes=1,
        storage_path="p/x.csv", sha256="f" * 64, status="processed", quality_flags={},
    )
    db.add(document)
    db.flush()
    snap = PortfolioSnapshot(source_file=document, reporting_currency="NOK", status="processed")
    db.add(snap)
    db.flush()
    db.add(PortfolioPosition(snapshot=snap, holding=holding, market_value_nok=D(1000)))
    db.commit()


def test_cold_holdings_are_the_owned_or_watched_ones_without_a_price():
    db = _db()
    owned, watched, _ignored, priced = (_holding(db, t) for t in ("OWN", "WATCH", "IGNORED", "PRICED"))
    _own(db, owned)
    db.add(WatchlistItem(holding_id=watched.id))
    db.add(WatchlistItem(holding_id=priced.id))
    db.add(MarketObservation(holding_id=priced.id, observed_at=datetime.now(timezone.utc), price=D(1), currency="NOK", provider="x"))
    db.commit()
    assert {h.ticker for h in warmup.cold_holdings(db)} == {"OWN", "WATCH"}


def test_warm_holding_fetches_price_fx_rate_and_beta_once():
    db = _db()
    holding = _holding(db, "AAPL", "USD")
    market, rate = _Market(currency="USD", beta="1.1", shares="1000"), _Rate()
    result = warmup.warm_holding(db, holding, market, rate)
    assert {"price", "FX USD→NOK", "risk-free rate USD", "share count", "beta"} <= set(result.fetched)
    assert result.problems == []
    again = warmup.warm_holding(db, holding, market, rate)
    assert again.fetched and market.calls == {"price": 1, "fx": 1, "beta": 1, "shares": 1} and rate.calls == 1


def test_warm_holding_explains_each_failure_and_keeps_going():
    db = _db()
    holding = _holding(db)
    result = warmup.warm_holding(db, holding, _Market(fail=True, shares=None, beta=None), _Rate())
    assert "price" not in result.fetched
    assert any(p.startswith("price:") and "yahoo says no" in p for p in result.problems)
    assert any(p.startswith("share count:") for p in result.problems)
    assert any(p.startswith("beta:") for p in result.problems)
    assert any("risk-free rate NOK" in f for f in result.fetched)  # the other steps still ran


def test_warm_up_marks_the_stored_pages_out_of_date():
    db = _db()
    holding = _holding(db)
    snapshots.store(db, snapshots.BOARD_KEY, _Payload(value=1))
    snapshots.store(db, snapshots.performance_key(365, "SPY"), _Payload(value=1))
    assert snapshots.stale_keys(db, [snapshots.BOARD_KEY]) == []
    warmup.warm_holding(db, holding, _Market(), _Rate())
    assert set(snapshots.stale_keys(db, [snapshots.BOARD_KEY, snapshots.performance_key(365, "SPY")])) == {
        snapshots.BOARD_KEY, snapshots.performance_key(365, "SPY")
    }
    assert db.get(ComputedSnapshot, "beta:ABC") is not None  # beta rows are not page snapshots: untouched


def test_worker_warmup_pass_limits_and_backs_off_failures():
    db = _db()
    holdings = [_holding(db, f"T{i}") for i in range(5)]
    for h in holdings:
        db.add(WatchlistItem(holding_id=h.id))
    db.commit()
    attempts: dict = {}
    market = _Market(fail=True)
    first = warmup.warm_cold_holdings(db, market, _Rate(), attempts=attempts, now=1000.0, limit=3)
    assert len(first) == 3
    second = warmup.warm_cold_holdings(db, market, _Rate(), attempts=attempts, now=1001.0, limit=3)
    assert len(second) == 2  # the three just tried wait for the retry window
    third = warmup.warm_cold_holdings(db, market, _Rate(), attempts=attempts, now=1002.0, limit=3)
    assert third == []
    retry = Settings(_env_file=None).warmup_retry_seconds
    later = warmup.warm_cold_holdings(db, market, _Rate(), attempts=attempts, now=1000.0 + retry + 1, limit=3)
    assert len(later) == 3


# --- stored pages ----------------------------------------------------------


class _Payload(BaseModel):
    value: int
    snapshot_at: datetime | None = None


def test_stale_keys_lists_missing_changed_and_expired_pages():
    db = _db()
    _holding(db)
    snapshots.store(db, "fresh", _Payload(value=1))
    snapshots.store(db, "old", _Payload(value=1))
    db.get(ComputedSnapshot, "old").computed_at = datetime.now(timezone.utc) - timedelta(hours=100)
    db.commit()
    assert snapshots.stale_keys(db, ["fresh", "old", "missing"]) == ["old", "missing"]
    _holding(db, "NEW")  # an input changed
    assert snapshots.stale_keys(db, ["fresh"]) == ["fresh"]


def test_rebuild_stale_snapshots_rebuilds_only_what_is_stale(monkeypatch):
    db = _db()
    built: list[str] = []

    def jobs(_db, _m, _r, *, force_refresh):
        assert force_refresh is False  # never forces a vendor refresh
        return {
            name: (key, lambda name=name: (built.append(name), _Payload(value=1))[1])
            for name, key in (("risk", snapshots.RISK_KEY), ("board", snapshots.BOARD_KEY))
        }

    monkeypatch.setattr(snapshot_refresh, "snapshot_jobs", jobs)
    assert snapshot_refresh.rebuild_stale_snapshots(db, market_data_provider=None, risk_free_rate_provider=None) == ["risk", "board"]
    built.clear()
    assert snapshot_refresh.rebuild_stale_snapshots(db, market_data_provider=None, risk_free_rate_provider=None) == []
    assert built == []  # everything current: nothing rebuilt

    snapshots.invalidate(db)
    snapshot_refresh.rebuild_stale_snapshots(db, market_data_provider=None, risk_free_rate_provider=None)
    assert built == ["risk", "board"]


def test_a_page_that_fails_to_rebuild_does_not_block_the_others(monkeypatch):
    db = _db()

    def boom():
        raise RuntimeError("provider down")

    monkeypatch.setattr(
        snapshot_refresh, "snapshot_jobs",
        lambda *a, **k: {"risk": (snapshots.RISK_KEY, boom), "board": (snapshots.BOARD_KEY, lambda: _Payload(value=1))},
    )
    assert snapshot_refresh.rebuild_stale_snapshots(db, market_data_provider=None, risk_free_rate_provider=None) == ["board"]


def test_a_change_during_the_build_is_not_passed_off_as_current(monkeypatch):
    db = _db()

    def build():
        _holding(db, "ARRIVED-MID-BUILD")  # an input changes while the page is being built
        return _Payload(value=1)

    monkeypatch.setattr(snapshot_refresh, "snapshot_jobs", lambda *a, **k: {"risk": (snapshots.RISK_KEY, build)})
    snapshot_refresh.rebuild_stale_snapshots(db, market_data_provider=None, risk_free_rate_provider=None)
    assert snapshots.stale_keys(db, [snapshots.RISK_KEY]) == [snapshots.RISK_KEY]  # rebuilt on the next pass


# --- the worker passes -----------------------------------------------------


class _NamedStub:
    name = "stub"


def _worker(factory, **settings) -> AnalysisWorker:
    providers = WorkerProviders(
        llm=_NamedStub(), llm_fallback=None, market_data=_Market(), risk_free_rate=_Rate(), research=None,
        announcements=None, budget_guard=None,
    )
    return AnalysisWorker(
        session_factory=factory,
        settings=Settings(_env_file=None, worker_poll_seconds=0, worker_heartbeat_seconds=3600, **settings),
        providers=providers, worker_id="pc-1", hostname="PC", model_name="m",
    )


def _factory():
    engine = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
    Base.metadata.create_all(engine)
    return sessionmaker(bind=engine, autoflush=False, autocommit=False)


def test_worker_keepwarm_is_throttled_and_can_be_switched_off(monkeypatch):
    factory = _factory()
    calls = []
    monkeypatch.setattr(snapshot_refresh, "rebuild_stale_snapshots", lambda db, **k: calls.append(1) or [])

    worker = _worker(factory)
    worker.maybe_keep_snapshots_warm()
    worker.maybe_keep_snapshots_warm()  # inside the interval
    assert len(calls) == 1
    worker._last_keepwarm = time.monotonic() - 10_000
    worker.maybe_keep_snapshots_warm()
    assert len(calls) == 2

    off = _worker(factory, snapshot_keepwarm_enabled=False)
    off.maybe_keep_snapshots_warm()
    assert len(calls) == 2


def test_worker_keepwarm_never_raises(monkeypatch):
    factory = _factory()

    def boom(db, **k):
        raise RuntimeError("db gone")

    monkeypatch.setattr(snapshot_refresh, "rebuild_stale_snapshots", boom)
    _worker(factory).maybe_keep_snapshots_warm()  # logged, not raised


def test_worker_warms_cold_holdings_and_then_rebuilds_pages_at_once(monkeypatch):
    factory = _factory()
    with factory() as db:
        h = _holding(db, "NEW")
        db.add(WatchlistItem(holding_id=h.id))
        db.commit()
    rebuilt = []
    monkeypatch.setattr(snapshot_refresh, "rebuild_stale_snapshots", lambda db, **k: rebuilt.append(1) or [])

    worker = _worker(factory)
    worker._last_keepwarm = time.monotonic()  # just ran: would normally wait
    worker.maybe_warm_cold_holdings()
    with factory() as db:
        assert db.query(MarketObservation).count() == 1  # the first price is now stored
    worker.maybe_keep_snapshots_warm()  # new prices reset the throttle
    assert rebuilt == [1]


def _loop_worker(factory, monkeypatch, outcome):
    worker = _worker(factory)
    seen: list[str] = []
    monkeypatch.setattr(worker, "maybe_warm_cold_holdings", lambda: seen.append("warm"))
    monkeypatch.setattr(worker, "maybe_keep_snapshots_warm", lambda: seen.append("keep"))
    monkeypatch.setattr(worker, "maybe_check_tripwires", lambda: None)
    monkeypatch.setattr(worker, "maybe_refresh_snapshots", lambda: None)
    monkeypatch.setattr(worker, "run_once", lambda: outcome)
    return worker, seen


def test_idle_worker_loop_runs_both_passes(monkeypatch):
    worker, seen = _loop_worker(_factory(), monkeypatch, "idle")
    worker.run_forever(once=True)
    assert seen == ["warm", "keep"]


def test_a_busy_worker_loop_stays_out_of_the_way(monkeypatch):
    worker, seen = _loop_worker(_factory(), monkeypatch, RAN)  # a run just finished: more may be queued
    worker.run_forever(once=True)
    assert seen == []
