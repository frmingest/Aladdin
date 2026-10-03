"""GET /game/siege (game mode G13, 2026-10-03). A what-if over stored data:
no provider call, no write, demo mode wins, unknown stays unknown."""
from __future__ import annotations

import json
from datetime import datetime, timedelta, timezone
from decimal import Decimal

import pytest

from app.models.snapshot import ComputedSnapshot
from tests.integration.test_game_api import _seed

D = Decimal
NOW = datetime.now(timezone.utc)

# _seed's holdings: CASH.OL 400, GEAR.OL 300, BANK.OL 150, FUND 100, BARE.OL 50 (NOK).


def _beta(db, ticker, value, *, days_old=1):
    db.add(ComputedSnapshot(
        key=f"beta:{ticker}", payload=json.dumps({"beta": str(value)}), fingerprint="beta-v1",
        computed_at=NOW - timedelta(days=days_old),
    ))
    db.commit()


def _by(body):
    return {h["ticker"]: h for h in body["holdings"]}


def test_nothing_stored_is_unsurveyed_and_says_how_to_fix_it(client, db_session):
    _seed(db_session)
    body = client.get("/game/siege").json()
    assert body["level"] == "unsurveyed"
    assert body["portfolio_shock_pct"] is None and body["portfolio_loss_nok"] is None
    assert body["market_drop"] == "0.20"                       # the file's default
    assert all(not h["modelled"] and h["exposure"] == "unmodelled" for h in body["holdings"])
    joined = " ".join(body["notes"])
    assert "what-if, not a forecast" in joined and "Not modelled" in joined


def test_stored_betas_give_value_weighted_result(client, db_session):
    _seed(db_session)
    for ticker, beta in {"CASH.OL": "1.0", "GEAR.OL": "1.5", "BANK.OL": "1.0", "FUND": "0.5", "BARE.OL": "1.0"}.items():
        _beta(db_session, ticker, beta)
    body = client.get("/game/siege?market_drop=0.20").json()
    h = _by(body)
    assert D(h["CASH.OL"]["shock_pct"]) == D("-0.2")
    assert D(h["GEAR.OL"]["shock_pct"]) == D("-0.3")
    assert D(h["FUND"]["shock_pct"]) == D("-0.1")
    assert h["GEAR.OL"]["exposure"] == "exposed" and h["FUND"]["exposure"] == "sheltered"
    # losses: 400*.2 + 300*.3 + 150*.2 + 100*.1 + 50*.2 = 80 + 90 + 30 + 10 + 10 = 220 of 1000
    assert D(body["portfolio_loss_nok"]) == D(-220)
    assert D(body["portfolio_shock_pct"]) == D("-0.22")
    assert body["level"] == "calm" and D(body["coverage"]) == D("1")
    assert body["holdings"][0]["ticker"] == "CASH.OL" or body["holdings"][0]["ticker"] == "GEAR.OL"
    assert D(body["gathering_line"]) == D("-0.25") and D(body["besieged_line"]) == D("-0.40")
    assert body["drop_to_gathering"] is not None


def test_a_bigger_fall_turns_the_weather(client, db_session):
    _seed(db_session)
    for ticker in ("CASH.OL", "GEAR.OL", "BANK.OL", "FUND", "BARE.OL"):
        _beta(db_session, ticker, "1.0")
    assert client.get("/game/siege?market_drop=0.30").json()["level"] == "gathering"
    assert client.get("/game/siege?market_drop=0.45").json()["level"] == "besieged"


def test_missing_beta_is_left_out_and_named_never_defaulted(client, db_session):
    _seed(db_session)
    for ticker in ("CASH.OL", "GEAR.OL", "BANK.OL"):          # 850 of 1000 covered
        _beta(db_session, ticker, "1.0")
    body = client.get("/game/siege?market_drop=0.20").json()
    h = _by(body)
    assert h["FUND"]["modelled"] is False and h["FUND"]["shock_pct"] is None
    assert h["BARE.OL"]["beta"] is None
    assert D(body["coverage"]) == D("0.85")
    assert D(body["portfolio_shock_pct"]) == D("-0.2")
    assert body["counts"]["unmodelled"] == 2
    assert "FUND" in " ".join(body["notes"]) and "BARE.OL" in " ".join(body["notes"])


def test_low_beta_coverage_withholds_the_portfolio_number(client, db_session):
    _seed(db_session)
    _beta(db_session, "GEAR.OL", "1.0")                         # 300 of 1000
    body = client.get("/game/siege?market_drop=0.30").json()
    assert body["level"] == "unsurveyed" and body["portfolio_shock_pct"] is None
    assert D(body["coverage"]) == D("0.3")
    # a single holding's own what-if is still honest when the total is withheld
    gear = _by(body)["GEAR.OL"]
    assert gear["modelled"] and D(gear["shock_pct"]) == D("-0.3")


@pytest.mark.parametrize("value", ["0.01", "0.04", "0.61", "1", "-0.2"])
def test_market_drop_outside_the_file_range_is_rejected(client, db_session, value):
    _seed(db_session)
    assert client.get(f"/game/siege?market_drop={value}").status_code == 422


@pytest.mark.parametrize("value", ["0.05", "0.60"])
def test_range_ends_are_accepted(client, db_session, value):
    _seed(db_session)
    assert client.get(f"/game/siege?market_drop={value}").status_code == 200


def test_non_numeric_market_drop_is_rejected(client, db_session):
    assert client.get("/game/siege?market_drop=abc").status_code == 422


def test_it_is_read_only_and_makes_no_vendor_call(client, db_session, monkeypatch):
    _seed(db_session)
    _beta(db_session, "CASH.OL", "1.0", days_old=400)           # very old beta: still used, never refreshed
    before = {r.key: (r.payload, r.computed_at, r.fingerprint) for r in db_session.query(ComputedSnapshot)}

    def boom(*a, **k):
        raise AssertionError("the Siege Simulator must not call a market-data provider")

    monkeypatch.setattr("app.providers.factory.get_market_data_provider", boom)
    body = client.get("/game/siege").json()
    db_session.expire_all()
    after = {r.key: (r.payload, r.computed_at, r.fingerprint) for r in db_session.query(ComputedSnapshot)}
    assert before == after
    assert _by(body)["CASH.OL"]["modelled"] is True and body["oldest_beta_at"] is not None


def test_demo_mode_shows_invented_data_and_never_real_betas(client, db_session):
    _seed(db_session)
    for ticker in ("CASH.OL", "GEAR.OL", "BANK.OL", "FUND", "BARE.OL"):
        _beta(db_session, ticker, "9.9")                        # real-looking data must not leak
    assert client.put("/settings/demo-mode", json={"enabled": True}).status_code == 200
    body = client.get("/game/siege?market_drop=0.30").json()
    assert body["demo"] is True
    tickers = set(_by(body))
    assert not tickers & {"CASH.OL", "GEAR.OL", "BANK.OL", "FUND", "BARE.OL"}
    assert all(h["beta"] is None or D(h["beta"]) < 3 for h in body["holdings"])
    assert _by(body)["V"]["modelled"] is False                  # the demo's deliberate gap
    assert body["level"] in {"calm", "gathering", "besieged"}
