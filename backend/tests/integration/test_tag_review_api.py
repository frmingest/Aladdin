"""Tag review inbox API (PR 1): upload an ESEF file, read the review back."""
from uuid import uuid4

from tests.integration.test_documents_api import client  # noqa: F401  (fixture)
from tests.unit.test_extraction_ixbrl import _filing
from tests.unit.test_tag_review import ASSETS, REVENUE, _both


def _upload(test_client, holding_id, income):
    response = test_client.post(
        "/documents/upload",
        data={"holding_id": holding_id, "document_type": "annual_report"},
        files={"file": ("acme-2025.xhtml", _filing(income, ASSETS), "application/xhtml+xml")},
    )
    assert response.status_code == 201, response.text


def test_gap_and_closest_tag_show_up_in_the_inbox(client):  # noqa: F811
    test_client, holding_id = client
    _upload(test_client, holding_id, REVENUE + _both("Capex", "ACME:AcquisitionsOfTangibleFixedAssetsInCash", "300.0", "250.0"))

    body = test_client.get("/tag-review").json()
    assert body["holdings_needing_review"] == 1 and body["total_gaps"] >= 1
    row = body["holdings"][0]
    assert row["ticker"] == "EQNR.OL" and row["fiscal_year"] == "FY2025"
    capex = next(g for g in row["gaps"] if g["metric"] == "capital expenditure")
    assert capex["candidates"][0]["concept"] == "ACME:AcquisitionsOfTangibleFixedAssetsInCash"
    assert capex["candidates"][0]["suggested_scope"] == "company"
    assert "ACME:AcquisitionsOfTangibleFixedAssetsInCash" in row["chat_summary"]


def test_filter_by_holding_and_unknown_holding(client):  # noqa: F811
    test_client, holding_id = client
    _upload(test_client, holding_id, REVENUE)
    assert len(test_client.get("/tag-review", params={"holding_id": holding_id}).json()["holdings"]) == 1
    assert test_client.get("/tag-review", params={"holding_id": str(uuid4())}).json()["holdings"] == []


def test_empty_when_nothing_was_uploaded(client):  # noqa: F811
    test_client, _ = client
    body = test_client.get("/tag-review").json()
    assert body == {"holdings": [], "holdings_needing_review": 0, "total_gaps": 0}
