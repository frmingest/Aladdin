"""Owner-basis fixes found when the FY2025 ESEF filings were checked against
the annual reports (2026-10-05, claude/xhtml-ingestion-validation-2026-10-05.md):

- H1 Orkla: profit from DISCONTINUED operations (a sold business) sat inside
  net income, inflating owner earnings, P/E, ROE and the DCF growth base.
- H2 Orkla: only total equity (incl. minorities) was tagged, so minorities
  were counted twice in invested capital and EV.
- H3 Subsea 7: lease principal and lease interest are financing outflows the
  extractor missed, so free cash flow was overstated.
- The cash flow must tie to the change in cash.

Numbers are invented but keep the real shapes (profit 12 057 = continuing
6 937 + discontinued 5 120). No real document is committed."""
from decimal import Decimal

from app.services.documents.extraction.ixbrl import extract_ixbrl
from app.services.metrics import compute_holding_metrics, owner_earnings_from_facts
from tests.unit.test_extraction_ixbrl import _facts, _filing, _nf

D = Decimal
M = D(1_000_000)


def _row(concept: str, ctx: str, value: str, **kw) -> str:
    return f"<tr><td>{concept.split(':')[-1]}</td><td>{_nf(concept, ctx, value, **kw)}</td></tr>"


ORKLA_INCOME = "".join(
    [
        _row("ifrs-full:Revenue", "fy25", "71 044.0"),
        _row("ifrs-full:ProfitLossFromOperatingActivities", "fy25", "7 086.0"),
        _row("ifrs-full:ProfitLossBeforeTax", "fy25", "8 379.0"),
        _row("ifrs-full:IncomeTaxExpenseContinuingOperations", "fy25", "1 442.0"),
        _row("ifrs-full:ProfitLossFromContinuingOperations", "fy25", "6 937.0"),
        _row("ifrs-full:ProfitLossFromDiscontinuedOperations", "fy25", "5 120.0"),
        _row("ifrs-full:ProfitLoss", "fy25", "12 057.0"),
        _row("ifrs-full:ProfitLossAttributableToNoncontrollingInterests", "fy25", "584.0"),
        _row("ifrs-full:ProfitLossAttributableToOwnersOfParent", "fy25", "11 473.0"),
        _row("ifrs-full:DepreciationAndAmortisationExpense", "fy25", "2 732.0"),
    ]
)
# Only TOTAL equity is tagged (no owners' concept) plus the minorities' share.
ORKLA_BALANCE = "".join(
    [
        _row("ifrs-full:Assets", "i25", "88 698.0"),
        _row("ifrs-full:Equity", "i25", "52 147.0"),
        _row("ifrs-full:NoncontrollingInterests", "i25", "3 483.0"),
        _row("ifrs-full:CashAndCashEquivalents", "i25", "2 044.0"),
    ]
)


def _orkla():
    return extract_ixbrl(_filing(ORKLA_INCOME, ORKLA_BALANCE))


# --- H1: discontinued operations ------------------------------------------------------------------
def test_discontinued_and_continuing_profit_are_extracted_signed():
    facts = _facts(_orkla())
    assert facts[("profit_discontinued_operations", "FY2025")].value == 5_120 * M
    assert facts[("profit_continuing_operations", "FY2025")].value == 6_937 * M
    # Reported net income to the owners is untouched: it is what the filing says.
    assert facts[("net_income", "FY2025")].value == 11_473 * M


def test_continuing_profit_is_derived_when_only_the_discontinued_line_is_tagged():
    income = ORKLA_INCOME.replace("ProfitLossFromContinuingOperations", "ACME:Other")
    facts = _facts(extract_ixbrl(_filing(income, ORKLA_BALANCE)))
    fact = facts[("profit_continuing_operations", "FY2025")]
    assert fact.value == 6_937 * M  # 12 057 - 5 120
    assert fact.confidence < 1.0


def test_owner_earnings_leave_out_discontinued_profit():
    facts = {
        "net_income": 11_473 * M,
        "profit_discontinued_operations": 5_120 * M,
        "depreciation_and_amortization": 2_732 * M,
        "capital_expenditures": 2_551 * M,
    }
    value, note = owner_earnings_from_facts(facts)
    assert value == (6_353 + 2_732 - 2_551) * M
    assert "discontinued operations" in note


def test_without_a_discontinued_fact_nothing_changes():
    facts = {"net_income": 100 * M, "depreciation_and_amortization": 10 * M, "capital_expenditures": 12 * M}
    assert owner_earnings_from_facts(facts) == (98 * M, None)


def test_a_discontinued_loss_is_added_back_to_continuing_profit():
    facts = {
        "net_income": 80 * M,
        "profit_discontinued_operations": -20 * M,
        "depreciation_and_amortization": 10 * M,
        "capital_expenditures": 10 * M,
    }
    assert owner_earnings_from_facts(facts)[0] == 100 * M


def test_net_margin_roe_and_pe_use_continuing_profit_and_say_so():
    facts = {
        "revenue": 71_044 * M,
        "net_income": 11_473 * M,
        "profit_discontinued_operations": 5_120 * M,
        "total_equity": 48_664 * M,
        "total_assets": 88_698 * M,
        "depreciation_and_amortization": 2_732 * M,
        "capital_expenditures": 2_551 * M,
    }
    result = compute_holding_metrics(facts)
    assert result.computed["net_margin"] == D(6_353) / D(71_044)
    assert result.computed["roe"] == D(6_353) / D(48_664)
    assert "discontinued" in result.notes["net_margin"]
    assert "discontinued" in result.notes["roe"]
    assert "discontinued" in result.notes["owner_earnings"]
    assert result.notes["owner_earnings"].count("discontinued operations of") == 1  # never applied twice


# --- H2: owners' equity vs total equity -----------------------------------------------------------
def test_total_equity_is_the_owners_share_when_only_total_equity_is_tagged():
    result = _orkla()
    fact = _facts(result)[("total_equity", "FY2025")]
    assert fact.value == (52_147 - 3_483) * M == 48_664 * M
    assert fact.confidence < 1.0
    assert result.details["ixbrl"]["fact_sources"]["FY2025 total_equity"] == (
        "derived: ifrs-full:Equity - ifrs-full:NoncontrollingInterests"
    )
    # The minorities stay a fact of their own, so invested capital counts them once.
    assert _facts(result)[("minority_interests", "FY2025")].value == 3_483 * M


def test_an_owners_equity_tag_is_used_as_is():
    balance = ORKLA_BALANCE + _row("ifrs-full:EquityAttributableToOwnersOfParent", "i25", "48 664.0")
    fact = _facts(extract_ixbrl(_filing(ORKLA_INCOME, balance)))[("total_equity", "FY2025")]
    assert fact.value == 48_664 * M and fact.confidence == 1.0


def test_total_equity_without_minorities_is_unchanged():
    balance = ORKLA_BALANCE.replace("NoncontrollingInterests", "ACME:Other")
    fact = _facts(extract_ixbrl(_filing(ORKLA_INCOME, balance)))[("total_equity", "FY2025")]
    assert fact.value == 52_147 * M and fact.confidence == 1.0


# --- H3: Subsea 7 lease payments --------------------------------------------------------------------
SUBSEA_CASH = "".join(
    [
        _row("ifrs-full:Revenue", "fy25", "7 086.3"),
        _row("ifrs-full:ProfitLoss", "fy25", "404.2"),
        _row("ifrs-full:CashFlowsFromUsedInOperations", "fy25", "1 470.7"),
        _row("ifrs-full:CashFlowsFromUsedInInvestingActivities", "fy25", "213.6", sign="-"),
        _row("ifrs-full:CashFlowsFromUsedInFinancingActivities", "fy25", "873.8", sign="-"),
        _row("ACME:RepaymentsOfLeaseLiabilitiesClassifiedAsFinancingActivities", "fy25", "266.8"),
        _row("ACME:InterestPaidOnLeaseLiabilitiesClassifiedAsFinancingActivities", "fy25", "25.1"),
        _row("ACME:RepaymentsOfBorrowingsClassifiedAsFinancingActivities", "fy25", "500.0"),
    ]
)
SUBSEA_BALANCE = "".join(
    [
        _row("ifrs-full:CashAndCashEquivalents", "i25", "969.7"),
        _row("ifrs-full:CashAndCashEquivalents", "i24", "586.4"),
    ]
)


def test_lease_principal_and_interest_are_captured_and_borrowing_repayments_are_not():
    facts = _facts(extract_ixbrl(_filing(SUBSEA_CASH, SUBSEA_BALANCE)))
    assert facts[("lease_payments_financing", "FY2025")].value == D("266.8") * M
    assert facts[("interest_paid_financing", "FY2025")].value == D("25.1") * M


def test_free_cash_flow_deducts_the_captured_lease_cash():
    facts = {
        "operating_cash_flow": D("1470.7") * M,
        "capital_expenditures": 281 * M,
        "lease_payments_financing": D("266.8") * M,
        "interest_paid_financing": D("25.1") * M,
    }
    result = compute_holding_metrics(facts)
    assert result.computed["free_cash_flow"] == D("897.8") * M  # 1470.7 - 281 - 266.8 - 25.1


# --- cash tie -----------------------------------------------------------------------------------------
def test_cash_flow_that_ties_to_the_change_in_cash_passes():
    checks = extract_ixbrl(_filing(SUBSEA_CASH, SUBSEA_BALANCE)).details["ixbrl"]["integrity_checks"]
    assert checks["failed"] == []
    assert checks["passed"] >= 1


def test_cash_flow_that_does_not_tie_is_reported_never_hidden():
    wrong = SUBSEA_BALANCE.replace("586.4", "700.0")
    result = extract_ixbrl(_filing(SUBSEA_CASH, wrong))
    failed = result.details["ixbrl"]["integrity_checks"]["failed"]
    assert any("cash flow ties to the change in cash" in f for f in failed)
    assert "integrity_check_failed" in result.quality_flags
