"""Integration tests for /journal (feature F6)."""
from __future__ import annotations

import uuid
from datetime import datetime, timezone
from decimal import Decimal

from app.models.analysis import EquityAnalysisRun
from app.models.market import MarketObservation


def _holding(client, ticker="EQNR.OL"):
    return client.post("/holdings", json={"ticker": ticker, "name": "Equinor ASA", "trading_currency": "NOK"}).json()["id"]


def test_create_list_update_delete(client, db_session):
    hid = _holding(client)
    db_session.add(EquityAnalysisRun(
        holding_id=uuid.UUID(hid), status="COMPLETED",
        schema_version="v1", blind_prompt_version="v1", evidence_packet_version="v3", evidence_packet_json=[],
        evidence_unavailable_reasons=[], blind_pass_json={"verdict": {"rating": "Buy"}, "moat": {"overall_rating": "Wide"}},
        started_at=datetime(2026, 1, 10, tzinfo=timezone.utc), completed_at=datetime(2026, 1, 10, tzinfo=timezone.utc),
    ))
    db_session.add(MarketObservation(holding_id=uuid.UUID(hid), price=Decimal(330), currency="NOK",
                                     provider="fake", observed_at=datetime.now(timezone.utc)))
    db_session.commit()

    r = client.post("/journal", json={
        "holding_id": hid, "action": "buy", "decided_on": "2026-01-15", "price": "300",
        "thesis": "  Low-cost producer, net cash  ", "invalidation": "Breakeven above 60 USD", "confidence": 4,
    })
    assert r.status_code == 201, r.text
    entry = r.json()
    assert entry["ticker"] == "EQNR.OL"
    assert entry["currency"] == "NOK"
    assert entry["thesis"] == "Low-cost producer, net cash"
    assert entry["verdict_at_decision"] == "Buy"
    assert Decimal(entry["outcome"]["return_pct"]) == 10
    assert entry["outcome"]["in_favour"] is True
    assert entry["outcome"]["review_6m_due"] is True

    body = client.get("/journal").json()
    assert body["reviews_due"] == 1
    assert client.get("/journal", params={"holding_id": hid}).json()["entries"][0]["id"] == entry["id"]

    updated = client.patch(f"/journal/{entry['id']}", json={"review_6m": "Still cheap, thesis intact"}).json()
    assert updated["outcome"]["review_6m_due"] is False
    assert client.patch(f"/journal/{entry['id']}", json={"thesis": "   "}).status_code == 422

    assert client.delete(f"/journal/{entry['id']}").status_code == 400
    assert client.delete(f"/journal/{entry['id']}", params={"confirm": True}).status_code == 204
    assert client.get("/journal").json()["entries"] == []


def test_validation(client):
    hid = _holding(client)
    base = {"holding_id": hid, "action": "buy", "decided_on": "2026-01-15", "thesis": "x"}
    assert client.post("/journal", json={**base, "action": "yolo"}).status_code == 422
    assert client.post("/journal", json={**base, "confidence": 9}).status_code == 422
    assert client.post("/journal", json={**base, "price": "-1"}).status_code == 422
    assert client.post("/journal", json={**base, "holding_id": "00000000-0000-0000-0000-000000000000"}).status_code == 404


def test_entries_survive_holding_delete(client):
    hid = _holding(client)
    client.post("/journal", json={"holding_id": hid, "action": "pass", "decided_on": "2026-02-01", "thesis": "Too pricey"})
    assert client.delete(f"/holdings/{hid}", params={"confirm": True}).status_code == 204
    entries = client.get("/journal").json()["entries"]
    assert len(entries) == 1
    assert entries[0]["holding_id"] is None
    assert entries[0]["company_name"] == "Equinor ASA"


def _run(db_session, hid, rating, when):
    db_session.add(EquityAnalysisRun(
        holding_id=uuid.UUID(hid), status="COMPLETED",
        schema_version="v1", blind_prompt_version="v1", evidence_packet_version="v3", evidence_packet_json=[],
        evidence_unavailable_reasons=[], blind_pass_json={"verdict": {"rating": rating}, "moat": {"overall_rating": "Wide"}},
        started_at=when, completed_at=when,
    ))
    db_session.commit()


def test_back_dated_entry_records_the_verdict_in_force_then_not_today_s(client, db_session):
    hid = _holding(client)
    _run(db_session, hid, "Buy", datetime(2026, 1, 10, tzinfo=timezone.utc))
    _run(db_session, hid, "Avoid", datetime(2026, 9, 1, tzinfo=timezone.utc))
    base = {"holding_id": hid, "action": "buy", "thesis": "x"}

    old = client.post("/journal", json={**base, "decided_on": "2026-02-01"}).json()
    assert old["verdict_at_decision"] == "Buy"  # not today's "Avoid"
    # The day the run finished counts as in force that day.
    same_day = client.post("/journal", json={**base, "decided_on": "2026-01-10"}).json()
    assert same_day["verdict_at_decision"] == "Buy"
    # Before any analysis existed there was no verdict to record.
    before = client.post("/journal", json={**base, "decided_on": "2026-01-09"}).json()
    assert before["verdict_at_decision"] is None
    recent = client.post("/journal", json={**base, "decided_on": "2026-10-01"}).json()
    assert recent["verdict_at_decision"] == "Avoid"


def test_changing_decided_on_recomputes_the_verdict_at_decision(client, db_session):
    hid = _holding(client)
    _run(db_session, hid, "Buy", datetime(2026, 1, 10, tzinfo=timezone.utc))
    _run(db_session, hid, "Avoid", datetime(2026, 9, 1, tzinfo=timezone.utc))
    entry = client.post("/journal", json={
        "holding_id": hid, "action": "buy", "thesis": "x", "decided_on": "2026-10-01",
    }).json()
    assert entry["verdict_at_decision"] == "Avoid"
    moved = client.patch(f"/journal/{entry['id']}", json={"decided_on": "2026-02-01"}).json()
    assert moved["verdict_at_decision"] == "Buy"
