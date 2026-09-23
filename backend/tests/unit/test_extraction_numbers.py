from decimal import Decimal

import pytest

from app.services.documents.extraction.numbers import (
    PERIOD_ANNUAL,
    PERIOD_EXCLUDED,
    PERIOD_PARTIAL,
    PERIOD_QUARTER,
    classify_period,
    detect_currency,
    detect_scale,
    parse_statement_number,
)


@pytest.mark.parametrize(
    ("raw", "expected"),
    [
        ("2 657 ", Decimal(2657)),
        ("(1 359)", Decimal(-1359)),
        ("-14 762", Decimal(-14762)),
        ("1,234.5", Decimal("1234.5")),
        ("1.234,5", Decimal("1234.5")),
        ("3,471", Decimal(3471)),
        ("0,5", Decimal("0.5")),
        ("- ", Decimal(0)),
        ("–", Decimal(0)),
        (1325, Decimal(1325)),
        ("#REF!", None),
        ("12.5%", None),
        ("", None),
        ("n/a", None),
    ],
)
def test_parse_statement_number(raw, expected):
    assert parse_statement_number(raw) == expected


@pytest.mark.parametrize(
    ("raw", "kind", "year"),
    [
        ("FY 2025", PERIOD_ANNUAL, 2025),
        ("FY25", PERIOD_ANNUAL, 2025),
        ("2025", PERIOD_ANNUAL, 2025),
        ("YTD Q4\n2025", PERIOD_ANNUAL, 2025),
        ("31.12.2024", PERIOD_ANNUAL, 2024),
        ("Q1 2026", PERIOD_QUARTER, 2026),
        ("Q1\n2025", PERIOD_QUARTER, 2025),
        ("1Q26", PERIOD_QUARTER, 2026),
        ("YTD 2026", PERIOD_PARTIAL, 2026),
        ("YTD Q2\n2025", PERIOD_PARTIAL, 2025),
        ("H1 2025", PERIOD_PARTIAL, 2025),
        ("30.06.2025", PERIOD_PARTIAL, 2025),
        ("2026E", PERIOD_EXCLUDED, 2026),
    ],
)
def test_classify_period(raw, kind, year):
    label = classify_period(raw)
    assert label is not None and (label.kind, label.year) == (kind, year)


@pytest.mark.parametrize("raw", ["Unit", "USD million", "Note", "Revenue", "700"])
def test_non_period_cells(raw):
    assert classify_period(raw) is None


def test_annual_canonical_period_matches_edgar_convention():
    assert classify_period("YTD Q4 2025").canonical == "FY2025"


@pytest.mark.parametrize(
    ("text", "scale", "currency"),
    [
        ("USD million", Decimal(10**6), "USD"),
        ("Amounts in NOK million", Decimal(10**6), "NOK"),
        ("MNOK", Decimal(10**6), "NOK"),
        ("NOK 1000", Decimal(10**3), "NOK"),
        ("EUR thousand", Decimal(10**3), "EUR"),
        ("NOK bn", Decimal(10**9), "NOK"),
        ("Nokia sales", None, None),
    ],
)
def test_scale_and_currency(text, scale, currency):
    assert detect_scale(text) == scale
    assert detect_currency(text) == currency
