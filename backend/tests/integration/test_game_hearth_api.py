"""GET /game/hearth and /game/winter-order (E3, 2026-10-16)."""
from __future__ import annotations

from datetime import date, datetime, timedelta, timezone

from app.models import Holding
from app.models.journal import DecisionJournalEntry
from app.models.thesis import ThesisTripwire
from app.services.game import history
from app.services.game.state import get_game_state
from tests.integration.test_game_api import _seed

NOW = datetime.now(timezone.utc)


def _store(db, level, day):
    state = get_game_state(db, "v1", now=NOW)
    siege = state.siege.model_copy(update={"level": level}) if state.siege is not None else None
    history.store_frame(db, state.model_copy(update={"siege": siege}), day=day, now=NOW)


def test_the_winter_order_is_saved_append_only_and_the_newest_wins(client, db_session):
    assert client.get("/game/winter-order").json()["text"] is None
    assert client.put("/game/winter-order", json={"text": "  Read the thesis   first. "}).json()["text"] == "Read the thesis first."
    assert client.put("/game/winter-order", json={"text": "Wait a week."}).json()["text"] == "Wait a week."
    assert client.get("/game/winter-order").json()["text"] == "Wait a week."
    assert client.put("/game/winter-order", json={"text": "x" * 201}).status_code == 422
    assert client.put("/game/winter-order", json={"text": "   "}).json()["text"] is None
    assert client.get("/game/winter-order").json()["text"] is None


def test_the_order_is_not_a_journal_entry(client, db_session):
    client.put("/game/winter-order", json={"text": "Hold."})
    assert db_session.query(DecisionJournalEntry).count() == 0


def test_the_door_is_shut_with_nothing_stored(client, db_session):
    _seed(db_session)
    body = client.get("/game/hearth").json()
    assert body["state"] == "shut" and body["version"] == "v1" and body["demo"] is False


def test_a_storm_opens_the_hearth_with_invalidation_lines_beside_live_tripwires(client, db_session):
    _seed(db_session)
    today = NOW.date()
    _store(db_session, "calm", today - timedelta(days=1))
    _store(db_session, "besieged", today)
    holding = db_session.query(Holding).filter(Holding.ticker == "GEAR.OL").one()
    db_session.add(DecisionJournalEntry(
        holding_id=holding.id, ticker="GEAR.OL", company_name="Geared", action="buy", decided_on=date(2026, 1, 5),
        thesis="Debt falls.", invalidation="If debt does not fall by spring I sell.",
    ))
    db_session.add(ThesisTripwire(holding_id=holding.id, metric="net_debt_to_ebitda", operator="above",
                                  threshold=2, label="Debt above 2x", active=True))
    db_session.commit()
    client.put("/game/winter-order", json={"text": "Do nothing for a week."})
    body = client.get("/game/hearth").json()
    assert body["state"] == "open" and body["weather"] == "besieged"
    assert any(c["text"].startswith("The weather turned") for c in body["changed"])
    lines = [i for i in body["invalidations"] if i["name"] == "Geared"]
    assert lines and lines[0]["line"] == "If debt does not fall by spring I sell."
    assert lines[0]["tripwires"][0]["metric"] == "net_debt_to_ebitda"
    assert body["order"]["text"] == "Do nothing for a week."
    assert body["record"]["status"] in ("no_history", "no_winter", "ok")


def test_demo_mode_shows_invented_data_and_refuses_to_save_the_order(client, db_session):
    _seed(db_session)
    assert client.put("/settings/demo-mode", json={"enabled": True}).status_code == 200
    assert client.get("/game/hearth").json()["demo"] is True
    assert client.put("/game/winter-order", json={"text": "x"}).status_code in (403, 409)
