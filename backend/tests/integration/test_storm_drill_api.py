"""Integration tests for /game/drills (3D courtyard quest 3, Storm Drill)."""
from __future__ import annotations

from decimal import Decimal


def test_empty_then_create_and_list_newest_first(client):
    body = client.get("/game/drills").json()
    assert body == {"drills": [], "demo": False}

    r = client.post("/game/drills", json={"market_drop": "0.30", "plan": "  Hold the cash, add to the wide-moat names only.  "})
    assert r.status_code == 201, r.text
    first = r.json()
    assert first["plan"] == "Hold the cash, add to the wide-moat names only."
    assert Decimal(first["market_drop"]) == Decimal("0.30")
    assert first["scenarios_version"]

    client.post("/game/drills", json={"market_drop": "0.15", "plan": "Do nothing for a week."})
    drills = client.get("/game/drills").json()["drills"]
    assert [Decimal(d["market_drop"]) for d in drills] == [Decimal("0.15"), Decimal("0.30")]


def test_validation(client):
    ok = {"market_drop": "0.30", "plan": "x"}
    assert client.post("/game/drills", json={**ok, "plan": "   "}).status_code == 422
    assert client.post("/game/drills", json={**ok, "plan": ""}).status_code == 422
    assert client.post("/game/drills", json={**ok, "market_drop": "0"}).status_code == 422
    assert client.post("/game/drills", json={**ok, "market_drop": "1"}).status_code == 422
    # Inside 0..1 but outside the siege scenarios' range (0.05 to 0.60).
    assert client.post("/game/drills", json={**ok, "market_drop": "0.01"}).status_code == 422
    assert client.post("/game/drills", json={**ok, "market_drop": "0.90"}).status_code == 422
    assert client.get("/game/drills").json()["drills"] == []


def test_a_drill_does_not_touch_the_journal(client):
    client.post("/game/drills", json={"market_drop": "0.30", "plan": "Wait."})
    assert client.get("/journal").json()["entries"] == []


def test_demo_mode_shows_none_and_refuses_writes(client):
    assert client.put("/settings/demo-mode", json={"enabled": True}).status_code == 200
    body = client.get("/game/drills").json()
    assert body == {"drills": [], "demo": True}
    assert client.post("/game/drills", json={"market_drop": "0.30", "plan": "Wait."}).status_code == 403
