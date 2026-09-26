"""Destructive deletes added 2026-09-23: one document, all of a holding's
documents/data, a holding with cascade, and the holdings clean slate —
plus the metrics panel's provenance/warnings for an iXBRL upload."""
from __future__ import annotations

import os
import uuid

from app.models.document import Document
from app.models.portfolio import PortfolioPosition, PortfolioSnapshot
from tests.unit.test_extraction_ixbrl import VAR_BALANCE, VAR_INCOME, _filing

XHTML = _filing(VAR_INCOME, VAR_BALANCE)


def _holding(client, ticker="VAR.OL"):
    response = client.post(
        "/holdings", json={"ticker": ticker, "name": "Vår Energi ASA", "trading_currency": "NOK"}
    )
    assert response.status_code == 201, response.text
    return response.json()["id"]


def _upload(client, holding_id, content=XHTML, name="var-2025.xhtml"):
    response = client.post(
        "/documents/upload",
        data={"holding_id": holding_id, "document_type": "annual_report"},
        files={"file": (name, content, "application/xhtml+xml")},
    )
    assert response.status_code == 201, response.text
    return response.json()


def _storage_path(db_session, document_id):
    return db_session.get(Document, uuid.UUID(document_id)).storage_path


def test_ixbrl_metrics_show_currency_provenance_notes_and_warnings(client):
    holding_id = _holding(client)
    _upload(client, holding_id)

    body = client.get(f"/holdings/{holding_id}/metrics", params={"period": "FY2025"}).json()

    assert body["currency"] == "USD"
    sources = {f["metric"]: f["source"] for f in body["fact_details"]}
    assert sources["net_income"] == "ifrs-full:ProfitLossAttributableToOrdinaryEquityHoldersOfParentEntity"
    assert all(f["original_filename"] == "var-2025.xhtml" for f in body["fact_details"])
    assert "PurchaseOfExplorationAndEvaluationAssets" in body["notes"]["free_cash_flow"]
    assert "proxy" in body["notes"]["interest_coverage"]
    assert any("HybridCapital" in w for w in body["warnings"])
    assert "interest_coverage" in body["computed"]
    assert "net_debt_to_ebitda" not in body["computed"]  # no borrowings tagged in this fixture


def test_delete_document_requires_confirm_and_removes_rows_and_file(client, db_session):
    holding_id = _holding(client)
    document_id = _upload(client, holding_id)["document"]["id"]
    path = _storage_path(db_session, document_id)
    assert os.path.exists(path)

    assert client.delete(f"/documents/{document_id}").status_code == 400

    response = client.delete(f"/documents/{document_id}", params={"confirm": "true"})
    assert response.status_code == 200, response.text
    counts = response.json()
    assert counts["documents"] == 1 and counts["facts"] > 0 and counts["pages"] > 0
    assert counts["storage_files_deleted"] == 1 and counts["storage_files_failed"] == []
    assert not os.path.exists(path)
    assert client.get(f"/documents/{document_id}").status_code == 404
    assert client.get(f"/holdings/{holding_id}/periods").json() == []

    # The same file can now be uploaded (and extracted) again — not
    # short-circuited by the sha256 duplicate check.
    again = _upload(client, holding_id)
    assert again["was_duplicate_file"] is False


def test_delete_unknown_document_is_404(client):
    response = client.delete(f"/documents/{uuid.uuid4()}", params={"confirm": "true"})
    assert response.status_code == 404


def test_delete_holding_documents_keeps_the_holding(client):
    holding_id = _holding(client)
    _upload(client, holding_id)
    _upload(client, holding_id, content=XHTML.replace(b"ACME annual", b"ACME yearly"), name="b.xhtml")

    assert client.delete(f"/holdings/{holding_id}/documents").status_code == 400
    response = client.delete(f"/holdings/{holding_id}/documents", params={"confirm": "true"})
    assert response.status_code == 200, response.text
    assert response.json()["documents"] == 2
    assert response.json()["holdings"] == 0
    assert client.get(f"/holdings/{holding_id}").status_code == 200
    assert client.get("/documents", params={"holding_id": holding_id}).json() == []


def test_plain_holding_delete_still_refuses_but_cascade_removes_everything(client):
    holding_id = _holding(client)
    _upload(client, holding_id)

    refused = client.delete(f"/holdings/{holding_id}", params={"confirm": "true"})
    assert refused.status_code == 409

    response = client.delete(f"/holdings/{holding_id}", params={"confirm": "true", "cascade": "true"})
    assert response.status_code == 204, response.text
    assert client.get(f"/holdings/{holding_id}").status_code == 404
    assert client.get("/documents").json() == []


def _snapshot_with_position(db_session, holding_id):
    source = Document(
        holding_id=None,
        type="portfolio_export",
        original_filename="export.csv",
        mime_type="text/csv",
        size_bytes=1,
        storage_path="nowhere",
        sha256=uuid.uuid4().hex * 2,
        status="processed",
        quality_flags={},
    )
    db_session.add(source)
    db_session.flush()
    snapshot = PortfolioSnapshot(source_file_id=source.id, reporting_currency="NOK", status="processed")
    db_session.add(snapshot)
    db_session.flush()
    db_session.add(PortfolioPosition(snapshot_id=snapshot.id, holding_id=uuid.UUID(holding_id)))
    db_session.commit()
    return source.id


def test_holding_in_a_portfolio_snapshot_is_not_cascade_deleted(client, db_session):
    holding_id = _holding(client)
    _snapshot_with_position(db_session, holding_id)

    response = client.delete(f"/holdings/{holding_id}", params={"confirm": "true", "cascade": "true"})
    assert response.status_code == 409
    assert "portfolio" in response.json()["detail"]


def test_document_a_snapshot_was_imported_from_cannot_be_deleted(client, db_session):
    holding_id = _holding(client)
    source_id = _snapshot_with_position(db_session, holding_id)
    response = client.delete(f"/documents/{source_id}", params={"confirm": "true"})
    assert response.status_code == 409
    assert "snapshot" in response.json()["detail"]


def test_holding_documents_delete_keeps_tripwires_but_cascade_delete_removes_them(client, db_session):
    """Sprint 11: a tripwire belongs to the holding, not its financial
    data — the "delete this holding's documents, then re-upload" flow must
    not sweep it up, but actually deleting the holding must."""
    from app.models.thesis import ThesisTripwire

    holding_id = _holding(client)
    _upload(client, holding_id)
    tripwire = client.post(
        f"/thesis/holdings/{holding_id}/tripwires",
        json={"metric": "share_price", "operator": "below", "threshold": "10"},
    )
    assert tripwire.status_code == 201, tripwire.text
    tripwire_id = tripwire.json()["id"]

    response = client.delete(f"/holdings/{holding_id}/documents", params={"confirm": "true"})
    assert response.status_code == 200, response.text
    assert response.json().get("tripwires", 0) == 0
    assert client.get(f"/thesis/holdings/{holding_id}").json()["tripwires"][0]["id"] == tripwire_id

    cascade = client.delete(f"/holdings/{holding_id}", params={"confirm": "true", "cascade": "true"})
    assert cascade.status_code == 204, cascade.text
    assert db_session.query(ThesisTripwire).filter_by(id=uuid.UUID(tripwire_id)).first() is None


def test_wipe_all_holdings_requires_an_empty_portfolio_then_clears_everything(client, db_session):
    first = _holding(client, "VAR.OL")
    _holding(client, "EQNR.OL")
    _upload(client, first)
    _snapshot_with_position(db_session, first)

    assert client.delete("/holdings/all").status_code == 400
    blocked = client.delete("/holdings/all", params={"confirm": "true"})
    assert blocked.status_code == 409

    assert client.delete("/portfolio/all", params={"confirm": "true"}).status_code == 200
    response = client.delete("/holdings/all", params={"confirm": "true"})
    assert response.status_code == 200, response.text
    counts = response.json()
    assert counts["holdings"] == 2
    assert counts["documents"] == 2  # the filing + the orphaned portfolio export
    assert client.get("/holdings").json() == []
    assert client.get("/documents").json() == []
