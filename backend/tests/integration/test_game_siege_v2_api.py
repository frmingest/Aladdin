"""GET /game/siege with the v2 scenarios (2026-10-07): betas measured from the
holdings' own stored price history against OSEBX; Yahoo's beta only as a marked
fallback; nothing defaulted; still database-only."""
from __future__ import annotations

import json
from datetime import date, datetime, timedelta, timezone
from decimal import Decimal

from app.domain.game_mapping.siege_scenarios_v1 import (
    SIEGE_SCENARIOS_V1,
    get_siege_scenarios,
)
from app.models.risk import PriceHistoryObservation
from app.models.snapshot import ComputedSnapshot
from app.services.game.siege_view import stored_sensitivity_lookup
from tests.integration.test_game_api import _seed

D = Decimal
NOW = datetime.now(timezone.utc)
PATTERN = [D("-0.02"), D("0.01"), D("-0.01"), D("0.015"), D("-0.03"), D("0.005"), D("-0.005"), D("0.02")]


def _bench_returns(n):
    return [PATTERN[i % len(PATTERN)] for i in range(n)]


def _history(db, ticker, returns, *, currency="NOK", start=None):
    """Store closes (one more than `returns`) on the last business days up to yesterday."""
    start = D("100") if start is None else start
    days: list[date] = []
    d = NOW.date() - timedelta(days=1)
    while len(days) < len(returns) + 1:
        if d.weekday() < 5:
            days.append(d)
        d -= timedelta(days=1)
    days.reverse()
    price = start
    for i, day in enumerate(days):
        if i:
            price = price * (1 + returns[i - 1])
        db.add(PriceHistoryObservation(
            ticker=ticker, observed_on=day, close=price, currency=currency, provider="test", fetched_at=NOW,
        ))
    db.commit()


def _beta(db, ticker, value):
    db.add(ComputedSnapshot(
        key=f"beta:{ticker}", payload=json.dumps({"beta": str(value)}), fingerprint="beta-v1",
        computed_at=NOW - timedelta(days=1),
    ))
    db.commit()


def _by(body):
    return {h["ticker"]: h for h in body["holdings"]}


def test_a_fund_with_no_vendor_beta_is_modelled_from_its_own_prices(client, db_session):
    _seed(db_session)
    br = _bench_returns(200)
    _history(db_session, "OSEBX.OL", br)
    _history(db_session, "FUND", [r * D("0.5") for r in br])
    body = client.get("/game/siege?market_drop=0.20").json()
    fund = _by(body)["FUND"]
    assert fund["modelled"] and fund["method"] == "price_history"
    assert D(fund["beta"]) == D("0.5") and D(fund["shock_pct"]) == D("-0.1")
    assert fund["observations"] >= 40 and D(fund["r_squared"]) == D("1")
    assert fund["caution"] is None
    assert body["benchmark_ticker"] == "OSEBX.OL" and body["scenarios_version"] == "v2"
    assert any("OSEBX.OL" in n and "days the benchmark fell" in n for n in body["notes"])


def test_price_history_wins_over_the_vendor_beta_so_every_row_uses_one_benchmark(client, db_session):
    _seed(db_session)
    br = _bench_returns(200)
    _history(db_session, "OSEBX.OL", br)
    _history(db_session, "CASH.OL", [r * D("1.5") for r in br])
    _beta(db_session, "CASH.OL", "0.2")                          # Yahoo's figure, measured against another market
    cash = _by(client.get("/game/siege").json())["CASH.OL"]
    assert cash["method"] == "price_history" and D(cash["beta"]) == D("1.5")


def test_a_holding_that_does_not_fall_with_the_market_shows_a_gain_or_nothing(client, db_session):
    _seed(db_session)
    br = _bench_returns(200)
    _history(db_session, "OSEBX.OL", br)
    _history(db_session, "BANK.OL", [r * D("-0.3") for r in br])
    bank = _by(client.get("/game/siege?market_drop=0.20").json())["BANK.OL"]
    assert D(bank["shock_pct"]) == D("0.06") and bank["exposure"] == "sheltered"


def test_short_history_falls_back_to_the_vendor_beta_and_says_so(client, db_session):
    _seed(db_session)
    br = _bench_returns(200)
    _history(db_session, "OSEBX.OL", br)
    _history(db_session, "GEAR.OL", [r for r in br[:30]])      # 30 days: too short
    _beta(db_session, "GEAR.OL", "1.2")
    gear = _by(client.get("/game/siege").json())["GEAR.OL"]
    assert gear["method"] == "vendor_beta" and D(gear["beta"]) == D("1.2")
    assert "Price history could not be used" in gear["caution"] and "only 30" in gear["caution"]


def test_no_history_and_no_vendor_beta_is_not_modelled_with_the_reason(client, db_session):
    _seed(db_session)
    _history(db_session, "OSEBX.OL", _bench_returns(200))
    body = client.get("/game/siege").json()
    fund = _by(body)["FUND"]
    assert fund["modelled"] is False and fund["beta"] is None and fund["method"] is None
    assert "no price history stored for this holding" in fund["reason"]
    assert "FUND" in " ".join(body["notes"])


def test_missing_benchmark_history_is_named(client, db_session):
    _seed(db_session)
    _history(db_session, "FUND", _bench_returns(200))
    fund = _by(client.get("/game/siege").json())["FUND"]
    assert fund["modelled"] is False and "benchmark OSEBX.OL" in fund["reason"]


def test_foreign_prices_are_converted_to_nok_before_measuring(client, db_session):
    _seed(db_session)
    br = _bench_returns(200)
    _history(db_session, "OSEBX.OL", br)
    # a euro price that never moves; the krone rate moves against the benchmark
    _history(db_session, "FUND", [D(0)] * 200, currency="EUR", start=D("50"))
    _history(db_session, "EURNOK=X", [r * D("-0.4") for r in br], start=D("11"))
    fund = _by(client.get("/game/siege").json())["FUND"]
    assert fund["method"] == "price_history" and D(fund["beta"]) == D("-0.4")


def test_foreign_prices_without_fx_history_are_not_used(client, db_session):
    _seed(db_session)
    br = _bench_returns(200)
    _history(db_session, "OSEBX.OL", br)
    _history(db_session, "FUND", br, currency="EUR")
    fund = _by(client.get("/game/siege").json())["FUND"]
    assert fund["modelled"] is False and "EUR/NOK" in fund["reason"]


def test_a_flat_price_carries_the_slow_price_caution(client, db_session):
    _seed(db_session)
    _history(db_session, "OSEBX.OL", _bench_returns(200))
    _history(db_session, "FUND", [D(0)] * 200)
    fund = _by(client.get("/game/siege").json())["FUND"]
    assert fund["modelled"] and D(fund["beta"]) == D("0")
    assert "did not change" in fund["caution"]


def test_the_page_makes_no_vendor_call_and_writes_nothing(client, db_session, monkeypatch):
    _seed(db_session)
    br = _bench_returns(200)
    _history(db_session, "OSEBX.OL", br)
    _history(db_session, "FUND", br)

    def boom(*a, **k):
        raise AssertionError("the Siege Simulator must not call a market-data provider")

    monkeypatch.setattr("app.providers.factory.get_market_data_provider", boom)
    before = db_session.query(PriceHistoryObservation).count()
    assert client.get("/game/siege").status_code == 200
    db_session.expire_all()
    assert db_session.query(PriceHistoryObservation).count() == before


def test_v1_scenarios_still_read_the_vendor_beta_only(db_session):
    _seed(db_session)
    br = _bench_returns(200)
    _history(db_session, "OSEBX.OL", br)
    _history(db_session, "FUND", [r * D("0.5") for r in br])
    lookup = stored_sensitivity_lookup(db_session, SIEGE_SCENARIOS_V1)
    assert lookup("FUND").beta is None
    _beta(db_session, "FUND", "0.9")
    assert lookup("FUND").beta == D("0.9") and lookup("FUND").method == "vendor_beta"
    assert get_siege_scenarios("v2").benchmark_ticker == "OSEBX.OL"
