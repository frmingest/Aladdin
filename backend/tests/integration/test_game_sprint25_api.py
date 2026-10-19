"""Sprint 25 over the real routes and a database: G18 Records,
G20 holding lines (2026-10-04). Read-only; demo mode wins; unknown stays
unknown. (Circle of Competence, G19, was removed 2026-10-19.)"""
from __future__ import annotations

from datetime import datetime, timedelta, timezone
from decimal import Decimal

from app.models import Holding
from app.models.journal import DecisionJournalEntry
from tests.integration.test_game_api import _seed

D = Decimal


def _holding(db, ticker):
    return db.query(Holding).filter_by(ticker=ticker).one()


def _journal(db, holding, *, days_ago, **kw):
    db.add(DecisionJournalEntry(
        holding_id=holding.id, ticker=holding.ticker, company_name=holding.name, action="buy",
        decided_on=datetime.now(timezone.utc).date() - timedelta(days=days_ago), price=D(100), currency="NOK", quantity=D(10),
        thesis="durable earnings", invalidation="margins fall", confidence=3, verdict_at_decision="Buy", **kw,
    ))
    db.commit()


# --- G20 ----------------------------------------------------------------------


def test_holding_advisors_returns_all_lines_for_that_holding(client, db_session):
    _seed(db_session)
    geared = _holding(db_session, "GEAR.OL")  # rotted walls, no moat, old analysis, 30% of the book
    body = client.get(f"/game/holdings/{geared.id}/advisors").json()
    rules = {line["rule"] for line in body["lines"]}
    assert {"weak_walls_big_tower", "no_moat_big_tower"} <= rules
    assert all(line["holding_id"] == str(geared.id) for line in body["lines"])
    assert body["disclaimer"]


def test_holding_advisors_unknown_holding_is_an_empty_list(client, db_session):
    _seed(db_session)
    body = client.get("/game/holdings/00000000-0000-0000-0000-000000000001/advisors")
    assert body.status_code == 200 and body.json()["lines"] == []


# --- G18 ----------------------------------------------------------------------


def test_records_show_the_journal_with_verdict_now_and_owed_reviews(client, db_session):
    _seed(db_session)
    geared = _holding(db_session, "GEAR.OL")
    _journal(db_session, geared, days_ago=200)  # past 182 days, no review written
    body = client.get("/game/records").json()
    assert body["reviews_due"] == 1
    (rec,) = body["records"]
    assert rec["ticker"] == "GEAR.OL" and rec["review_6m"] == "due" and rec["review_12m"] == "not_due"
    assert rec["verdict_then"] == "Buy" and rec["verdict_now"] == "Sell"
    assert rec["price_now"] is None and rec["price_note"]
    assert "not a score" in body["caption"]
    assert "score" not in rec and "hit_rate" not in rec


def test_records_empty_journal_is_an_empty_library(client, db_session):
    _seed(db_session)
    body = client.get("/game/records").json()
    assert body["records"] == [] and body["reviews_due"] == 0


# --- read-only and demo --------------------------------------------------------


def test_reads_write_nothing(client, db_session):
    _seed(db_session)
    before = db_session.query(DecisionJournalEntry).count()
    assert client.get("/game/records").status_code == 200
    assert db_session.query(DecisionJournalEntry).count() == before


def test_demo_mode_shows_invented_data(client, db_session):
    _seed(db_session)
    assert client.put("/settings/demo-mode", json={"enabled": True}).status_code == 200
    records = client.get("/game/records").json()
    assert records["demo"]
    real = {"CASH.OL", "GEAR.OL", "BANK.OL"}
    assert not real & {r["ticker"] for r in records["records"]}
    # the removed Circle routes are gone, not just empty
    assert client.get("/game/competence").status_code == 404
