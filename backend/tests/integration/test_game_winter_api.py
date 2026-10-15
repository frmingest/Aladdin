"""GET /game/winter-rehearsal (E2, 2026-10-15): database only, honest about fog and about quiet years."""
from __future__ import annotations

from decimal import Decimal

from tests.integration.test_game_api import _seed
from tests.integration.test_game_siege_v2_api import _history

D = Decimal


def _fall(n=230):
    return [D("0.004")] * n + [D("-0.02")] * 10 + [D("0.01")] * 20


def test_replays_the_worst_fall_and_names_the_holdings_it_could_not_cover(client, db_session):
    _seed(db_session)
    r = _fall()
    _history(db_session, "CASH.OL", r)
    _history(db_session, "FUND", [x * D("0.5") for x in r])
    body = client.get("/game/winter-rehearsal").json()
    assert body["status"] == "ok" and body["version"] == "v1" and body["demo"] is False
    cov = body["coverage"]
    assert cov["covered_count"] == 2 and cov["total_count"] == 5
    rows = {h["name"]: h for h in cov["holdings"]}
    assert rows["Cash Rich"]["covered"] and not rows["Geared"]["covered"]
    assert rows["Geared"]["reason"] == "no price history stored for this holding"
    win = body["window"]
    assert D(win["fall"]) < D("-0.10") and win["trading_days"] == len(win["points"])
    assert win["points"][0]["days_under_water"] == 0 and D(win["points"][0]["change_nok"]) == 0
    assert win["points"][-1]["days_under_water"] == len(win["points"]) - 1
    assert D(win["points"][-1]["change_nok"]) < 0
    assert any("3 of 5" in n for n in body["notes"]) or any("had no stored prices" in n for n in body["notes"])


def test_a_quiet_history_says_no_real_winter(client, db_session):
    _seed(db_session)
    r = [D("0.004")] * 250
    _history(db_session, "CASH.OL", r)
    _history(db_session, "FUND", r)
    body = client.get("/game/winter-rehearsal").json()
    assert body["status"] == "no_winter" and body["window"] is None
    assert "no real fall" in body["status_reason"]


def test_no_stored_prices_gives_fog_not_a_guess(client, db_session):
    _seed(db_session)
    body = client.get("/game/winter-rehearsal").json()
    assert body["status"] == "no_history" and body["window"] is None
    assert body["coverage"]["covered_count"] == 0


def test_empty_database_is_labelled_and_demo_has_no_history(client, db_session):
    assert client.get("/game/winter-rehearsal").json()["status"] == "no_history"
    assert client.put("/settings/demo-mode", json={"enabled": True}).status_code == 200
    body = client.get("/game/winter-rehearsal").json()
    assert body["status"] == "demo" and body["demo"] is True and body["window"] is None


def test_winter_rehearsal_is_read_only(client, db_session):
    _seed(db_session)
    assert client.post("/game/winter-rehearsal").status_code == 405
    assert client.put("/game/winter-rehearsal", json={}).status_code == 405
