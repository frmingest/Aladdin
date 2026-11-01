"""GET /game/standing over the real route and a database (Standing 1, 2026-10-31).
Read-only, demo mode wins, unknown stays unknown, the level follows the stored facts."""
from __future__ import annotations

from datetime import date
from decimal import Decimal

import pytest

from app.models import Holding
from app.models.journal import DecisionJournalEntry
from app.models.thesis import ThesisTripwire
from tests.integration.test_game_api import _seed

D = Decimal


def _entry(db, ticker, *, thesis="Cheap for a reason", invalidation="Margins fall"):
    h = db.query(Holding).filter_by(ticker=ticker).one()
    db.add(DecisionJournalEntry(
        holding_id=h.id, ticker=ticker, company_name=h.name, action="buy", decided_on=date(2026, 1, 5),
        thesis=thesis, invalidation=invalidation,
    ))


def _gates(body):
    return {g["level"]: g for g in body["gates"]}


def test_empty_database_is_level_zero_with_a_first_step(client):
    body = client.get("/game/standing").json()
    assert body["level"] == 0 and body["demo"] is False and body["max_level"] == 5
    assert body["next_step"] == "Bring in your holdings."


def test_a_real_fortress_with_fog_is_level_one(client, db_session):
    _seed(db_session)  # BARE.OL has no filings: its wall is unsurveyed
    body = client.get("/game/standing").json()
    assert body["level"] == 1 and body["title"] == "Bare Ground"
    assert _gates(body)[2]["met"] is False and body["gaps"] == []
    assert body["next_step"].startswith("Lift the fog")


def test_a_named_gap_lets_level_two_stand_and_is_listed(client, db_session):
    _seed(db_session)
    db_session.query(Holding).filter_by(ticker="BARE.OL").one().ticker = "JAREN.OL"
    db_session.commit()
    body = client.get("/game/standing").json()
    assert body["level"] == 2
    assert body["gaps"] == [{"ticker": "JAREN.OL", "label": "no tagged filing"}]
    assert _gates(body)[2]["fact"] == "5 of 5 surveyed"


def test_level_three_needs_every_reason_a_wrong_if_and_an_active_wire(client, db_session, standing_v1):
    _seed(db_session)
    db_session.query(Holding).filter_by(ticker="BARE.OL").one().ticker = "JAREN.OL"
    db_session.commit()
    for ticker in ("CASH.OL", "GEAR.OL", "BANK.OL", "FUND", "JAREN.OL"):
        _entry(db_session, ticker)
    db_session.commit()
    assert client.get("/game/standing").json()["level"] == 2  # no wire armed yet

    cash = db_session.query(Holding).filter_by(ticker="CASH.OL").one()
    wire = ThesisTripwire(holding_id=cash.id, metric="roic", operator="<", threshold=D("0.1"), active=False)
    db_session.add(wire)
    db_session.commit()
    assert client.get("/game/standing").json()["level"] == 2  # an inactive wire is not armed

    wire.active = True
    db_session.commit()
    body = client.get("/game/standing").json()
    assert body["level"] == 3 and body["title"] == "Reasons" and body["next_step"] is None
    assert _gates(body)[3]["fact"] == "5 of 5 written up, 1 wire armed"


def test_the_level_drops_when_a_wrong_if_line_is_blanked(client, db_session):
    _seed(db_session)
    db_session.query(Holding).filter_by(ticker="BARE.OL").one().ticker = "JAREN.OL"
    db_session.commit()
    for ticker in ("CASH.OL", "GEAR.OL", "BANK.OL", "FUND", "JAREN.OL"):
        _entry(db_session, ticker, invalidation="" if ticker == "FUND" else "Margins fall")
    cash = db_session.query(Holding).filter_by(ticker="CASH.OL").one()
    db_session.add(ThesisTripwire(holding_id=cash.id, metric="roic", operator="<", threshold=D("0.1"), active=True))
    db_session.commit()
    body = client.get("/game/standing").json()
    assert body["level"] == 2 and _gates(body)[3]["fact"] == "4 of 5 written up, 1 wire armed"


def test_demo_mode_is_the_sample_fortress_level_zero_and_never_the_real_database(client, db_session):
    _seed(db_session)
    assert client.put("/settings/demo-mode", json={"enabled": True}).status_code == 200
    body = client.get("/game/standing").json()
    assert body["demo"] is True and body["level"] == 0
    assert all(g["fact"] == "Sample fortress, not yours" for g in body["gates"])


def test_the_route_writes_nothing(client, db_session):
    _seed(db_session)
    before = (db_session.query(DecisionJournalEntry).count(), db_session.query(ThesisTripwire).count())
    client.get("/game/standing")
    assert (db_session.query(DecisionJournalEntry).count(), db_session.query(ThesisTripwire).count()) == before


# --- Standing 3: Level 4, The Watch (standing_v2) ---------------------------------


def _level_three_fortress(db_session):
    """Every holding written up with a wrong-if, one wire armed, JAREN.OL as the named gap."""
    _seed(db_session)
    db_session.query(Holding).filter_by(ticker="BARE.OL").one().ticker = "JAREN.OL"
    db_session.commit()
    for ticker in ("CASH.OL", "GEAR.OL", "BANK.OL", "FUND", "JAREN.OL"):
        _entry(db_session, ticker)
    db_session.commit()
    cash = db_session.query(Holding).filter_by(ticker="CASH.OL").one()
    wire = ThesisTripwire(holding_id=cash.id, metric="roic", operator="<", threshold=D("0.1"), active=True)
    db_session.add(wire)
    db_session.commit()
    return wire


def _watch_reported(db_session, hours_ago):
    from datetime import datetime, timedelta, timezone

    from app.models.app_setting import AppSetting

    when = datetime.now(timezone.utc) - timedelta(hours=hours_ago)
    db_session.add(AppSetting(key="tripwire_check_last_run", value=when.isoformat()))
    db_session.commit()


@pytest.fixture
def standing_v2(monkeypatch):
    from app.config import settings as settings_module

    monkeypatch.setenv("ACTIVE_STANDING_VERSION", "v2")
    settings_module.get_settings.cache_clear()
    yield
    monkeypatch.undo()
    settings_module.get_settings.cache_clear()


@pytest.fixture
def standing_v1(monkeypatch):
    from app.config import settings as settings_module

    monkeypatch.setenv("ACTIVE_STANDING_VERSION", "v1")
    settings_module.get_settings.cache_clear()
    yield
    monkeypatch.undo()
    settings_module.get_settings.cache_clear()


def test_v2_can_still_be_chosen_and_tops_out_at_four(client, db_session, standing_v2):
    _level_three_fortress(db_session)
    _watch_reported(db_session, 2)
    body = client.get("/game/standing").json()
    assert body["version"] == "v2" and body["max_level"] == 4 and body["level"] == 4


def test_v1_can_still_be_chosen_and_tops_out_at_three(client, db_session, standing_v1):
    _level_three_fortress(db_session)
    _watch_reported(db_session, 2)
    body = client.get("/game/standing").json()
    assert body["version"] == "v1" and body["max_level"] == 3 and body["level"] == 3


def test_level_four_when_the_watch_reported_in_and_nothing_is_unseen(client, db_session, standing_v2):
    _level_three_fortress(db_session)
    _watch_reported(db_session, 2)
    body = client.get("/game/standing").json()
    assert body["version"] == "v2" and body["max_level"] == 4
    assert body["level"] == 4 and body["title"] == "The Watch" and body["next_step"] is None


def test_a_watch_that_never_ran_is_unknown_not_quiet(client, db_session, standing_v2):
    _level_three_fortress(db_session)
    body = client.get("/game/standing").json()
    assert body["level"] == 3
    assert _gates(body)[4]["fact"] == "The watch has not reported. Nothing is known."


def test_a_watch_older_than_a_night_drops_the_level(client, db_session, standing_v2):
    _level_three_fortress(db_session)
    _watch_reported(db_session, 24 * 5)
    body = client.get("/game/standing").json()
    assert body["level"] == 3 and _gates(body)[4]["fact"] == "The watch is not walking the walls"


def test_a_fired_wire_nobody_looked_at_blocks_until_it_is_marked_seen(client, db_session, standing_v2):
    from datetime import datetime, timezone

    wire = _level_three_fortress(db_session)
    _watch_reported(db_session, 2)
    wire.fired_at = datetime.now(timezone.utc)
    db_session.commit()
    body = client.get("/game/standing").json()
    assert body["level"] == 3 and _gates(body)[4]["fact"] == "1 wire fired, not yet looked at"

    assert client.post(f"/thesis/tripwires/{wire.id}/acknowledge").status_code == 200
    assert client.get("/game/standing").json()["level"] == 4


def test_an_inactive_fired_wire_does_not_block(client, db_session, standing_v2):
    from datetime import datetime, timezone

    wire = _level_three_fortress(db_session)
    other = ThesisTripwire(
        holding_id=wire.holding_id, metric="pe", operator=">", threshold=D("30"), active=False,
        fired_at=datetime.now(timezone.utc),
    )
    db_session.add(other)
    _watch_reported(db_session, 2)
    assert client.get("/game/standing").json()["level"] == 4


def test_the_sample_fortress_stays_level_zero_under_v2(client, db_session, standing_v2):
    assert client.put("/settings/demo-mode", json={"enabled": True}).status_code == 200
    body = client.get("/game/standing").json()
    assert body["demo"] is True and body["level"] == 0 and body["max_level"] == 4
    assert _gates(body)[4]["fact"] == "Sample fortress, not yours"


# --- Standing 3 T2: name the wires nobody has looked at ----------------------------


def test_fired_unseen_wires_are_listed_by_name_and_clear_once_acknowledged(client, db_session):
    from datetime import datetime, timezone

    wire = _level_three_fortress(db_session)
    assert client.get("/game/standing").json()["wires"] == []  # armed, never fired: nothing to look at
    wire.fired_at, wire.label = datetime.now(timezone.utc), "ROIC under 10%"
    db_session.commit()
    body = client.get("/game/standing").json()
    assert body["wires"] == [{"tripwire_id": str(wire.id), "ticker": "CASH.OL", "name": body["wires"][0]["name"], "label": "ROIC under 10%"}]
    assert body["wires"][0]["name"]
    assert client.post(f"/thesis/tripwires/{wire.id}/acknowledge").status_code == 200
    assert client.get("/game/standing").json()["wires"] == []


def test_seen_and_inactive_wires_are_not_listed(client, db_session):
    from datetime import datetime, timezone

    wire = _level_three_fortress(db_session)
    now = datetime.now(timezone.utc)
    wire.fired_at, wire.seen_at = now, now
    other = ThesisTripwire(
        holding_id=wire.holding_id, metric="pe", operator=">", threshold=D("30"), active=False, fired_at=now,
    )
    db_session.add(other)
    db_session.commit()
    assert client.get("/game/standing").json()["wires"] == []


def test_the_sample_fortress_lists_no_wires(client, db_session):
    _level_three_fortress(db_session)
    assert client.put("/settings/demo-mode", json={"enabled": True}).status_code == 200
    assert client.get("/game/standing").json()["wires"] == []


# --- Standing 4: Level 5, The Ledger (standing_v3) --------------------------------


def _level_four_fortress(db_session, *, days_ago=200, looked_back=True):
    """Level 4 (watch reporting, nothing unseen) with every entry `days_ago` old, looked back on or not."""
    from datetime import datetime, timedelta, timezone

    _level_three_fortress(db_session)
    _watch_reported(db_session, 2)
    for e in db_session.query(DecisionJournalEntry).all():
        e.decided_on = datetime.now(timezone.utc).date() - timedelta(days=days_ago)
        e.review_6m = "Margins held; the price did nothing. Still cheap for the same reason." if looked_back else None
    db_session.commit()


def test_v3_is_the_live_default(client, db_session):
    from app.config.settings import Settings

    assert Settings.model_fields["active_standing_version"].default == "v3"
    _level_four_fortress(db_session)
    body = client.get("/game/standing").json()
    assert body["version"] == "v3" and body["max_level"] == 5 and body["level"] == 5
    assert body["title"] == "The Ledger" and body["next_step"] is None
    assert _gates(body)[5]["fact"] == "5 look-backs written, none due"


def test_one_look_back_left_unwritten_drops_the_level_to_four(client, db_session):
    _level_four_fortress(db_session)
    e = db_session.query(DecisionJournalEntry).filter_by(ticker="FUND").one()
    e.review_6m = "   "  # blank text is not a look-back
    db_session.commit()
    body = client.get("/game/standing").json()
    assert body["level"] == 4 and _gates(body)[5]["fact"] == "1 look-back due"
    assert (_gates(body)[5]["done"], _gates(body)[5]["total"]) == (4, 5)


def test_a_young_journal_waits_and_says_how_long(client, db_session):
    _level_four_fortress(db_session, days_ago=100, looked_back=False)
    body = client.get("/game/standing").json()
    assert body["level"] == 4 and _gates(body)[5]["fact"] == "Too soon to look back: the first opens in 82 days"


def test_a_twelve_month_look_back_falls_due_on_its_own(client, db_session):
    _level_four_fortress(db_session, days_ago=400)
    body = client.get("/game/standing").json()
    assert body["level"] == 4 and _gates(body)[5]["fact"] == "5 look-backs due"


def test_the_sample_fortress_stays_level_zero_under_v3(client, db_session):
    assert client.put("/settings/demo-mode", json={"enabled": True}).status_code == 200
    body = client.get("/game/standing").json()
    assert body["demo"] is True and body["level"] == 0 and body["max_level"] == 5
    assert _gates(body)[5]["fact"] == "Sample fortress, not yours"
