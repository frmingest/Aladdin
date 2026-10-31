"""GET /game/standing over the real route and a database (Standing 1, 2026-10-31).
Read-only, demo mode wins, unknown stays unknown, the level follows the stored facts."""
from __future__ import annotations

from datetime import date
from decimal import Decimal

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
    assert body["level"] == 0 and body["demo"] is False and body["max_level"] == 3
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


def test_level_three_needs_every_reason_a_wrong_if_and_an_active_wire(client, db_session):
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
