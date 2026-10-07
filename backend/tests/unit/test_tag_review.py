"""Tag review (PR 1, 2026-10-07): gaps with ranked candidate tags, and the
largest tagged-but-unused numbers. Read-only: nothing here changes what is
extracted. Synthetic filings (real tag shapes, invented numbers)."""
import json

from app.services.documents.extraction.ixbrl import extract_ixbrl
from tests.unit.test_extraction_ixbrl import _filing, _nf


def _row(label: str, concept: str, ctx: str, value: str, **kw) -> str:
    return f"<tr><td>{label}</td><td>{_nf(concept, ctx, value, **kw)}</td></tr>"


def _both(label: str, concept: str, v25: str, v24: str) -> str:
    return _row(label, concept, "fy25", v25) + _row(label, concept, "fy24", v24)


REVENUE = _both("Revenue", "ifrs-full:Revenue", "1 000.0", "900.0")
ASSETS = _row("Assets", "ifrs-full:Assets", "i25", "5 000.0") + _row("Assets", "ifrs-full:Assets", "i24", "4 800.0")


def _review(income: str, balance: str = ASSETS) -> dict:
    return extract_ixbrl(_filing(income, balance)).details["ixbrl"]["tag_review"]


def _gap(review: dict, metric: str) -> dict | None:
    return next((g for g in review["gaps"] if g["metric"] == metric), None)


def test_review_is_plain_json_and_stored_with_the_extraction():
    result = extract_ixbrl(_filing(REVENUE, ASSETS))
    review = result.details["ixbrl"]["tag_review"]
    assert review["version"] == 1 and review["fiscal_year"] == "FY2025"
    json.dumps(review)  # goes into the document's JSON flags


def test_an_extracted_input_is_not_a_gap():
    review = _review(REVENUE)
    assert _gap(review, "revenue") is None
    assert _gap(review, "total assets") is None
    assert _gap(review, "capital expenditure") is not None  # nothing tagged for it at all


def test_company_extension_capex_is_a_candidate_scoped_to_the_company():
    income = REVENUE + _both("Capex", "ACME:AcquisitionsOfTangibleFixedAssetsInCash", "300.0", "250.0")
    gap = _gap(_review(income), "capital expenditure")
    top = gap["candidates"][0]
    assert top["concept"] == "ACME:AcquisitionsOfTangibleFixedAssetsInCash"
    assert top["extension"] is True and top["suggested_scope"] == "company"
    assert top["value"] == "300000000" or top["value"].replace(" ", "") == "300000000"
    assert top["prior_year_value"] is not None  # also tagged for the prior year


def test_standard_concept_candidate_is_scoped_to_all_companies():
    income = REVENUE + _both("Amortisation", "ifrs-full:AmortisationExpense", "80.0", "70.0")
    top = _gap(_review(income), "depreciation and amortisation")["candidates"][0]
    assert top["concept"] == "ifrs-full:AmortisationExpense"
    assert top["extension"] is False and top["suggested_scope"] == "all"


def _cash_flow(operating: str) -> str:
    return (
        _row("Operating", "ACME:NetCashFromOperatingActivities", "fy25", operating)
        + _row("Investing", "ifrs-full:CashFlowsFromUsedInInvestingActivities", "fy25", "60.0", sign="-")
        + _row("Financing", "ifrs-full:CashFlowsFromUsedInFinancingActivities", "fy25", "10.0", sign="-")
        + _row(
            "Change",
            "ifrs-full:IncreaseDecreaseInCashAndCashEquivalentsBeforeEffectOfExchangeRateChanges",
            "fy25",
            "30.0",
        )
    )


def test_operating_cash_flow_candidate_that_closes_the_cash_flow_statement_ties():
    gap = _gap(_review(REVENUE + _cash_flow("100.0")), "operating cash flow")
    top = gap["candidates"][0]
    assert top["concept"] == "ACME:NetCashFromOperatingActivities"
    assert top["check"] == "ties"


def test_operating_cash_flow_candidate_that_does_not_close_it_is_marked_and_ranked_down():
    gap = _gap(_review(REVENUE + _cash_flow("500.0")), "operating cash flow")
    top = gap["candidates"][0]
    assert top["check"] == "does_not_tie"
    assert top["score"] < 0


def test_lease_payments_are_only_a_gap_when_lease_liabilities_are_tagged():
    leases = _row("Lease liab", "ifrs-full:NoncurrentLeaseLiabilities", "i25", "120.0")
    payment = _row("Lease settled", "ACME:SettlementOfLeaseObligationsClassifiedAsFinancingActivities", "fy25", "40.0")
    assert _gap(_review(REVENUE + payment), "lease payments") is None
    gap = _gap(_review(REVENUE + payment, ASSETS + leases), "lease payments")
    assert gap["candidates"][0]["concept"].endswith("SettlementOfLeaseObligationsClassifiedAsFinancingActivities")


def test_large_unmapped_numbers_are_listed_as_tagged_but_unused_and_small_ones_are_not():
    income = (
        REVENUE
        + _row("Gain on sale", "ACME:GainOnSaleOfBusiness", "fy25", "200.0")
        + _row("Tiny", "ACME:SomeSmallLine", "fy25", "1.0")
    )
    unused = _review(income)["unused"]
    assert [u["concept"] for u in unused] == ["ACME:GainOnSaleOfBusiness"]
    assert unused[0]["share_of_base"] == "20.0%"
    assert unused[0]["extension"] is True


def test_concepts_the_mapping_already_reads_are_never_listed_as_unused():
    income = REVENUE + _both("Profit", "ifrs-full:ProfitLoss", "300.0", "250.0")
    concepts = {u["concept"] for u in _review(income)["unused"]}
    assert "ifrs-full:Revenue" not in concepts and "ifrs-full:ProfitLoss" not in concepts
    assert "ifrs-full:Assets" not in concepts


def test_untagged_file_has_no_review():
    result = extract_ixbrl(b"<html><body><p>plain page</p></body></html>")
    assert "ixbrl" not in result.details
