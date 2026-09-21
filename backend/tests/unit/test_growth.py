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
