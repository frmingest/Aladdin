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

    assert facts[("revenue", "FY2025")].value == Decimal("8095600000")
    assert facts[("revenue", "FY2025")].unit == "USD"
    assert facts[("revenue", "FY2025")].currency == "USD"
    assert facts[("revenue", "FY2024")].value == Decimal("7450100000")
    assert facts[("net_income", "FY2025")].value == Decimal("846400000")
    # sign="-" is how iXBRL marks a negative value (a loss).
    assert facts[("net_income", "FY2024")].value == Decimal("-327100000")
    # An expense concept is already a positive magnitude.
    assert facts[("depreciation_and_amortization", "FY2025")].value == Decimal("2710100000")
    assert facts[("total_assets", "FY2024")].value == Decimal("21868200000")
    # Comma-decimal format.
    assert facts[("cash_and_equivalents", "FY2025")].value == Decimal("699900000")
    assert all(f.confidence == 1.0 for f in result.facts if f.metric != "total_debt")


def test_dimensional_and_quarterly_facts_are_not_promoted():
    facts = _facts(extract_ixbrl(_filing(INCOME, BALANCE)))
    # The RetainedEarningsMember row (-280) must not replace group equity.
    assert facts[("total_equity", "FY2025")].value == Decimal("560000000")
    # The Q4-only context isn't annual.
    assert {f.period for f in facts.values()} == {"FY2024", "FY2025"}


def test_total_debt_is_derived_from_borrowing_lines_when_no_total_is_tagged():
    fact = _facts(extract_ixbrl(_filing(INCOME, BALANCE)))[("total_debt", "FY2025")]
    assert fact.value == Decimal("5941900000")
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
    assert facts[("revenue", "FY2025")].value == Decimal("8095600000")


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
