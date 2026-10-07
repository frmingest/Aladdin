"""Tag mapping rules (tag review PR 2): the extractor reads an accepted rule
only after its built-in lists, labels the source, and never overrides a
built-in result. Synthetic filings (real tag shapes, invented numbers)."""
from app.services.documents.extraction.ixbrl import (
    RULE_CONFIDENCE,
    RULE_OVERRIDE_CONFIDENCE,
    MappingRule,
    extract_ixbrl,
)
from app.services.tag_rules import LABEL_TO_METRIC, needs_second_confirmation
from tests.unit.test_extraction_ixbrl import _filing
from tests.unit.test_tag_review import ASSETS, REVENUE, _both, _row

CAPEX = _both("Capex", "ACME:AcquisitionsOfTangibleFixedAssetsInCash", "300.0", "250.0")
RULE = MappingRule("capital_expenditures", "ACME:AcquisitionsOfTangibleFixedAssetsInCash")


def _fact(result, metric, period="FY2025"):
    return next((f for f in result.facts if f.metric == metric and f.period == period), None)


def test_without_a_rule_the_company_tag_is_not_read():
    result = extract_ixbrl(_filing(REVENUE + CAPEX, ASSETS))
    assert _fact(result, "capital_expenditures") is None


def test_an_accepted_rule_fills_the_gap_and_says_so():
    result = extract_ixbrl(_filing(REVENUE + CAPEX, ASSETS), [RULE])
    fact = _fact(result, "capital_expenditures")
    assert fact is not None and fact.value == 300_000_000
    assert fact.confidence == RULE_CONFIDENCE < 1.0
    ixbrl = result.details["ixbrl"]
    assert ixbrl["fact_sources"]["FY2025 capital_expenditures"] == "rule: ACME:AcquisitionsOfTangibleFixedAssetsInCash"
    assert "FY2025 capital_expenditures <- ACME:AcquisitionsOfTangibleFixedAssetsInCash" in ixbrl["rules_applied"]
    # Both years carry the tag, so both years are read.
    assert _fact(result, "capital_expenditures", "FY2024") is not None


def test_the_gap_closes_in_the_tag_review_once_the_rule_is_applied():
    before = extract_ixbrl(_filing(REVENUE + CAPEX, ASSETS)).details["ixbrl"]["tag_review"]
    after = extract_ixbrl(_filing(REVENUE + CAPEX, ASSETS), [RULE]).details["ixbrl"]["tag_review"]
    assert any(g["metric"] == "capital expenditure" for g in before["gaps"])
    assert not any(g["metric"] == "capital expenditure" for g in after["gaps"])


def test_a_rule_that_was_accepted_after_a_failed_check_carries_lower_confidence():
    rule = MappingRule("capital_expenditures", "ACME:AcquisitionsOfTangibleFixedAssetsInCash", check_overridden=True)
    fact = _fact(extract_ixbrl(_filing(REVENUE + CAPEX, ASSETS), [rule]), "capital_expenditures")
    assert fact.confidence == RULE_OVERRIDE_CONFIDENCE < RULE_CONFIDENCE


def test_a_rule_never_overrides_a_built_in_mapping():
    standard = _both("Capex", "ifrs-full:PurchaseOfPropertyPlantAndEquipmentClassifiedAsInvestingActivities", "111.0", "100.0")
    result = extract_ixbrl(_filing(REVENUE + standard + CAPEX, ASSETS), [RULE])
    fact = _fact(result, "capital_expenditures")
    assert fact.value == 111_000_000 and fact.confidence == 1.0
    assert "rule:" not in result.details["ixbrl"]["fact_sources"]["FY2025 capital_expenditures"]
    assert result.details["ixbrl"]["rules_applied"] == []


def test_a_rule_for_a_tag_the_filing_does_not_have_does_nothing():
    other = MappingRule("capital_expenditures", "OTHERCO:SomethingElse")
    result = extract_ixbrl(_filing(REVENUE, ASSETS), [other])
    assert _fact(result, "capital_expenditures") is None


def test_a_rule_for_a_standard_tag_reads_it_in_any_company():
    income = REVENUE + _both("Amortisation", "ifrs-full:AmortisationExpense", "80.0", "70.0")
    rule = MappingRule("depreciation_and_amortization", "ifrs-full:AmortisationExpense")
    fact = _fact(extract_ixbrl(_filing(income, ASSETS), [rule]), "depreciation_and_amortization")
    assert fact is not None and fact.value == 80_000_000


def test_a_monetary_rule_without_a_currency_unit_is_still_refused():
    shares = _row("Capex", "ACME:AcquisitionsOfTangibleFixedAssetsInCash", "fy25", "300.0", unit="shares")
    result = extract_ixbrl(_filing(REVENUE + shares, ASSETS), [RULE])
    assert _fact(result, "capital_expenditures") is None


def test_every_input_the_inbox_lists_has_exactly_one_metric_a_rule_fills():
    assert LABEL_TO_METRIC["total debt"] == "total_debt"
    assert LABEL_TO_METRIC["operating profit (EBIT)"] == "ebit"
    assert LABEL_TO_METRIC["lease payments"] == "lease_payments_financing"
    assert "EBITDA" not in LABEL_TO_METRIC  # derived in code, never one tag


def test_second_confirmation_is_needed_for_a_failed_check_or_an_implausible_size_only():
    assert needs_second_confirmation({"check": "does_not_tie", "warning": None})
    assert needs_second_confirmation({"check": "ties", "warning": "larger than twice revenue"})
    for check in ("ties", "plausible", "no_check"):
        assert not needs_second_confirmation({"check": check, "warning": None})
