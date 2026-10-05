"""Total debt, bank detection, the 'closest tags' report and the XHTML repair
for inline-XBRL filings (2026-10-05).

Built from the real tag structures seen in eight FY2024/FY2025 ESEF filings
(Aker BP: bonds only; Orkla: one line that bundles borrowings and leases;
Subsea 7 / Telenor / Mowi / Vår Energi: standard borrowings; SpareBank 1: a
bank; Salmon Evolution: CSS that is not valid XML). Numbers are invented and
no real document is committed."""
from decimal import Decimal

from app.services.documents.extraction.ixbrl import (
    DEBT_UNRECONCILED_CONFIDENCE,
    LEASES_INCLUDED_NOTE,
    extract_ixbrl,
)
from tests.unit.test_extraction_ixbrl import HEAD, INCOME, _facts, _filing, _nf


def _bs(*rows: tuple[str, str, str]) -> str:
    """Balance-sheet rows (concept, context, value) in document order."""
    return "".join(
        f"<tr><td>{concept.split(':')[-1]}</td><td>{_nf(concept, ctx, value)}</td></tr>"
        for concept, ctx, value in rows
    )


def _debt(result, period="FY2025"):
    fact = _facts(result).get(("total_debt", period))
    return fact


# --- Aker BP shape: bonds are the only borrowing line on the face ------------------------------
BONDS = _bs(
    ("ifrs-full:Equity", "i25", "1 000.0"),
    ("ifrs-full:DeferredTaxLiabilities", "i25", "1 600.0"),
    ("ifrs-full:LongtermProvisionForDecommissioningRestorationAndRehabilitationCosts", "i25", "450.0"),
    ("ifrs-full:NoncurrentPortionOfNoncurrentBondsIssued", "i25", "830.0"),
    ("ifrs-full:NoncurrentLeaseLiabilities", "i25", "70.0"),
    ("ifrs-full:NoncurrentLiabilities", "i25", "2 950.0"),
    ("ifrs-full:CurrentBondsIssuedAndCurrentPortionOfNoncurrentBondsIssued", "i25", "30.0"),
    ("ifrs-full:CurrentTaxLiabilitiesCurrent", "i25", "105.0"),
    ("ifrs-full:CurrentLeaseLiabilities", "i25", "35.0"),
    ("ifrs-full:CurrentLiabilities", "i25", "170.0"),
    ("ifrs-full:Liabilities", "i25", "3 120.0"),
)


def test_bonds_count_as_debt_and_leases_stay_out():
    fact = _debt(extract_ixbrl(_filing(INCOME, BONDS)))
    assert fact.value == Decimal(860_000_000)  # 830 + 30, not the 105 of leases
    assert fact.confidence == 0.95  # both sides of the liabilities reconcile
    assert fact.unit == "USD"


def test_lone_noncurrent_borrowings_line_is_summed_with_the_current_line():
    # Used to be taken alone (half the debt) because it sat in the single-tag list.
    rows = _bs(
        ("ifrs-full:NoncurrentPortionOfNoncurrentBorrowings", "i25", "700.0"),
        ("ifrs-full:CurrentPortionOfLongtermBorrowings", "i25", "50.0"),
    )
    assert _debt(extract_ixbrl(_filing(INCOME, rows))).value == Decimal(750_000_000)


def test_a_tagged_total_beats_its_parts():
    rows = _bs(
        ("ifrs-full:Borrowings", "i25", "900.0"),
        ("ifrs-full:LongtermBorrowings", "i25", "800.0"),
        ("ifrs-full:ShorttermBorrowings", "i25", "100.0"),
    )
    fact = _debt(extract_ixbrl(_filing(INCOME, rows)))
    assert fact.value == Decimal(900_000_000)
    assert fact.confidence == 1.0


# --- Orkla shape: one extension line bundles borrowings and leases ---------------------------------
BUNDLED = _bs(
    ("ifrs-full:Equity", "i25", "5 000.0"),
    ("ACME:LongTermBorrowingsAndNonCurrentLeaseLiabilities", "i25", "1 500.0"),
    ("ifrs-full:DeferredTaxLiabilities", "i25", "260.0"),
    ("ifrs-full:NoncurrentLiabilities", "i25", "1 760.0"),
    ("ACME:ShortTermBorrowingsAndCurrentLeaseLiabilities", "i25", "180.0"),
    ("ifrs-full:CurrentLiabilities", "i25", "180.0"),
)


def test_bundled_borrowings_and_leases_is_stored_with_a_plain_note():
    result = extract_ixbrl(_filing(INCOME, BUNDLED))
    fact = _debt(result)
    assert fact.value == Decimal(1_680_000_000)
    assert fact.confidence == DEBT_UNRECONCILED_CONFIDENCE
    source = result.details["ixbrl"]["fact_sources"]["FY2025 total_debt"]
    assert LEASES_INCLUDED_NOTE in source
    assert any(LEASES_INCLUDED_NOTE in n and n.startswith("FY2025") for n in result.details["ixbrl"]["notes"])
    # No separate lease line is invented, so nothing is counted twice.
    assert ("lease_liabilities", "FY2025") not in _facts(result)


def test_pure_borrowings_win_over_a_bundled_line():
    rows = BUNDLED + _bs(("ifrs-full:LongtermBorrowings", "i25", "400.0"))
    assert _debt(extract_ixbrl(_filing(INCOME, rows))).value == Decimal(400_000_000)


# --- what is NOT debt -----------------------------------------------------------------------------
def test_derivatives_payables_and_provisions_are_not_debt_and_the_gap_is_reported():
    rows = _bs(
        ("ifrs-full:NoncurrentDerivativeFinancialLiabilities", "i25", "20.0"),
        ("ifrs-full:TradeAndOtherCurrentPayablesToTradeSuppliers", "i25", "70.0"),
        ("ifrs-full:CurrentLeaseLiabilities", "i25", "35.0"),
        ("ACME:FundingFromOwners", "i25", "5.0"),
    )
    result = extract_ixbrl(_filing(INCOME, rows))
    assert _debt(result) is None
    closest = result.details["ixbrl"]["unmapped_candidates"]["FY2025"]["total_debt"]
    # Leases are the nearest thing to debt on this face: shown, not stored.
    assert {"concept": "ifrs-full:CurrentLeaseLiabilities", "value": "35 000 000", "unit": "USD"} in closest


def test_a_debt_sum_larger_than_total_liabilities_is_rejected():
    rows = _bs(
        ("ifrs-full:LongtermBorrowings", "i25", "900.0"),
        ("ifrs-full:Liabilities", "i25", "300.0"),
    )
    assert _debt(extract_ixbrl(_filing(INCOME, rows))) is None


def test_unreconciled_balance_sheet_lowers_confidence_for_a_new_concept_and_says_so():
    rows = _bs(
        ("ifrs-full:Equity", "i25", "100.0"),
        ("ifrs-full:NoncurrentPortionOfNoncurrentBondsIssued", "i25", "830.0"),
        ("ifrs-full:NoncurrentLiabilities", "i25", "2 000.0"),  # lines do not add up
    )
    result = extract_ixbrl(_filing(INCOME, rows))
    fact = _debt(result)
    assert fact.confidence == DEBT_UNRECONCILED_CONFIDENCE
    assert "could not be reconciled" in result.details["ixbrl"]["fact_sources"]["FY2025 total_debt"]


# --- banks ---------------------------------------------------------------------------------------------
BANK = _bs(
    ("ifrs-full:LoansAndAdvancesToCustomers", "i25", "3 900.0"),
    ("ifrs-full:DepositsFromCustomersAtAmortisedCost", "i25", "2 300.0"),
    ("ifrs-full:DebtSecurities", "i25", "1 800.0"),
    ("ACME:SubordinatedDebt", "i25", "220.0"),
)


def test_a_bank_gets_no_debt_figure_and_is_flagged():
    result = extract_ixbrl(_filing(INCOME, BANK))
    assert _debt(result) is None
    assert "reporting_bank" in result.quality_flags
    assert result.details["ixbrl"]["reporting_bank"] is True
    # Nothing to chase: the gap is by design, so no 'closest tags' entry either.
    assert "total_debt" not in (result.details["ixbrl"]["unmapped_candidates"].get("FY2025") or {})


def test_an_industrial_company_is_not_flagged_as_a_bank():
    result = extract_ixbrl(_filing(INCOME, BONDS))
    assert "reporting_bank" not in result.quality_flags
    assert result.details["ixbrl"]["reporting_bank"] is False


# --- the 'closest tags' report ------------------------------------------------------------------------
def test_missing_d_and_a_lists_the_nearest_tagged_lines():
    income = (
        "<tr><td>Own D&A</td><td>" + _nf("ACME:AmortisationOfLicences", "fy25", "12.0") + "</td></tr>"
        + "<tr><td>Revenue</td><td>" + _nf("ifrs-full:Revenue", "fy25", "100.0") + "</td></tr>"
    )
    result = extract_ixbrl(_filing(income, BONDS))
    assert ("depreciation_and_amortization", "FY2025") not in _facts(result)
    rows = result.details["ixbrl"]["unmapped_candidates"]["FY2025"]["depreciation_and_amortization"]
    assert rows[0]["concept"] == "ACME:AmortisationOfLicences"


# --- parsing --------------------------------------------------------------------------------------------------
def test_css_that_is_not_valid_xml_does_not_lose_the_filing():
    # Salmon Evolution 2025: '<=' inside a media query made the file invalid XML,
    # and the fallback parser then found no contexts at all.
    broken = _filing(INCOME, BONDS).replace(
        b".x{font-family:Foo}", b".x{font-family:Foo}@media (width>=550px) and (height<=490px){.y{top:0}}"
    )
    assert b"height<=490px" in broken
    result = extract_ixbrl(broken)
    clean = extract_ixbrl(_filing(INCOME, BONDS))
    assert "no_ixbrl_tags" not in result.quality_flags
    assert {(f.metric, f.period, f.value) for f in result.facts} == {
        (f.metric, f.period, f.value) for f in clean.facts
    }


def test_bare_ampersand_in_the_text_is_repaired_too():
    broken = _filing(INCOME, BONDS).replace(b"ACME annual report 2025", b"ACME R&D annual report 2025")
    result = extract_ixbrl(broken)
    assert _debt(result).value == Decimal(860_000_000)


def test_tagged_numbers_without_readable_contexts_is_reported_as_unreadable_not_untagged():
    # Strip the contexts: tags exist but cannot be placed in time.
    stripped = _filing(INCOME, BONDS)
    start, end = stripped.index(b"<ix:header>"), stripped.index(b"</ix:header>") + len(b"</ix:header>")
    result = extract_ixbrl(stripped[:start] + stripped[end:])
    assert "ixbrl_tags_unreadable" in result.quality_flags
    assert "no_ixbrl_tags" not in result.quality_flags


def test_plain_html_without_tags_is_still_reported_as_untagged():
    html = HEAD.split("<body>")[0].encode() + b"<body><p>Revenue 100</p></body></html>"
    assert "no_ixbrl_tags" in extract_ixbrl(html).quality_flags
