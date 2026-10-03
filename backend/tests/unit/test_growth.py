"""Unit tests for app.services.valuation.growth — CLAUDE.md Rule 1's
deterministic historical CAGR."""
from decimal import Decimal

import pytest

from app.services.valuation import growth

D = Decimal


def test_historical_cagr_known_answer():
    # 100 -> 110 -> 121 over 2 years is exactly 10% compounded.
    assert growth.historical_cagr([D("100"), D("110"), D("121")]) == D("0.1")


def test_historical_cagr_two_periods_is_one_year():
    assert growth.historical_cagr([D("100"), D("121")]) == D("0.21")


def test_historical_cagr_negative_growth():
    assert growth.historical_cagr([D("100"), D("81")]) == D("-0.19")


def test_historical_cagr_raises_on_single_period():
    with pytest.raises(ValueError, match="at least two periods"):
        growth.historical_cagr([D("100")])


def test_historical_cagr_raises_on_empty():
    with pytest.raises(ValueError, match="at least two periods"):
        growth.historical_cagr([])


def test_historical_cagr_raises_on_non_positive_base():
    with pytest.raises(ValueError, match="earliest period"):
        growth.historical_cagr([D("0"), D("100")])


def test_historical_cagr_raises_on_negative_base():
    with pytest.raises(ValueError, match="earliest period"):
        growth.historical_cagr([D("-50"), D("100")])


def test_historical_cagr_raises_on_non_positive_latest():
    with pytest.raises(ValueError, match="latest period"):
        growth.historical_cagr([D("100"), D("-10")])


# ---------------------------------------------- v3: latest profitable run


def _hist(*pairs):
    return [(year, D(str(value))) for year, value in pairs]


def test_profitable_run_ignores_an_early_loss_year():
    run = growth.profitable_run_cagr(_hist((2021, -50), (2022, 100), (2023, 110), (2024, 121)))
    assert run.rate == D("0.1")
    assert (run.start_year, run.end_year) == (2022, 2024)
    assert run.skipped_years == (2021,)


def test_profitable_run_equals_the_plain_cagr_when_every_year_is_profitable():
    values = [100, 110, 121]
    run = growth.profitable_run_cagr(_hist((2022, 100), (2023, 110), (2024, 121)))
    assert run.rate == growth.historical_cagr([D(str(v)) for v in values])
    assert run.skipped_years == ()


def test_profitable_run_uses_the_trailing_run_after_a_mid_series_loss():
    run = growth.profitable_run_cagr(_hist((2020, 100), (2021, -10), (2022, 100), (2023, 121)))
    assert (run.start_year, run.end_year) == (2022, 2023)
    assert run.rate == D("0.21")
    assert run.skipped_years == (2020, 2021)


def test_profitable_run_counts_real_elapsed_years_when_a_filing_is_missing():
    # 2022 -> 2024 is two years even though only two periods are on file.
    run = growth.profitable_run_cagr(_hist((2022, 100), (2024, 121)))
    assert run.rate == D("0.1")


def test_profitable_run_fails_visibly_when_the_latest_year_is_a_loss():
    with pytest.raises(ValueError, match="FY2024.*not profitable"):
        growth.profitable_run_cagr(_hist((2022, 100), (2023, 90), (2024, -5)))


def test_profitable_run_fails_visibly_with_a_single_profitable_year():
    with pytest.raises(ValueError, match="only one profitable year.*FY2024"):
        growth.profitable_run_cagr(_hist((2022, -30), (2023, -10), (2024, 40)))


def test_profitable_run_needs_two_periods():
    with pytest.raises(ValueError, match="at least two periods"):
        growth.profitable_run_cagr(_hist((2024, 40)))
