"""Tag review inbox PR 3: `GET /tag-review/rules/{id}/export` and the `in_code` flag."""
from uuid import uuid4

from app.services.documents.extraction import ixbrl as ix
from app.services.settings.demo_mode import set_demo_mode
from tests.integration.test_documents_api import client  # noqa: F401  (fixture)
from tests.integration.test_tag_review_api import _upload
from tests.integration.test_tag_rules_api import CAPEX, CAPEX_TAG, _accept, _db
from tests.unit.test_tag_review import REVENUE


def _accepted(test_client, holding_id):
    _upload(test_client, holding_id, REVENUE + CAPEX)
    return _accept(test_client, holding_id, "capital expenditure", CAPEX_TAG).json()["id"]


def test_export_before_a_re_extract_uses_the_suggestion_value(client):  # noqa: F811
    test_client, holding_id = client
    rule_id = _accepted(test_client, holding_id)

    body = test_client.get(f"/tag-review/rules/{rule_id}/export").json()
    assert body["verified"] is True and body["problems"] == []
    assert body["scope"] == "company" and body["ticker"] == "EQNR.OL"
    assert f'"capital_expenditures", "{CAPEX_TAG}", "300000000", "USD", False' in body["row_line"]
    assert body["patch"].startswith("--- a/backend/app/services/documents/extraction/accepted_tag_rules.py")
    assert body["row_line"] in body["patch"]
    assert body["commit_message"].startswith(f"Read {CAPEX_TAG} as capital expenditure")
    assert body["test_path"].endswith("tests/unit/test_accepted_tag_rules.py")


def test_export_after_a_re_extract_uses_the_figure_the_rule_filled(client):  # noqa: F811
    test_client, holding_id = client
    rule_id = _accepted(test_client, holding_id)
    test_client.post("/tag-review/re-extract", json={"holding_id": holding_id})

    body = test_client.get(f"/tag-review/rules/{rule_id}/export").json()
    assert body["verified"] is True
    assert f'"{CAPEX_TAG}", "300000000", "USD"' in body["row_line"]


def test_export_is_read_only_and_leaves_the_rule_in_place(client):  # noqa: F811
    test_client, holding_id = client
    rule_id = _accepted(test_client, holding_id)
    test_client.get(f"/tag-review/rules/{rule_id}/export")
    rules = test_client.get("/tag-review/rules").json()["rules"]
    assert [r["id"] for r in rules] == [rule_id] and rules[0]["in_code"] is False


def test_only_an_accepted_rule_can_be_exported(client):  # noqa: F811
    test_client, holding_id = client
    _upload(test_client, holding_id, REVENUE + CAPEX)
    rejected = test_client.post(
        "/tag-review/rejections", json={"holding_id": holding_id, "metric": "capital expenditure", "concept": CAPEX_TAG}
    ).json()
    assert test_client.get(f"/tag-review/rules/{rejected['id']}/export").status_code == 409
    assert test_client.get(f"/tag-review/rules/{uuid4()}/export").status_code == 404


def test_a_tag_already_in_the_code_is_flagged_and_not_exported(client, monkeypatch):  # noqa: F811
    test_client, holding_id = client
    rule_id = _accepted(test_client, holding_id)
    monkeypatch.setitem(
        ix.CONCEPT_MAP, "capital_expenditures", (*ix.CONCEPT_MAP["capital_expenditures"], CAPEX_TAG)
    )
    assert test_client.get("/tag-review/rules").json()["rules"][0]["in_code"] is True
    refused = test_client.get(f"/tag-review/rules/{rule_id}/export")
    assert refused.status_code == 409 and "already built" in refused.json()["detail"]


def test_export_is_hidden_in_demo_mode(client):  # noqa: F811
    test_client, holding_id = client
    rule_id = _accepted(test_client, holding_id)
    db = _db()
    try:
        set_demo_mode(db, True)
    finally:
        db.close()
    assert test_client.get(f"/tag-review/rules/{rule_id}/export").status_code == 404
