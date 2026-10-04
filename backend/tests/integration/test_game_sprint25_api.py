"""Sprint 25 over the real routes and a database: G17 Council, G18 Records,
G19 Circle, G20 holding lines (2026-10-04). Read-only except the user's own
competence marks; demo mode wins; unknown stays unknown."""
from __future__ import annotations

from datetime import datetime, timedelta, timezone
from decimal import Decimal

from app.models import Holding
from app.models.competence import CompetenceMark
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


# --- G19 ----------------------------------------------------------------------


def test_competence_starts_unmarked_and_marks_round_trip(client, db_session):
    _seed(db_session)
    body = client.get("/game/competence").json()
    assert all(s["level"] is None for s in body["sectors"])
    status = {t["name"]: t["status"] for t in body["towers"]}
    assert status["Geared"] == "unmarked" and status["World ETF"] == "not_applicable"
    assert status["No Filings"] == "unclassified"

    put = client.put("/game/competence/Energy", json={"level": "outside", "note": " not my field "})
    assert put.status_code == 200
    out = put.json()
    assert {t["name"]: t["status"] for t in out["towers"]}["Geared"] == "outside"
    assert D(out["outside_weight_pct"]) == D(30)  # 300 of 1000
    energy = next(s for s in out["sectors"] if s["sector"] == "Energy")
    assert energy["level"] == "outside" and energy["note"] == "not my field"

    client.put("/game/competence/Energy", json={"level": "know"})  # change it, still one row
    assert db_session.query(CompetenceMark).count() == 1
    cleared = client.delete("/game/competence/Energy").json()
    assert next(s for s in cleared["sectors"] if s["sector"] == "Energy")["level"] is None
    assert db_session.query(CompetenceMark).count() == 0


def test_competence_refuses_unknown_sector_level_and_long_note(client, db_session):
    _seed(db_session)
    assert client.put("/game/competence/Widgets", json={"level": "know"}).status_code == 422
    assert client.put("/game/competence/Energy", json={"level": "guru"}).status_code == 422
    assert client.put("/game/competence/Energy", json={"level": "know", "note": "x" * 501}).status_code == 422
    assert db_session.query(CompetenceMark).count() == 0


# --- G17 ----------------------------------------------------------------------


def test_council_builds_its_agenda_from_stored_facts(client, db_session):
    _seed(db_session)
    geared = _holding(db_session, "GEAR.OL")
    _journal(db_session, geared, days_ago=200)
    client.put("/game/competence/Energy", json={"level": "outside"})
    body = client.get("/game/council").json()
    kinds = [i["kind"] for i in body["items"]]
    assert kinds == sorted(
        kinds, key=["tripwire", "thesis_review", "review_due", "weak_walls", "no_moat", "stale_analysis",
                    "outside_circle", "cash"].index)
    assert {"review_due", "weak_walls", "no_moat", "outside_circle", "cash"} <= set(kinds)
    weak = next(i for i in body["items"] if i["kind"] == "weak_walls")
    assert [h["name"] for h in weak["holdings"]] == ["Geared"]
    assert body["advisors"]  # the advisors open the session
    assert "not advice to trade" in body["disclaimer"]


def test_council_on_an_empty_database_says_so(client):
    body = client.get("/game/council").json()
    assert body["items"] == [] and "empty" in body["summary"]


# --- read-only and demo --------------------------------------------------------


def test_reads_write_nothing(client, db_session):
    _seed(db_session)
    before = db_session.query(CompetenceMark).count(), db_session.query(DecisionJournalEntry).count()
    for path in ("/game/council", "/game/records", "/game/competence"):
        assert client.get(path).status_code == 200
    assert (db_session.query(CompetenceMark).count(), db_session.query(DecisionJournalEntry).count()) == before


def test_demo_mode_shows_invented_data_and_blocks_marks(client, db_session):
    _seed(db_session)
    assert client.put("/settings/demo-mode", json={"enabled": True}).status_code == 200
    council = client.get("/game/council").json()
    records = client.get("/game/records").json()
    circle = client.get("/game/competence").json()
    assert council["demo"] and records["demo"] and circle["demo"]
    real = {"CASH.OL", "GEAR.OL", "BANK.OL"}
    assert not real & {t["name"] for t in circle["towers"]} and not real & {r["ticker"] for r in records["records"]}
    assert {s["level"] for s in circle["sectors"]} >= {"know", "partly", "outside"}
    assert client.put("/game/competence/Energy", json={"level": "know"}).status_code in (403, 409, 423)
    assert db_session.query(CompetenceMark).count() == 0
