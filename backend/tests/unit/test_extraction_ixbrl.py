"""Inline-XBRL extraction. The fixture is a small synthetic ESEF-style
filing (same structure as a real ParsePort/Workiva .xhtml: hidden ix:header
with contexts and units, one element per rendered page, tagged numbers with
scale/sign/format) — invented numbers, not a real report."""
from decimal import Decimal

from app.services.documents.extraction.ixbrl import extract_ixbrl

HEAD = """<?xml version="1.0" encoding="utf-8"?>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:ix="http://www.xbrl.org/2013/inlineXBRL"
 xmlns:ixt="http://www.xbrl.org/inlineXBRL/transformation/2022-02-16"
 xmlns:ifrs-full="https://xbrl.ifrs.org/taxonomy/2024-03-27/ifrs-full"
 xmlns:xbrli="http://www.xbrl.org/2003/instance" xmlns:iso4217="http://www.xbrl.org/2003/iso4217"
 xmlns:xbrldi="http://xbrl.org/2006/xbrldi" xmlns:ACME="http://acme.example/2025">
<head><title>ACME ASA</title><style>.x{font-family:Foo}</style></head>
<body>
<div style="display:none"><ix:header><ix:resources>
 <xbrli:context id="fy25"><xbrli:entity><xbrli:identifier scheme="lei">X</xbrli:identifier></xbrli:entity>
  <xbrli:period><xbrli:startDate>2025-01-01</xbrli:startDate><xbrli:endDate>2025-12-31</xbrli:endDate></xbrli:period></xbrli:context>
 <xbrli:context id="fy24"><xbrli:entity><xbrli:identifier scheme="lei">X</xbrli:identifier></xbrli:entity>
  <xbrli:period><xbrli:startDate>2024-01-01</xbrli:startDate><xbrli:endDate>2024-12-31</xbrli:endDate></xbrli:period></xbrli:context>
 <xbrli:context id="i25"><xbrli:entity><xbrli:identifier scheme="lei">X</xbrli:identifier></xbrli:entity>
  <xbrli:period><xbrli:instant>2025-12-31</xbrli:instant></xbrli:period></xbrli:context>
 <xbrli:context id="i24"><xbrli:entity><xbrli:identifier scheme="lei">X</xbrli:identifier></xbrli:entity>
  <xbrli:period><xbrli:instant>2024-12-31</xbrli:instant></xbrli:period></xbrli:context>
 <xbrli:context id="q4"><xbrli:entity><xbrli:identifier scheme="lei">X</xbrli:identifier></xbrli:entity>
  <xbrli:period><xbrli:startDate>2025-10-01</xbrli:startDate><xbrli:endDate>2025-12-31</xbrli:endDate></xbrli:period></xbrli:context>
 <xbrli:context id="i25-seg"><xbrli:entity><xbrli:identifier scheme="lei">X</xbrli:identifier>
  <xbrli:segment><xbrldi:explicitMember dimension="ifrs-full:ComponentsOfEquityAxis">ifrs-full:RetainedEarningsMember</xbrldi:explicitMember></xbrli:segment></xbrli:entity>
  <xbrli:period><xbrli:instant>2025-12-31</xbrli:instant></xbrli:period></xbrli:context>
 <xbrli:unit id="usd"><xbrli:measure>iso4217:USD</xbrli:measure></xbrli:unit>
 <xbrli:unit id="shares"><xbrli:measure>xbrli:shares</xbrli:measure></xbrli:unit>
</ix:resources></ix:header></div>
<div class="pages">
"""


def _nf(name, ctx, value, *, unit="usd", scale="6", sign=None, fmt="ixt:num-dot-decimal"):
    sign_attr = f' sign="{sign}"' if sign else ""
    return (
        f'<ix:nonFraction name="{name}" contextRef="{ctx}" unitRef="{unit}" scale="{scale}"'
        f' decimals="-5" format="{fmt}"{sign_attr}>{value}</ix:nonFraction>'
    )


def _filing(income_rows: str, balance_rows: str, extra_pages: str = "") -> bytes:
    body = (
        HEAD
        + "<div><p>ACME annual report 2025</p><p>Letter from the CEO: a good year.</p></div>\n"
        + "<div><p>Statement of income</p><table>"
        + income_rows
        + "</table></div>\n<div><p>Statement of financial position</p><table>"
        + balance_rows
        + "</table></div>\n"
        + extra_pages
        + "</div></body></html>"
    )
    return body.encode("utf-8")


INCOME = (
    "<tr><td>USD million</td><td>2025</td><td>2024</td></tr>"
    f"<tr><td>Revenue</td><td>{_nf('ifrs-full:Revenue', 'fy25', '8 095.6')}</td>"
    f"<td>{_nf('ifrs-full:Revenue', 'fy24', '7 450.1')}</td></tr>"
    f"<tr><td>Depreciation</td><td>-{_nf('ifrs-full:DepreciationAndAmortisationExpense', 'fy25', '2 710.1')}</td>"
    f"<td>-{_nf('ifrs-full:DepreciationAndAmortisationExpense', 'fy24', '1 915.9')}</td></tr>"
    f"<tr><td>Profit</td><td>{_nf('ifrs-full:ProfitLoss', 'fy25', '846.4')}</td>"
    f"<td>-{_nf('ifrs-full:ProfitLoss', 'fy24', '327.1', sign='-')}</td></tr>"
    f"<tr><td>Q4 revenue</td><td>{_nf('ifrs-full:Revenue', 'q4', '2 190.0')}</td></tr>"
    f"<tr><td>Own KPI</td><td>{_nf('ACME:HybridCoupon', 'fy25', '61.3')}</td></tr>"
)
BALANCE = (
    f"<tr><td>Total assets</td><td>{_nf('ifrs-full:Assets', 'i25', '26 145.3')}</td>"
    f"<td>{_nf('ifrs-full:Assets', 'i24', '21 868.2')}</td></tr>"
    f"<tr><td>Total equity</td><td>{_nf('ifrs-full:Equity', 'i25', '560.0')}</td></tr>"
    f"<tr><td>Retained earnings</td><td>{_nf('ifrs-full:Equity', 'i25-seg', '-280.0')}</td></tr>"
    f"<tr><td>Long-term borrowings</td><td>{_nf('ifrs-full:LongtermBorrowings', 'i25', '5 841.9')}</td></tr>"
    f"<tr><td>Short-term borrowings</td><td>{_nf('ifrs-full:ShorttermBorrowings', 'i25', '100.0')}</td></tr>"
    f"<tr><td>Cash</td><td>{_nf('ifrs-full:CashAndCashEquivalents', 'i25', '699,9', fmt='ixt:num-comma-decimal')}</td></tr>"
)


def _facts(result):
    return {(f.metric, f.period): f for f in result.facts}


def test_tagged_facts_become_annual_metrics_in_full_units():
    result = extract_ixbrl(_filing(INCOME, BALANCE))
    facts = _facts(result)

    assert facts[("revenue", "FY2025")].value == Decimal(8095600000)
    assert facts[("revenue", "FY2025")].unit == "USD"
    assert facts[("revenue", "FY2025")].currency == "USD"
    assert facts[("revenue", "FY2024")].value == Decimal(7450100000)
    assert facts[("net_income", "FY2025")].value == Decimal(846400000)
    # sign="-" is how iXBRL marks a negative value (a loss).
    assert facts[("net_income", "FY2024")].value == Decimal(-327100000)
    # An expense concept is already a positive magnitude.
    assert facts[("depreciation_and_amortization", "FY2025")].value == Decimal(2710100000)
    assert facts[("total_assets", "FY2024")].value == Decimal(21868200000)
    # Comma-decimal format.
    assert facts[("cash_and_equivalents", "FY2025")].value == Decimal(699900000)
    assert all(f.confidence == 1.0 for f in result.facts if f.metric != "total_debt")


def test_dimensional_and_quarterly_facts_are_not_promoted():
    facts = _facts(extract_ixbrl(_filing(INCOME, BALANCE)))
    # The RetainedEarningsMember row (-280) must not replace group equity.
    assert facts[("total_equity", "FY2025")].value == Decimal(560000000)
    # The Q4-only context isn't annual.
    assert {f.period for f in facts.values()} == {"FY2024", "FY2025"}


def test_total_debt_is_derived_from_borrowing_lines_when_no_total_is_tagged():
    fact = _facts(extract_ixbrl(_filing(INCOME, BALANCE)))[("total_debt", "FY2025")]
    assert fact.value == Decimal(5941900000)
    assert fact.confidence < 1.0


def test_facts_cite_the_rendered_page_they_are_tagged_on():
    result = extract_ixbrl(_filing(INCOME, BALANCE))
    facts = _facts(result)
    income_page = facts[("revenue", "FY2025")].source_page
    balance_page = facts[("total_assets", "FY2025")].source_page
    assert income_page == 2 and balance_page == 3
    assert "Statement of income" in result.pages[income_page - 1].text
    assert "Revenue | 8 095.6 | 7 450.1" in result.pages[income_page - 1].text


def test_pages_hold_readable_text_and_a_tagged_facts_page_is_appended():
    result = extract_ixbrl(_filing(INCOME, BALANCE))
    assert "Letter from the CEO" in result.pages[0].text
    assert "font-family" not in "".join(p.text for p in result.pages)
    assert "iso4217" not in result.pages[0].text  # the hidden ix:header isn't page text
    facts_page = result.pages[-1].text
    assert facts_page.startswith("Tagged XBRL facts")
    assert "FY2025 revenue = 8 095 600 000 USD <- ifrs-full:Revenue" in facts_page
    # Company extension concepts are listed for evidence even though unmapped.
    assert "ACME:HybridCoupon" in facts_page
    assert result.details["ixbrl"]["fiscal_years"] == ["FY2025", "FY2024"]


def test_same_concept_and_year_tagged_with_two_values_is_a_conflict():
    income = INCOME + f"<tr><td>dup</td><td>{_nf('ifrs-full:Revenue', 'fy25', '9 000.0')}</td></tr>"
    result = extract_ixbrl(_filing(income, BALANCE))
    facts = _facts(result)
    assert ("revenue", "FY2025") not in facts
    assert ("revenue", "FY2024") in facts
    assert "fact_conflicts" in result.quality_flags


def test_esef_fallback_concept_is_used_only_without_a_revenue_tag():
    income = INCOME.replace("ifrs-full:Revenue\"", "ifrs-full:RevenueAndOperatingIncome\"")
    facts = _facts(extract_ixbrl(_filing(income, BALANCE)))
    assert facts[("revenue", "FY2025")].value == Decimal(8095600000)


def test_plain_html_without_tags_is_text_only():
    content = b"<html><body><div><p>Quarterly letter</p><p>Revenue grew.</p></div></body></html>"
    result = extract_ixbrl(content)
    assert result.facts == []
    assert "no_ixbrl_tags" in result.quality_flags
    assert "Revenue grew." in "\n".join(p.text for p in result.pages)


def test_external_entities_are_not_resolved(tmp_path):
    secret = tmp_path / "secret.txt"
    secret.write_text("TOP-SECRET")
    content = (
        f'<?xml version="1.0"?><!DOCTYPE html [<!ENTITY x SYSTEM "file://{secret}">]>'
        '<html xmlns="http://www.w3.org/1999/xhtml"><body><div><p>a &x; b</p></div></body></html>'
    ).encode()
    result = extract_ixbrl(content)
    assert "TOP-SECRET" not in "".join(p.text for p in result.pages)


# --- mapping rules added 2026-09-23 after validating Vår Energi's real
# FY2025 ESEF filing line by line (values below mirror that filing) -------

VAR_INCOME = (
    f"<tr><td>Petroleum revenues</td><td>{_nf('ifrs-full:RevenueFromSaleOfPetroleumAndPetrochemicalProducts', 'fy25', '7 965.7')}</td></tr>"
    f"<tr><td>Total income</td><td>{_nf('ifrs-full:RevenueAndOperatingIncome', 'fy25', '8 095.6')}</td></tr>"
    f"<tr><td>D&amp;A</td><td>{_nf('ifrs-full:DepreciationAndAmortisationExpense', 'fy25', '2 710.1')}</td></tr>"
    f"<tr><td>Impairment</td><td>{_nf('ifrs-full:ImpairmentLossReversalOfImpairmentLossRecognisedInProfitOrLoss', 'fy25', '550.6', sign='-')}</td></tr>"
    f"<tr><td>Operating profit</td><td>{_nf('ifrs-full:ProfitLossFromOperatingActivities', 'fy25', '4 184.7')}</td></tr>"
    f"<tr><td>Net finance</td><td>{_nf('ifrs-full:FinanceIncomeCost', 'fy25', '310.0', sign='-')}</td></tr>"
    f"<tr><td>Profit before tax</td><td>{_nf('ifrs-full:ProfitLossBeforeTax', 'fy25', '4 306.5')}</td></tr>"
    f"<tr><td>Tax</td><td>{_nf('ifrs-full:IncomeTaxExpenseContinuingOperations', 'fy25', '3 460.1')}</td></tr>"
    f"<tr><td>Profit</td><td>{_nf('ifrs-full:ProfitLoss', 'fy25', '846.4')}</td></tr>"
    f"<tr><td>To ordinary holders</td><td>{_nf('ifrs-full:ProfitLossAttributableToOrdinaryEquityHoldersOfParentEntity', 'fy25', '785.2')}</td></tr>"
    f"<tr><td>Hybrid coupon</td><td>{_nf('ACME:DividendsToHybridCapitalOwners', 'fy25', '61.3')}</td></tr>"
    f"<tr><td>PP&amp;E capex</td><td>{_nf('ifrs-full:PurchaseOfPropertyPlantAndEquipmentClassifiedAsInvestingActivities', 'fy25', '2 456.6')}</td></tr>"
    f"<tr><td>E&amp;E capex</td><td>{_nf('ifrs-full:PurchaseOfExplorationAndEvaluationAssets', 'fy25', '363.1')}</td></tr>"
    f"<tr><td>Interest paid</td><td>{_nf('ifrs-full:InterestPaidClassifiedAsFinancingActivities', 'fy25', '368.6')}</td></tr>"
)
VAR_BALANCE = (
    f"<tr><td>Total assets</td><td>{_nf('ifrs-full:Assets', 'i25', '26 145.3')}</td></tr>"
    f"<tr><td>Hybrid capital</td><td>{_nf('ACME:HybridCapital', 'i25', '799.5')}</td></tr>"
    f"<tr><td>Total equity</td><td>{_nf('ifrs-full:Equity', 'i25', '560.0')}</td></tr>"
    f"<tr><td>Total liabilities</td><td>{_nf('ifrs-full:Liabilities', 'i25', '25 585.4')}</td></tr>"
    f"<tr><td>Total E&amp;L</td><td>{_nf('ifrs-full:EquityAndLiabilities', 'i25', '26 145.3')}</td></tr>"
)


def _var():
    return extract_ixbrl(_filing(VAR_INCOME, VAR_BALANCE))


def test_net_income_is_profit_attributable_to_ordinary_shareholders():
    fact = _facts(_var())[("net_income", "FY2025")]
    assert fact.value == Decimal(785200000)  # not ProfitLoss 846.4 (incl. hybrid coupon)


def test_sector_revenue_line_beats_total_income_with_other_income():
    assert _facts(_var())[("revenue", "FY2025")].value == Decimal(7965700000)


def test_capex_sums_ppe_and_exploration_spend_and_is_marked_derived():
    result = _var()
    fact = _facts(result)[("capital_expenditures", "FY2025")]
    assert fact.value == Decimal(2819700000)
    assert fact.confidence < 1.0
    assert result.details["ixbrl"]["fact_sources"]["FY2025 capital_expenditures"].startswith("derived:")


def test_ebit_is_operating_profit_and_ebitda_excludes_impairment_reversal():
    facts = _facts(_var())
    assert facts[("ebit", "FY2025")].value == Decimal(4184700000)
    # 4 184.7 + 2 710.1 D&A - 550.6 impairment reversal (a non-cash gain)
    assert facts[("ebitda", "FY2025")].value == Decimal(6344200000)
    assert facts[("ebitda", "FY2025")].confidence < 1.0


def test_interest_paid_is_only_a_labelled_proxy_for_interest_expense():
    result = _var()
    fact = _facts(result)[("interest_expense", "FY2025")]
    assert fact.value == Decimal(368600000)
    assert fact.confidence < 0.95
    assert result.details["ixbrl"]["fact_sources"]["FY2025 interest_expense"].startswith("proxy:")


def test_statement_identities_are_checked():
    result = _var()
    checks = result.details["ixbrl"]["integrity_checks"]
    assert checks["failed"] == [] and checks["passed"] >= 3
    broken = VAR_BALANCE.replace("25 585.4", "25 000.0")
    result = extract_ixbrl(_filing(VAR_INCOME, broken))
    assert "integrity_check_failed" in result.quality_flags
    assert any("assets = equity + liabilities" in f for f in result.details["ixbrl"]["integrity_checks"]["failed"])


def test_hybrid_capital_inside_equity_is_flagged_not_silently_reclassified():
    result = _var()
    facts = _facts(result)
    assert facts[("total_equity", "FY2025")].value == Decimal(560000000)  # as reported
    assert "equity_includes_hybrid_capital" in result.quality_flags
    note = result.details["equity_includes_hybrid_capital"][0]
    assert "ACME:HybridCapital" in note and "-239 500 000" in note
    # The coupon (a duration fact) is not mistaken for an equity instrument.
    assert len(result.details["equity_includes_hybrid_capital"]) == 1


# --- owner's-view facts added 2026-09-23 (Buffett/Munger definitions, see
# claude/fy2025-uploads-external-validation-2026-09-23.md) ------------------

OWNER_CASH_FLOW = (
    f"<tr><td>Decommissioning</td><td>{_nf('ACME:PaymentsForRemovalAndDecommissioningOfOilAndGasFieldsClassifiedAsInvestingActivities', 'fy25', '116.4')}</td></tr>"
    f"<tr><td>Lease payments</td><td>{_nf('ifrs-full:PaymentsOfLeaseLiabilitiesClassifiedAsFinancingActivities', 'fy25', '125.6')}</td></tr>"
    f"<tr><td>Hybrid coupon paid</td><td>{_nf('ACME:DividendsPaidToHybridCapitalOwnersClassifiedAsFinancingActivities', 'fy25', '61.3')}</td></tr>"
    f"<tr><td>Hybrid issued</td><td>{_nf('ACME:ProceedsFromIssueOfHybridCapitalClassifiedAsFinancingActivities', 'fy25', '500.0')}</td></tr>"
)


def test_owner_view_cash_outflows_are_extracted_as_positive_facts():
    result = extract_ixbrl(_filing(VAR_INCOME + OWNER_CASH_FLOW, VAR_BALANCE))
    facts = _facts(result)
    assert facts[("decommissioning_payments", "FY2025")].value == Decimal(116400000)
    assert facts[("lease_payments_financing", "FY2025")].value == Decimal(125600000)
    assert facts[("interest_paid_financing", "FY2025")].value == Decimal(368600000)
    # Only the coupon; the issue proceeds are not a distribution.
    assert facts[("hybrid_distributions", "FY2025")].value == Decimal(61300000)
    sources = result.details["ixbrl"]["fact_sources"]
    assert sources["FY2025 decommissioning_payments"].startswith("derived:")


def test_hybrid_capital_is_extracted_as_its_own_fact():
    fact = _facts(_var())[("hybrid_capital", "FY2025")]
    assert fact.value == Decimal(799500000)


def test_interest_paid_extension_lines_are_summed():
    # Salmon Evolution 2025 tags finance costs paid and lease interest as
    # two company-extension lines of the financing section.
    rows = (
        f"<tr><td>Finance costs paid</td><td>{_nf('ACME:FinanceCostsPaidClassifiedAsFinancingActivities', 'fy25', '92.078')}</td></tr>"
        f"<tr><td>Lease interest</td><td>{_nf('ACME:InterestPaidOnLeaseLiabilitiesClassifiedAsFinancingActivities', 'fy25', '2.503')}</td></tr>"
    )
    fact = _facts(extract_ixbrl(_filing(INCOME + rows, BALANCE)))[("interest_paid_financing", "FY2025")]
    assert fact.value == Decimal(94581000)
    assert fact.confidence < 1.0


def test_biological_asset_fair_value_is_taken_out_of_ebit_and_ebitda():
    # Salmon Evolution 2025 (NOK thousand): operating profit -143 276 includes
    # a +15 630 unrealised fair-value gain on the fish; operational EBIT is
    # -158 906 and operational EBITDA -78 685.
    rows = (
        f"<tr><td>D&amp;A</td><td>{_nf('ifrs-full:DepreciationAmortisationAndImpairmentLossReversalOfImpairmentLossRecognisedInProfitOrLoss', 'fy25', '80 221', scale='3')}</td></tr>"
        f"<tr><td>Fair value</td><td>{_nf('ifrs-full:GainsLossesOnFairValueAdjustmentBiologicalAssets', 'fy25', '15 630', scale='3')}</td></tr>"
        f"<tr><td>Operating profit</td><td>{_nf('ifrs-full:ProfitLossFromOperatingActivities', 'fy25', '143 276', scale='3', sign='-')}</td></tr>"
    )
    result = extract_ixbrl(_filing(rows, BALANCE))
    facts = _facts(result)
    assert facts[("ebit", "FY2025")].value == Decimal(-158906000)
    assert facts[("ebitda", "FY2025")].value == Decimal(-78685000)
    # The reported operating profit (used for the operating margin) is unchanged.
    assert facts[("operating_income", "FY2025")].value == Decimal(-143276000)
    assert "BiologicalAssets" in result.details["ixbrl"]["fact_sources"]["FY2025 ebitda"]


# --- ROIC / multiples inputs (2026-09-25) -----------------------------------

EPS_UNIT = (
    '<xbrli:unit id="usdps"><xbrli:divide><xbrli:unitNumerator><xbrli:measure>iso4217:USD'
    "</xbrli:measure></xbrli:unitNumerator><xbrli:unitDenominator><xbrli:measure>xbrli:shares"
    "</xbrli:measure></xbrli:unitDenominator></xbrli:divide></xbrli:unit>"
)
TAX_INCOME = (
    f"<tr><td>Profit before tax</td><td>{_nf('ifrs-full:ProfitLossBeforeTax', 'fy25', '3 313.0')}</td></tr>"
    f"<tr><td>Income tax</td><td>{_nf('ifrs-full:IncomeTaxExpenseContinuingOperations', 'fy25', '2 986.0')}</td></tr>"
    f"<tr><td>Raw materials</td><td>{_nf('ifrs-full:RawMaterialsAndConsumablesUsed', 'fy25', '200.9')}</td></tr>"
    f"<tr><td>EPS</td><td>{_nf('ifrs-full:BasicEarningsLossPerShare', 'fy25', '0.11', unit='usdps', scale='0')}</td></tr>"
)
LEASE_BALANCE = (
    f"<tr><td>Lease current</td><td>{_nf('ifrs-full:CurrentLeaseLiabilities', 'i25', '70.4')}</td></tr>"
    f"<tr><td>Lease non-current</td><td>{_nf('ifrs-full:NoncurrentLeaseLiabilities', 'i25', '141.5')}</td></tr>"
    f"<tr><td>NCI</td><td>{_nf('ifrs-full:NoncontrollingInterests', 'i25', '12.0')}</td></tr>"
)


def _tax_filing():
    content = _filing(INCOME + TAX_INCOME, BALANCE + LEASE_BALANCE).decode()
    return content.replace("</ix:resources>", EPS_UNIT + "</ix:resources>").encode()


def test_tax_and_pre_tax_profit_are_stored_for_the_effective_rate():
    facts = _facts(extract_ixbrl(_tax_filing()))
    assert facts[("income_before_tax", "FY2025")].value == Decimal(3313000000)
    assert facts[("income_tax_expense", "FY2025")].value == Decimal(2986000000)


def test_lease_liabilities_sum_current_and_non_current():
    fact = _facts(extract_ixbrl(_tax_filing()))[("lease_liabilities", "FY2025")]
    assert fact.value == Decimal(211900000)
    assert fact.confidence < 1.0


def test_eps_keeps_its_per_share_unit_and_is_not_scaled():
    fact = _facts(extract_ixbrl(_tax_filing()))[("eps_basic", "FY2025")]
    assert fact.value == Decimal("0.11")
    assert fact.unit == "USD/shares"
    assert fact.currency == "USD"


def test_minorities_and_raw_materials_are_extracted():
    facts = _facts(extract_ixbrl(_tax_filing()))
    assert facts[("minority_interests", "FY2025")].value == Decimal(12000000)
    assert facts[("raw_materials_used", "FY2025")].value == Decimal(200900000)
