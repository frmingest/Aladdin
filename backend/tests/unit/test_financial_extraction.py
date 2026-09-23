"""Unit tests for the deterministic parts of LLM-assisted financial
extraction: number parsing, statement-page selection and verification."""
from __future__ import annotations

from decimal import Decimal

import pytest

from app.services.documents.financial_extraction import (
    ProposedFact,
    parse_printed_number,
    select_statement_pages,
    verify_facts,
)

D = Decimal

INCOME_PAGE = """Consolidated statement of income
(USD million) Note 2025 2024
Total revenues 3 7,873 7,583
Production costs 4 (1,284) (1,102)
Depreciation, amortisation and impairment (2,511) (2,207)
Operating profit 3,112 3,457
Net profit/loss for the year 1,006 841
"""
BALANCE_PAGE = """Consolidated statement of financial position
(USD million) 31.12.2025 31.12.2024
Total assets 26 410 24 118
Total equity 4 172 3 905
Total liabilities 22 238 20 213
Cash and cash equivalents 318 403
"""
CASH_PAGE = """Consolidated statement of cash flows
(USD million) 2025 2024
Net cash flow from operating activities 4 850 4 512
Investment in oil and gas assets (3 911) (3 600)
Net cash flow used in investing activities (3 990) (3 700)
Net cash flow used in financing activities (950) (700)
"""
CONTENTS_PAGE = """Contents
Consolidated statement of income 45
Consolidated statement of financial position 46
Consolidated statement of cash flows 48
"""
NOTE_PAGE = "Note 12 Borrowings\nThe group has total assets pledged ... 12 13 14"


@pytest.mark.parametrize(
    ("raw", "expected"),
    [
        ("7,873", D("7873")),
        ("(1,284)", D("-1284")),
        ("26 410", D("26410")),
        ("26 410", D("26410")),
        ("-841", D("-841")),
        ("−841", D("-841")),
        ("1,234.5", D("1234.5")),
        ("1.234,5", D("1234.5")),
        ("12.5", D("12.5")),
        ("2 499 842 131", D("2499842131")),
        ("n/a", None),
        ("", None),
    ],
)
def test_parse_printed_number(raw, expected):
    assert parse_printed_number(raw) == expected


def test_selects_the_three_statements_and_skips_contents_and_notes():
    pages = [(3, CONTENTS_PAGE), (45, INCOME_PAGE), (46, BALANCE_PAGE), (48, CASH_PAGE), (70, NOTE_PAGE)]
    assert select_statement_pages(pages) == [45, 46, 48]


def test_selects_nothing_from_a_report_without_statements():
    assert select_statement_pages([(1, "Letter from the CEO. We had a great year."), (2, NOTE_PAGE)]) == []


def _fact(**kw) -> ProposedFact:
    base = {
        "metric": "revenue", "fiscal_year": 2025, "value_as_printed": "7,873", "scale": "millions",
        "currency": "USD", "source_page": 45, "label_as_printed": "Total revenues",
    }
    base.update(kw)
    return ProposedFact(**base)


PAGES = {45: INCOME_PAGE, 46: BALANCE_PAGE, 48: CASH_PAGE}


def _verify(*facts, existing=None, year=2025):
    return verify_facts(list(facts), page_texts=PAGES, document_year=year, existing=existing or {})


def test_verified_fact_is_scaled_in_code():
    (fact,) = _verify(_fact())
    assert fact.status == "verified"
    assert fact.stored_value == D("7873000000")
    assert fact.stored_unit == "USD"
    assert fact.period == "FY2025"


def test_number_not_on_the_cited_page_is_rejected():
    (fact,) = _verify(_fact(value_as_printed="7,874"))
    assert fact.status == "rejected"
    assert "does not appear on page 45" in fact.reasons[0]


def test_number_from_another_page_is_rejected():
    (fact,) = _verify(_fact(value_as_printed="26 410", source_page=45, metric="total_assets"))
    assert fact.status == "rejected"


def test_page_not_sent_is_rejected():
    (fact,) = _verify(_fact(source_page=99))
    assert fact.status == "rejected" and "wasn't one of the pages read" in fact.reasons[0]


def test_expense_metrics_stored_as_positive_magnitudes():
    (capex,) = _verify(
        _fact(metric="capital_expenditures", value_as_printed="(3 911)", source_page=48,
              label_as_printed="Investment in oil and gas assets")
    )
    assert capex.status == "verified" and capex.stored_value == D("3911000000")


def test_losses_keep_their_sign():
    page = {45: INCOME_PAGE + "Net loss for the year (120) 55\n"}
    (fact,) = verify_facts(
        [_fact(metric="net_income", value_as_printed="(120)", label_as_printed="Net loss for the year")],
        page_texts=page, document_year=2025, existing={},
    )
    assert fact.stored_value == D("-120000000")


def test_year_outside_document_window_is_rejected():
    (fact,) = _verify(_fact(fiscal_year=2017))
    assert fact.status == "rejected" and "outside" in fact.reasons[0]


def test_existing_fact_from_another_document_is_a_conflict():
    (fact,) = _verify(_fact(), existing={("revenue", 2025): (D("1"), "edgar.json")})
    assert fact.status == "conflict" and "edgar.json" in fact.reasons[0]


def test_second_proposal_for_same_metric_year_is_a_duplicate():
    first, second = _verify(_fact(), _fact(value_as_printed="7,583"))
    assert first.status == "verified" and second.status == "duplicate"


def test_shares_have_no_currency_and_label_mismatch_only_warns():
    page = {45: INCOME_PAGE + "Weighted average number of shares 2 499 842 131\n"}
    (fact,) = verify_facts(
        [_fact(metric="shares_outstanding", value_as_printed="2 499 842 131", scale="units",
               currency="USD", label_as_printed="Shares, weighted")],
        page_texts=page, document_year=2025, existing={},
    )
    assert fact.status == "verified"
    assert fact.currency is None and fact.stored_unit == "shares"
    assert any("label not found" in w for w in fact.warnings)
