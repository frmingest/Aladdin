"""Tag shapes read from the real FY2025 filings on 2026-10-05 (Aker BP, Orkla,
Salmon Evolution, Subsea 7), rebuilt with invented numbers. Each test is a
case where the first extractor version stored nothing or the wrong figure."""
from decimal import Decimal

from app.services.documents.extraction.ixbrl import extract_ixbrl
from app.services.metrics import data_quality_warnings
from tests.unit.test_extraction_ixbrl import _facts, _filing, _nf

D = Decimal
M = D(1_000_000)


def _row(concept, ctx, value, **kw):
    return f"<tr><td>{concept.split(':')[-1]}</td><td>{_nf(concept, ctx, value, **kw)}</td></tr>"


def _run(income="", balance=""):
    return extract_ixbrl(_filing(income, balance))


REV = _row("ifrs-full:Revenue", "fy25", "7 086.3")


def test_lease_interest_is_added_to_the_standard_interest_paid_line():
    # Subsea 7: ifrs-full InterestPaid... (66.3) AND a separate lease-interest line (25.1).
    rows = (
        _row("ifrs-full:InterestPaidClassifiedAsFinancingActivities", "fy25", "66.3")
        + _row("ACME:PaymentsRelatedToLeaseLiabilitiesInterestClassifiedAsFinancingActivities", "fy25", "25.1")
        + _row("ACME:PaymentsRelatedToLeaseLiabilitiesPrincipalClassifiedAsFinancingActivities", "fy25", "266.8")
    )
    result = _run(REV + rows)
    assert _facts(result)[("interest_paid_financing", "FY2025")].value == D("91.4") * M
    assert _facts(result)[("lease_payments_financing", "FY2025")].value == D("266.8") * M


def test_cash_flow_is_checked_against_the_statements_own_change_in_cash():
    flows = (
        _row("ifrs-full:CashFlowsFromUsedInOperations", "fy25", "1 470.7")
        + _row("ifrs-full:CashFlowsFromUsedInInvestingActivities", "fy25", "213.6", sign="-")
        + _row("ifrs-full:CashFlowsFromUsedInFinancingActivities", "fy25", "873.8", sign="-")
    )
    ok = _run(flows + _row("ifrs-full:IncreaseDecreaseInCashAndCashEquivalentsBeforeEffectOfExchangeRateChanges", "fy25", "383.3"))
    assert ok.details["ixbrl"]["integrity_checks"]["failed"] == []
    # A balance-sheet cash that differs by under 2% (overdrafts, restricted cash) is not an error.
    close = _run(flows + _row("ifrs-full:EffectOfExchangeRateChangesOnCashAndCashEquivalents", "fy25", "7.6") + _row("ifrs-full:CashAndCashEquivalents", "i25", "969.7") + _row("ifrs-full:CashAndCashEquivalents", "i24", "575.3"))
    assert close.details["ixbrl"]["integrity_checks"]["failed"] == []
    bad = _run(flows + _row("ifrs-full:IncreaseDecreaseInCashAndCashEquivalentsBeforeEffectOfExchangeRateChanges", "fy25", "300.0"))
    assert any("cash flow adds up" in f for f in bad.details["ixbrl"]["integrity_checks"]["failed"])


def test_ebitda_uses_the_depreciation_proxy_and_adds_back_impairment():
    # Aker BP: only DepreciationExpense is tagged, impairment is a separate line.
    income = (
        REV
        + _row("ifrs-full:ProfitLossFromOperatingActivities", "fy25", "4 759.9")
        + _row("ifrs-full:DepreciationExpense", "fy25", "2 574.0")
        + _row("ifrs-full:ImpairmentLossReversalOfImpairmentLossRecognisedInProfitOrLoss", "fy25", "2 021.4")
    )
    result = _run(income)
    facts = _facts(result)
    assert facts[("ebitda", "FY2025")].value == D("9355.3") * M
    assert facts[("ebitda", "FY2025")].confidence < 1.0
    assert result.details["ixbrl"]["fact_sources"]["FY2025 ebitda"].startswith("proxy:")
    assert facts[("impairment_loss", "FY2025")].value == D("2021.4") * M


def test_profit_before_tax_is_read_from_an_extension_line_and_liabilities_from_the_identity():
    # Orkla: no ifrs-full ProfitLossBeforeTax / Liabilities.
    income = REV + _row("ACME:ProfitLossBeforeTaxContinuingOperations", "fy25", "8 379.0")
    balance = _row("ifrs-full:Assets", "i25", "88 698.0") + _row("ifrs-full:Equity", "i25", "52 147.0")
    facts = _facts(_run(income, balance))
    assert facts[("income_before_tax", "FY2025")].value == 8_379 * M
    assert facts[("total_liabilities", "FY2025")].value == 36_551 * M
    assert facts[("total_liabilities", "FY2025")].confidence < 1.0


def test_a_tagged_liabilities_total_is_never_replaced_by_the_derivation():
    balance = (
        _row("ifrs-full:Assets", "i25", "100.0") + _row("ifrs-full:Equity", "i25", "40.0")
        + _row("ifrs-full:Liabilities", "i25", "60.0")
    )
    fact = _facts(_run(REV, balance))[("total_liabilities", "FY2025")]
    assert fact.value == 60 * M and fact.confidence == 1.0


def test_cost_of_sales_is_revenue_less_a_tagged_gross_profit():
    # Subsea 7: OperatingExpense + an extension gross-profit line, no CostOfSales.
    income = REV + _row("ACME:GrossProfitIncludingOperatingExpenses", "fy25", "1 074.9")
    fact = _facts(_run(income))[("cost_of_goods_sold", "FY2025")]
    assert fact.value == D("6011.4") * M and fact.confidence < 1.0


def test_a_real_cost_of_sales_line_wins_over_the_gross_profit_derivation():
    income = REV + _row("ifrs-full:CostOfSales", "fy25", "6 000.0") + _row("ACME:GrossProfitX", "fy25", "1 086.3")
    assert _facts(_run(income))[("cost_of_goods_sold", "FY2025")].value == 6_000 * M


def test_a_weighted_average_share_count_is_labelled_a_proxy():
    result = _run(REV + _row("ifrs-full:WeightedAverageShares", "fy25", "631.3", unit="shares", scale="6"))
    assert _facts(result)[("shares_outstanding", "FY2025")].confidence < 1.0
    assert result.details["ixbrl"]["fact_sources"]["FY2025 shares_outstanding"].startswith("proxy:")


def test_a_large_impairment_is_flagged():
    flags = data_quality_warnings({"impairment_loss": 2_021 * M, "ebit": 4_760 * M}, {"ebit": 4_760 * M})
    assert any("Impairment of" in f and "42%" in f for f in flags)
    assert data_quality_warnings({"impairment_loss": 10 * M, "ebit": 4_760 * M}, {"ebit": 4_760 * M}) == []
