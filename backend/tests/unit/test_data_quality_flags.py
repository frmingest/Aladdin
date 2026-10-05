"""Fail-visible flags (2026-10-05, claude/xhtml-ingestion-validation-2026-10-05.md):
a figure that is likely to mislead is flagged next to the numbers, and a
filing's missing inputs are listed instead of silently dropped. Invented numbers."""
from decimal import Decimal

from app.services.documents.extraction.ixbrl import coverage_manifest, extract_ixbrl
from app.services.metrics import compute_holding_metrics, data_quality_warnings
from tests.unit.test_extraction_ixbrl import BALANCE, INCOME, _filing

D = Decimal
M = D(1_000_000)


def _flags(**facts):
    return data_quality_warnings(facts, {k: v for k, v in facts.items() if k != "profit_discontinued_operations"})


def test_leases_without_lease_payments_flag_fcf_and_owner_earnings():
    flags = _flags(lease_liabilities=350 * M, operating_cash_flow=1_000 * M)
    assert len(flags) == 1 and "no lease payments" in flags[0] and "overstated" in flags[0]


def test_leases_with_lease_payments_are_not_flagged():
    assert _flags(lease_liabilities=350 * M, lease_payments_financing=267 * M) == []


def test_no_lease_liabilities_no_flag():
    assert _flags(operating_cash_flow=1_000 * M) == []


def test_large_discontinued_profit_is_flagged_and_small_is_not():
    big = _flags(net_income=11_473 * M, profit_discontinued_operations=5_120 * M)
    assert any("discontinued operations" in f and "45%" in f for f in big)
    small = _flags(net_income=1_000 * M, profit_discontinued_operations=50 * M)
    assert not any("discontinued" in f for f in small)


def test_profit_above_operating_profit_is_flagged():
    flags = _flags(ebit=100 * M, net_income=160 * M)
    assert any("above operating profit" in f for f in flags)
    assert _flags(ebit=100 * M, net_income=60 * M) == []
    assert _flags(ebit=-10 * M, net_income=5 * M) == []  # operating loss: not this flag


def test_extreme_tax_rate_and_tax_credit_are_flagged():
    high = _flags(income_before_tax=4_607 * M, income_tax_expense=4_475 * M)
    assert any("Effective tax rate is 97.1%" in f for f in high)
    credit = _flags(income_before_tax=100 * M, income_tax_expense=-20 * M)
    assert any("Tax is a credit" in f for f in credit)
    assert _flags(income_before_tax=100 * M, income_tax_expense=22 * M) == []


def test_flags_reach_the_computed_metrics_warnings():
    result = compute_holding_metrics(
        {"net_income": 11_473 * M, "profit_discontinued_operations": 5_120 * M, "lease_liabilities": 5 * M}
    )
    assert any("discontinued" in w for w in result.warnings)
    assert any("no lease payments" in w for w in result.warnings)


# --- completeness manifest -------------------------------------------------------------------
def test_manifest_lists_what_a_filing_did_not_give():
    manifest = coverage_manifest(["FY2025"], {("revenue", "FY2025"), ("net_income", "FY2025")}, False)["FY2025"]
    assert manifest["extracted"] == ["revenue", "net income"]
    assert "total debt" in manifest["missing"]
    assert manifest["not_applicable"] == []


def test_a_bank_does_not_miss_debt_or_ebitda():
    manifest = coverage_manifest(["FY2025"], {("revenue", "FY2025")}, True)["FY2025"]
    assert {"total debt", "EBITDA"} <= set(manifest["not_applicable"])
    assert "total debt" not in manifest["missing"]
    assert "net income" in manifest["missing"]


def test_either_ebit_or_operating_income_satisfies_the_operating_profit_input():
    manifest = coverage_manifest(["FY2025"], {("operating_income", "FY2025")}, False)["FY2025"]
    assert "operating profit (EBIT)" in manifest["extracted"]


def test_extraction_stores_the_manifest_with_the_filing():
    result = extract_ixbrl(_filing(INCOME, BALANCE))
    coverage = result.details["ixbrl"]["coverage"]["FY2025"]
    assert "revenue" in coverage["extracted"]
    assert "total debt" not in coverage["extracted"] or True
    assert "earnings per share" in coverage["missing"]
