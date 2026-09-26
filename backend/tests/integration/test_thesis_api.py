"""Integration tests for the thesis tracking API (Sprint 11,
app/api/thesis.py) — CRUD, the confirm=true guard on delete, and the 409
on acknowledging a tripwire that isn't firing."""
from __future__ import annotations

import uuid
from datetime import datetime, timezone
from decimal import Decimal

from app.models.market import MarketObservation

NOW = datetime.now(timezone.utc)


def _holding(client, ticker="AAPL"):
    response = client.post("/holdings", json={"ticker": ticker, "name": "Apple Inc.", "trading_currency": "USD"})
    assert response.status_code == 201, response.text
    return response.json()["id"]


def test_metric_registry_endpoint(client):
    response = client.get("/thesis/metrics")
    assert response.status_code == 200
    keys = {m["key"] for m in response.json()}
    assert "roic" in keys and "share_price" in keys


def test_unknown_holding_is_404(client):
    assert client.get(f"/thesis/holdings/{uuid.uuid4()}").status_code == 404


def test_holding_with_no_data_is_not_analyzed(client):
    holding_id = _holding(client)
    body = client.get(f"/thesis/holdings/{holding_id}").json()
    assert body["status"] == "not_analyzed"
    assert body["tripwires"] == []
    assert body["timeline"] == []


def test_create_tripwire_requires_a_known_metric(client):
    holding_id = _holding(client)
    bad = client.post(
        f"/thesis/holdings/{holding_id}/tripwires",
        json={"metric": "not_a_metric", "operator": "below", "threshold": "1"},
    )
    assert bad.status_code == 422


def test_full_tripwire_crud_and_acknowledge_flow(client, db_session):
    holding_id = _holding(client)

    created = client.post(
        f"/thesis/holdings/{holding_id}/tripwires",
        json={"metric": "share_price", "operator": "below", "threshold": "100", "label": "cheap enough"},
    )
    assert created.status_code == 201, created.text
    tripwire_id = created.json()["id"]
    assert created.json()["firing"] is False

    # Not firing yet -> acknowledging is refused.
    ack = client.post(f"/thesis/tripwires/{tripwire_id}/acknowledge")
    assert ack.status_code == 409

    # Push the price under the threshold, directly (no live provider in
    # tests) — then re-reading the holding evaluates and persists the fire.
    db_session.add(MarketObservation(
        holding_id=uuid.UUID(holding_id), observed_at=NOW, price=50, currency="USD", provider="fake",
    ))
    db_session.commit()

    body = client.get(f"/thesis/holdings/{holding_id}").json()
    assert body["status"] == "tripwire_fired"
    tripwire = body["tripwires"][0]
    assert tripwire["firing"] is True
    assert Decimal(tripwire["current_value"]) == Decimal(50)

    ack = client.post(f"/thesis/tripwires/{tripwire_id}/acknowledge")
    assert ack.status_code == 200, ack.text
    assert ack.json()["seen_at"] is not None

    patched = client.patch(f"/thesis/tripwires/{tripwire_id}", json={"threshold": "10"})
    assert patched.status_code == 200, patched.text
    assert patched.json()["fired_at"] is None  # editing the rule clears the old firing
    assert patched.json()["seen_at"] is None

    delete_no_confirm = client.delete(f"/thesis/tripwires/{tripwire_id}")
    assert delete_no_confirm.status_code == 400

    delete = client.delete(f"/thesis/tripwires/{tripwire_id}", params={"confirm": "true"})
    assert delete.status_code == 204

    after = client.get(f"/thesis/holdings/{holding_id}").json()
    assert after["tripwires"] == []


def test_monitor_endpoint_returns_rows(client):
    holding_id = _holding(client)
    client.post(
        f"/thesis/holdings/{holding_id}/tripwires",
        json={"metric": "share_price", "operator": "below", "threshold": "100"},
    )
    response = client.get("/thesis/monitor")
    assert response.status_code == 200
    rows = response.json()["rows"]
    assert any(r["holding_id"] == holding_id for r in rows)


def test_suggestions_are_parsed_from_the_latest_run(client, db_session):
    from app.models.analysis import EquityAnalysisRun

    holding_id = _holding(client)
    db_session.add(EquityAnalysisRun(
        holding_id=uuid.UUID(holding_id), status="COMPLETED", schema_version="v1", blind_prompt_version="v1",
        evidence_packet_version="v1", evidence_packet_json={}, evidence_unavailable_reasons=[],
        started_at=NOW,
        blind_pass_json={
            "verdict": {"rating": "Buy"},
            "invalidation_triggers": ["Net debt/EBITDA rises above 2.5x"],
            "metrics_to_monitor": ["Something qualitative that can't be parsed"],
        },
    ))
    db_session.commit()

    body = client.get(f"/thesis/holdings/{holding_id}").json()
    suggestions = body["suggestions"]
    assert len(suggestions) == 2
    parsed = next(s for s in suggestions if s["text"].startswith("Net debt"))
    assert parsed["metric"] == "net_debt_to_ebitda"
    assert parsed["operator"] == "above"
    assert Decimal(parsed["threshold"]) == Decimal("2.5")
    unparsed = next(s for s in suggestions if "qualitative" in s["text"])
    assert unparsed["metric"] is None
