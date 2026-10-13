"""GET /game/siege/backtest (C1, 2026-10-13): database only, honest about what cannot be tested."""
from __future__ import annotations

from decimal import Decimal

from tests.integration.test_game_api import _seed
from tests.integration.test_game_siege_v2_api import _history

D = Decimal
UP = [D("-0.01"), D("0.02"), D("-0.005"), D("0.015")]


def _bench(n=230):
    return [UP[i % 4] for i in range(n)] + [D("-0.02")] * 10 + [D("0.01")] * 20


def test_backtest_compares_prediction_with_what_the_holding_did(client, db_session):
    _seed(db_session)
    br = _bench()
    _history(db_session, "OSEBX.OL", br)
    _history(db_session, "FUND", [r * D("0.5") for r in br])
    _history(db_session, "CASH.OL", [r * D("1.0") for r in br])
    body = client.get("/game/siege/backtest").json()
    assert body["status"] == "ok" and body["benchmark_ticker"] == "OSEBX.OL"
    assert body["backtest_version"] == "v1" and body["scenarios_version"] == "v3"
    assert D(body["episode"]["fall"]) < D("-0.15") and body["episode"]["significant"] is True
    rows = {h["ticker"]: h for h in body["holdings"]}
    assert rows["FUND"]["tested"] and rows["FUND"]["verdict"] == "close"
    assert rows["CASH.OL"]["tested"] and D(rows["CASH.OL"]["beta"]) == D("1.0")
    assert not rows["GEAR.OL"]["tested"] and rows["GEAR.OL"]["reason"] == "no price history stored for this holding"
    assert body["tested_count"] == 2 and body["total_count"] == 5
    assert body["book"] is not None and body["book"]["holdings_used"] == 2
    assert any("one past fall" in n for n in body["notes"])


def test_backtest_without_benchmark_history_says_so(client, db_session):
    _seed(db_session)
    body = client.get("/game/siege/backtest").json()
    assert body["status"] == "no_history" and "OSEBX.OL" in body["status_reason"]
    assert body["holdings"] == [] and body["episode"] is None


def test_backtest_is_read_only_and_demo_has_no_history(client, db_session):
    assert client.put("/settings/demo-mode", json={"enabled": True}).status_code == 200
    body = client.get("/game/siege/backtest").json()
    assert body["status"] == "demo" and body["demo"] is True and body["holdings"] == []
