"""The Hourglass (#414) over the real routes and a database: the list of stored days and one day's frame.
Read-only, a missing day is a gap (404, never filled in), the sample fortress keeps no history."""
from __future__ import annotations

from datetime import date, datetime, timedelta, timezone

from app.models.snapshot import ComputedSnapshot
from app.services.game import history
from app.services.game.state import get_game_state
from tests.integration.test_game_api import _seed

NOW = datetime.now(timezone.utc)


def _store(db, day: date):
    state = get_game_state(db, "v1", now=NOW)
    assert history.store_frame(db, state, day=day, now=NOW) is True


def test_history_lists_only_the_stored_days_oldest_first(client, db_session):
    _seed(db_session)
    assert client.get("/game/history").json() == {"demo": False, "days": []}
    d1, d3 = date(2026, 11, 1), date(2026, 11, 3)
    _store(db_session, d3)
    _store(db_session, d1)
    body = client.get("/game/history").json()
    # The 2nd has no frame: it is a gap, not listed and not filled in.
    assert body == {"demo": False, "days": [d1.isoformat(), d3.isoformat()]}


def test_one_day_returns_that_days_frame_as_stored(client, db_session):
    _seed(db_session)
    day = date(2026, 11, 3)
    _store(db_session, day)
    body = client.get(f"/game/history/{day.isoformat()}").json()
    assert body["day"] == day.isoformat()
    assert body["state"]["towers"], "the stored towers come back"
    stored = history.load_frame(db_session, day)[1]
    assert body["state"]["total_value_nok"] == str(stored.total_value_nok)


def test_a_day_with_no_frame_is_404_never_a_neighbour(client, db_session):
    _seed(db_session)
    _store(db_session, date(2026, 11, 1))
    res = client.get("/game/history/2026-11-02")
    assert res.status_code == 404
    assert client.get("/game/history/not-a-date").status_code == 422


def test_an_unreadable_frame_is_a_gap(client, db_session):
    _seed(db_session)
    day = date(2026, 11, 1)
    _store(db_session, day)
    row = db_session.get(ComputedSnapshot, history.frame_key(day))
    row.payload = '{"schema": "moved on"}'
    db_session.commit()
    assert client.get(f"/game/history/{day.isoformat()}").status_code == 404


def test_the_sample_fortress_keeps_no_history(client, db_session):
    _seed(db_session)
    day = date(2026, 11, 1)
    _store(db_session, day)
    assert client.put("/settings/demo-mode", json={"enabled": True}).status_code == 200
    assert client.get("/game/history").json() == {"demo": True, "days": []}
    assert client.get(f"/game/history/{day.isoformat()}").status_code == 404


def test_the_reads_write_nothing(client, db_session):
    _seed(db_session)
    day = date(2026, 11, 1)
    _store(db_session, day)
    before = db_session.get(ComputedSnapshot, history.frame_key(day)).computed_at
    keys = db_session.query(ComputedSnapshot.key).count()
    client.get("/game/history")
    client.get(f"/game/history/{day.isoformat()}")
    client.get(f"/game/history/{(day + timedelta(days=1)).isoformat()}")
    db_session.expire_all()
    assert db_session.query(ComputedSnapshot.key).count() == keys
    assert db_session.get(ComputedSnapshot, history.frame_key(day)).computed_at == before
