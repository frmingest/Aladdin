"""Siege Simulator v4 (2026-10-14): the reader may measure against the World stand-in
(ACWI, listed in USD and converted to NOK) instead of Oslo (OSEBX). OSEBX stays the
default; the page stays database-only; nothing is blended or defaulted."""
from __future__ import annotations

from decimal import Decimal

import pytest

from app.domain.game_mapping.siege_scenarios_v1 import get_siege_scenarios
from app.services.risk.sensitivity_history import wanted_tickers
from tests.integration.test_game_api import _seed
from tests.integration.test_game_siege_v2_api import _bench_returns, _by, _history

D = Decimal


FUND_SCALE = D("0.5")
ACWI_SCALE = D("2")


def _world_setup(db, *, osebx=True, acwi=True, usdnok=True, fund_scale=FUND_SCALE, acwi_scale=ACWI_SCALE):
    """A fund that moves at `fund_scale` x Oslo; the world fund moves at `acwi_scale` x Oslo; USD/NOK is flat."""
    br = _bench_returns(200)
    if osebx:
        _history(db, "OSEBX.OL", br)
    if acwi:
        _history(db, "ACWI", [r * acwi_scale for r in br], currency="USD", start=D("100"))
    if usdnok:
        _history(db, "USDNOK=X", [D(0)] * 200, currency="NOK", start=D("10"))
    _history(db, "FUND", [r * fund_scale for r in br])


def test_oslo_is_the_default_and_the_choice_is_offered(client, db_session):
    _seed(db_session)
    _world_setup(db_session)
    body = client.get("/game/siege").json()
    assert body["benchmark_ticker"] == "OSEBX.OL" and body["benchmark_key"] == "local"
    assert [o["key"] for o in body["benchmark_options"]] == ["local", "global"]
    assert {o["ticker"] for o in body["benchmark_options"]} == {"OSEBX.OL", "ACWI"}
    assert "OSEBX" in body["benchmark_label"]


def test_world_measures_against_the_converted_fund_not_oslo(client, db_session):
    _seed(db_session)
    _world_setup(db_session)
    local = _by(client.get("/game/siege?market_drop=0.20&benchmark=local").json())["FUND"]
    world_body = client.get("/game/siege?market_drop=0.20&benchmark=global").json()
    world = _by(world_body)["FUND"]
    assert D(local["beta"]) == D("0.5")
    assert D(world["beta"]) == D("0.25")          # same fund, a yardstick that falls twice as hard
    assert world["method"] == "price_history"
    assert world_body["benchmark_ticker"] == "ACWI" and world_body["benchmark_key"] == "global"
    assert any("stand" in n and "not the index itself" in n for n in world_body["notes"])
    assert any("back-test" in n and "Oslo" in n for n in world_body["notes"])


def test_world_does_not_need_oslo_history(client, db_session):
    _seed(db_session)
    _world_setup(db_session, osebx=False)
    world = _by(client.get("/game/siege?benchmark=global").json())["FUND"]
    assert world["modelled"] and D(world["beta"]) == D("0.25")
    local = _by(client.get("/game/siege?benchmark=local").json())["FUND"]
    assert local["modelled"] is False and "benchmark OSEBX.OL" in local["reason"]


def test_world_yardstick_is_converted_to_nok_so_the_krone_moves_count(client, db_session):
    _seed(db_session)
    br = _bench_returns(200)
    # the world fund never moves in dollars; the dollar moves against the krone with Oslo's falls
    _history(db_session, "ACWI", [D(0)] * 200, currency="USD", start=D("100"))
    _history(db_session, "USDNOK=X", [r * D("-1") for r in br], currency="NOK", start=D("10"))
    _history(db_session, "FUND", [r * D("-0.5") for r in br])    # a holding that moves against that
    fund = _by(client.get("/game/siege?benchmark=global").json())["FUND"]
    assert fund["modelled"] and D(fund["beta"]) == D("0.5")


def test_world_without_usdnok_history_names_the_reason(client, db_session):
    _seed(db_session)
    _world_setup(db_session, usdnok=False)
    fund = _by(client.get("/game/siege?benchmark=global").json())["FUND"]
    assert fund["modelled"] is False
    assert "USD/NOK" in fund["reason"] and "ACWI" in fund["reason"]


def test_world_without_its_own_history_names_the_benchmark(client, db_session):
    _seed(db_session)
    _world_setup(db_session, acwi=False)
    fund = _by(client.get("/game/siege?benchmark=global").json())["FUND"]
    assert fund["modelled"] is False and "benchmark ACWI" in fund["reason"]


def test_unknown_benchmark_is_refused(client, db_session):
    _seed(db_session)
    assert client.get("/game/siege?benchmark=moon").status_code == 422


def test_worker_stores_the_world_fund_and_the_dollar_rate(db_session):
    _seed(db_session)
    wanted = wanted_tickers(db_session, get_siege_scenarios("v4"))
    assert "OSEBX.OL" in wanted and "ACWI" in wanted and "USDNOK=X" in wanted
    assert wanted["ACWI"] == "USD"


def test_older_versions_have_no_choice_and_no_world_option():
    v3 = get_siege_scenarios("v3")
    assert v3.with_benchmark("local") is v3
    with pytest.raises(ValueError):
        v3.with_benchmark("global")
    with pytest.raises(ValueError):
        get_siege_scenarios("v4").with_benchmark("moon")


def test_switching_back_to_oslo_restores_the_original_yardstick():
    v4 = get_siege_scenarios("v4")
    world = v4.with_benchmark("global")
    assert world.benchmark_ticker == "ACWI" and world.benchmark_key == "global"
    back = world.with_benchmark("local")
    assert back.benchmark_ticker == "OSEBX.OL" and back.benchmark_key == "local"
    assert back.min_observations == v4.min_observations and back.min_down_days == v4.min_down_days
