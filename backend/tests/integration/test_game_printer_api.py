"""GET /game/printer and /game/printer/ledger (game mode, Royal Mint, 2026-10-20). A scenario over
stored data: no provider call, no write, unknown stays unknown, Low means direction only."""
from __future__ import annotations

import json
from datetime import datetime, timedelta, timezone

from app.models.snapshot import ComputedSnapshot
from tests.integration.test_game_api import _seed

NOW = datetime.now(timezone.utc)


def _beta(db, ticker, value):
    db.add(ComputedSnapshot(
        key=f"beta:{ticker}", payload=json.dumps({"beta": str(value)}), fingerprint="beta-v1",
        computed_at=NOW - timedelta(days=1),
    ))
    db.commit()


def test_ledger_lists_every_lever_cell_and_source(client):
    body = client.get("/game/printer/ledger").json()
    assert body["version"] == "v1" and "not a trading signal" in body["banner"]
    keys = {lv["key"] for lv in body["levers"]}
    assert keys == {"toll_gate", "great_press", "great_melt", "coin_rain", "harbour_guard"}
    cells = body["effects"]["toll_gate"]["default"]
    assert len(cells) == 12  # 6 channels x 2 horizons
    assert all(c["source"] in {s["key"] for s in body["sources"]} for c in cells)
    assert set(body["effects"]["harbour_guard"]) == {"sterilised", "unsterilised"}


def test_no_pull_returns_zero_channels_and_modelled_holdings(client, db_session):
    _seed(db_session)
    body = client.get("/game/printer").json()
    assert body["horizon"] == 1 and body["pulls"] == []
    assert all(c["range"]["base"] == "0" for c in body["channels"])
    assert body["wild"] is False and body["warnings"] == []


def test_stored_betas_drive_a_direction_and_never_a_low_amount(client, db_session):
    _seed(db_session)
    for ticker in ("CASH.OL", "GEAR.OL", "BANK.OL", "FUND", "BARE.OL"):
        _beta(db_session, ticker, "1.0")
    body = client.get("/game/printer?pull=toll_gate:1").json()
    assert body["pulls"] == [{"lever": "toll_gate", "size": "1", "variant": "default"}]
    modelled = [h for h in body["holdings"] if h["status"] == "modelled"]
    assert modelled
    for h in modelled:
        assert h["pct"] is not None
        if h["confidence"] == "low":
            assert h["show_amount"] is False and h["nok"] is None and h["real_nok"] is None
    if body["portfolio_confidence"] == "low":
        assert body["show_portfolio_amount"] is False and body["portfolio_nok"] is None


def test_holdings_without_a_beta_are_listed_not_modelled_last(client, db_session):
    _seed(db_session)
    _beta(db_session, "CASH.OL", "1.0")
    body = client.get("/game/printer?pull=great_press:2&horizon=3").json()
    statuses = [h["status"] for h in body["holdings"]]
    assert statuses[0] == "modelled" and statuses[-1] == "not_modelled"
    assert any(h["reason"] for h in body["holdings"] if h["status"] == "not_modelled")
    assert body["horizon"] == 3


def test_bad_requests_say_why(client):
    assert client.get("/game/printer?pull=nope:1").status_code == 422
    assert client.get("/game/printer?pull=toll_gate:99").status_code == 422
    assert client.get("/game/printer?pull=toll_gate").status_code == 422
    assert client.get("/game/printer?pull=toll_gate:abc").status_code == 422
    assert client.get("/game/printer?pull=toll_gate:1&pull=toll_gate:2").status_code == 422
    assert client.get("/game/printer?horizon=2").status_code == 422
    r = client.get("/game/printer?pull=harbour_guard:1:default")
    assert r.status_code == 422 and "variant" in r.json()["detail"]


def test_harbour_guard_defaults_to_the_sterilised_variant(client):
    body = client.get("/game/printer?pull=harbour_guard:1").json()
    assert body["pulls"][0]["variant"] == "sterilised"


def test_demo_mode_uses_the_demo_book(client, monkeypatch):
    from app.api import game as game_api

    monkeypatch.setattr(game_api, "is_demo_mode", lambda db: True)
    body = client.get("/game/printer?pull=toll_gate:1").json()
    assert body["demo"] is True and body["holdings"]
