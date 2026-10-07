"""Tag review inbox PR 2: accept / reject / remove a mapping rule, the second
confirmation, scope by tag type, re-extract, and that decisions survive a
delete-and-re-fetch of a holding's documents."""
from uuid import uuid4

from app.config.database import get_db
from app.main import app
from app.models.financial_line_item import FinancialLineItem
from app.models.holding import Holding
from app.models.tag_mapping_rule import TagMappingRule
from app.services.deletion import purge_holding
from app.services.settings.demo_mode import set_demo_mode
from tests.integration.test_documents_api import client  # noqa: F401  (fixture)
from tests.integration.test_tag_review_api import _upload
from tests.unit.test_tag_review import REVENUE, _both, _cash_flow

CAPEX = _both("Capex", "ACME:AcquisitionsOfTangibleFixedAssetsInCash", "300.0", "250.0")
AMORT = _both("Amortisation", "ifrs-full:AmortisationExpense", "80.0", "70.0")
CAPEX_TAG = "ACME:AcquisitionsOfTangibleFixedAssetsInCash"


def _db():
    return next(app.dependency_overrides[get_db]())


def _metrics(holding_id) -> dict[str, float]:
    db = _db()
    try:
        return {
            f"{r.metric} {r.period}": float(r.value)
            for r in db.query(FinancialLineItem).filter(FinancialLineItem.holding_id == holding_id)
        }
    finally:
        db.close()


def _accept(test_client, holding_id, metric, concept, **extra):
    return test_client.post(
        "/tag-review/rules", json={"holding_id": holding_id, "metric": metric, "concept": concept, **extra}
    )


def _gap(test_client, metric):
    row = test_client.get("/tag-review").json()["holdings"][0]
    return next((g for g in row["gaps"] if g["metric"] == metric), None)


def test_accept_a_company_tag_then_re_extract_fills_the_figure(client):  # noqa: F811
    test_client, holding_id = client
    _upload(test_client, holding_id, REVENUE + CAPEX)
    assert "capital_expenditures FY2025" not in _metrics(holding_id)

    response = _accept(test_client, holding_id, "capital expenditure", CAPEX_TAG)
    assert response.status_code == 201, response.text
    rule = response.json()
    assert rule["status"] == "accepted" and rule["metric"] == "capital_expenditures"
    assert rule["scope"] == "company"  # an extension tag is never an all-companies rule
    assert rule["check_overridden"] is False

    # Saved, not applied: the gap stays but is marked as waiting for a re-extract.
    gap = _gap(test_client, "capital expenditure")
    assert gap["rule_pending"] is True
    assert gap["candidates"][0]["decision"] == "accepted"
    assert "capital_expenditures FY2025" not in _metrics(holding_id)

    result = test_client.post("/tag-review/re-extract", json={"holding_id": holding_id})
    assert result.status_code == 200, result.text
    body = result.json()
    assert body["documents"] == 1 and body["rule_figures"] >= 1
    assert body["facts_after"] > body["facts_before"]
    metrics = _metrics(holding_id)
    assert metrics["capital_expenditures FY2025"] == 300_000_000
    assert metrics["capital_expenditures FY2024"] == 250_000_000
    assert _gap(test_client, "capital expenditure") is None  # the gap is gone


def test_a_standard_tag_becomes_an_all_companies_rule(client):  # noqa: F811
    test_client, holding_id = client
    _upload(test_client, holding_id, REVENUE + AMORT)
    rule = _accept(test_client, holding_id, "depreciation and amortisation", "ifrs-full:AmortisationExpense").json()
    assert rule["scope"] == "all"


def test_a_failed_check_needs_a_second_confirmation_enforced_by_the_server(client):  # noqa: F811
    test_client, holding_id = client
    _upload(test_client, holding_id, REVENUE + _cash_flow("500.0"))  # does not close the cash flow
    tag = "ACME:NetCashFromOperatingActivities"
    candidate = _gap(test_client, "operating cash flow")["candidates"][0]
    assert candidate["check"] == "does_not_tie" and candidate["needs_second_confirmation"] is True

    refused = _accept(test_client, holding_id, "operating cash flow", tag)
    assert refused.status_code == 409
    assert "second confirmation" in refused.json()["detail"]
    assert test_client.get("/tag-review/rules").json()["rules"] == []

    confirmed = _accept(test_client, holding_id, "operating cash flow", tag, confirm_failed_check=True)
    assert confirmed.status_code == 201
    assert confirmed.json()["check_overridden"] is True

    test_client.post("/tag-review/re-extract", json={"holding_id": holding_id})
    db = _db()
    try:
        item = db.query(FinancialLineItem).filter_by(metric="operating_cash_flow", period="FY2025").one()
        assert item.confidence == 0.8  # lower than a built-in tag and than a passing rule
    finally:
        db.close()


def test_a_passing_check_needs_only_the_one_confirmation(client):  # noqa: F811
    test_client, holding_id = client
    _upload(test_client, holding_id, REVENUE + _cash_flow("100.0"))  # ties
    response = _accept(test_client, holding_id, "operating cash flow", "ACME:NetCashFromOperatingActivities")
    assert response.status_code == 201 and response.json()["check_overridden"] is False


def test_only_a_suggestion_the_inbox_offered_can_become_a_rule(client):  # noqa: F811
    test_client, holding_id = client
    _upload(test_client, holding_id, REVENUE + CAPEX)
    assert _accept(test_client, holding_id, "capital expenditure", "ACME:NotInTheFiling").status_code == 404
    assert _accept(test_client, holding_id, "capital expenditure", "ifrs-full:Revenue").status_code == 404
    assert _accept(test_client, holding_id, "EBITDA", CAPEX_TAG).status_code == 422
    assert _accept(test_client, holding_id, "no such input", CAPEX_TAG).status_code == 422
    assert _accept(test_client, str(uuid4()), "capital expenditure", CAPEX_TAG).status_code == 404


def test_a_rejected_suggestion_is_hidden_and_can_be_brought_back(client):  # noqa: F811
    test_client, holding_id = client
    _upload(test_client, holding_id, REVENUE + CAPEX)
    rejected = test_client.post(
        "/tag-review/rejections", json={"holding_id": holding_id, "metric": "capital expenditure", "concept": CAPEX_TAG}
    )
    assert rejected.status_code == 201 and rejected.json()["status"] == "rejected"

    gap = _gap(test_client, "capital expenditure")
    assert all(c["concept"] != CAPEX_TAG for c in gap["candidates"])
    assert gap["rejected_hidden"] == 1

    # A rejection is not a rule: re-extracting reads nothing from it.
    test_client.post("/tag-review/re-extract", json={"holding_id": holding_id})
    assert "capital_expenditures FY2025" not in _metrics(holding_id)

    assert test_client.delete(f"/tag-review/rules/{rejected.json()['id']}").status_code == 204
    again = _gap(test_client, "capital expenditure")
    assert again["candidates"][0]["concept"] == CAPEX_TAG and again["rejected_hidden"] == 0


def test_removing_a_rule_stops_it_applying_from_the_next_re_extract(client):  # noqa: F811
    test_client, holding_id = client
    _upload(test_client, holding_id, REVENUE + CAPEX)
    rule = _accept(test_client, holding_id, "capital expenditure", CAPEX_TAG).json()
    test_client.post("/tag-review/re-extract", json={"holding_id": holding_id})
    assert "capital_expenditures FY2025" in _metrics(holding_id)

    assert test_client.delete(f"/tag-review/rules/{rule['id']}").status_code == 204
    assert "capital_expenditures FY2025" in _metrics(holding_id)  # kept until re-extracted
    test_client.post("/tag-review/re-extract", json={"holding_id": holding_id})
    assert "capital_expenditures FY2025" not in _metrics(holding_id)
    assert test_client.delete(f"/tag-review/rules/{rule['id']}").status_code == 404


def test_re_extract_leaves_text_pages_and_chunks_alone(client):  # noqa: F811
    test_client, holding_id = client
    _upload(test_client, holding_id, REVENUE + CAPEX)
    document_id = test_client.get("/documents", params={"holding_id": holding_id}).json()[0]["id"]
    before = test_client.get(f"/documents/{document_id}").json()
    _accept(test_client, holding_id, "capital expenditure", CAPEX_TAG)
    test_client.post("/tag-review/re-extract", json={"holding_id": holding_id})
    after = test_client.get(f"/documents/{document_id}").json()
    assert before["page_count"] == after["page_count"] and before["status"] == after["status"] == "processed"
    assert after["quality_flags"]["ixbrl"]["rules_applied"]


def test_a_new_fetch_applies_saved_rules_at_once(client):  # noqa: F811
    test_client, holding_id = client
    _upload(test_client, holding_id, REVENUE + CAPEX)
    _accept(test_client, holding_id, "capital expenditure", CAPEX_TAG)
    # Delete the holding's documents and upload again: the rule must survive.
    db = _db()
    try:
        from app.config.settings import get_settings  # noqa: F401
        from app.providers.factory import get_object_storage

        purge_holding(db, app.dependency_overrides[get_object_storage](), db.get(Holding, holding_id), keep_holding=True)
    finally:
        db.close()
    assert len(test_client.get("/tag-review/rules").json()["rules"]) == 1
    _upload(test_client, holding_id, REVENUE + CAPEX)
    assert _metrics(holding_id)["capital_expenditures FY2025"] == 300_000_000


def test_company_rule_belongs_to_its_company_and_an_all_rule_outlives_the_holding(client):  # noqa: F811
    test_client, holding_id = client
    _upload(test_client, holding_id, REVENUE + CAPEX + AMORT)
    _accept(test_client, holding_id, "capital expenditure", CAPEX_TAG)
    _accept(test_client, holding_id, "depreciation and amortisation", "ifrs-full:AmortisationExpense")
    db = _db()
    try:
        other = Holding(ticker="OTHER.OL", name="Other ASA", trading_currency="NOK")
        db.add(other)
        db.commit()
        from app.services.tag_rules import rules_for_holding

        applies_here = {r.concept for r in rules_for_holding(db, db.get(Holding, holding_id).id)}
        applies_there = {r.concept for r in rules_for_holding(db, other.id)}
        assert applies_here == {CAPEX_TAG, "ifrs-full:AmortisationExpense"}
        assert applies_there == {"ifrs-full:AmortisationExpense"}  # the company's own tag stays at home

        from app.providers.factory import get_object_storage

        purge_holding(db, app.dependency_overrides[get_object_storage](), db.get(Holding, holding_id), keep_holding=False)
        left = db.query(TagMappingRule).all()
        assert [(r.concept, r.holding_id) for r in left] == [("ifrs-full:AmortisationExpense", None)]
    finally:
        db.close()


def test_re_extract_of_an_unknown_holding_and_a_holding_without_reports(client):  # noqa: F811
    test_client, holding_id = client
    assert test_client.post("/tag-review/re-extract", json={"holding_id": str(uuid4())}).status_code == 404
    body = test_client.post("/tag-review/re-extract", json={"holding_id": holding_id}).json()
    assert body["documents"] == 0 and body["facts_before"] == body["facts_after"] == 0


def test_demo_mode_blocks_every_write_and_hides_the_rules(client):  # noqa: F811
    test_client, holding_id = client
    _upload(test_client, holding_id, REVENUE + CAPEX)
    db = _db()
    try:
        set_demo_mode(db, True)
        db.commit()
    finally:
        db.close()
    assert _accept(test_client, holding_id, "capital expenditure", CAPEX_TAG).status_code == 403
    assert test_client.post("/tag-review/re-extract", json={"holding_id": holding_id}).status_code == 403
    assert test_client.get("/tag-review/rules").json() == {"rules": []}
