"""Unit tests for the Sprint 12 additions to app/services/calculations.py:
daily returns, standard deviation and Pearson correlation — plain
arithmetic checked against known answers, not against another library."""
from decimal import Decimal

import pytest

from app.services.calculations import (
    daily_returns,
    pearson_correlation,
    standard_deviation,
)

D = Decimal


def test_daily_returns_known_values():
    closes = [D("100"), D("110"), D("99")]
    returns = daily_returns(closes)
    assert returns == [D("0.1"), D("-0.1")]


def test_daily_returns_needs_two_prices():
    with pytest.raises(ValueError):
        daily_returns([D("100")])


def test_daily_returns_rejects_non_positive_price():
    with pytest.raises(ValueError):
        daily_returns([D("100"), D("0"), D("50")])


def test_standard_deviation_known_value():
    # Cross-checked against Python's own statistics.stdev (sample stdev,
    # n-1 denominator) rather than a hand-typed constant.
    import statistics

    raw = (2, 4, 4, 4, 5, 5, 7, 9)
    values = [D(v) for v in raw]
    expected = statistics.stdev(raw)
    assert abs(float(standard_deviation(values)) - expected) < 1e-9


def test_pearson_correlation_perfect_positive():
    x = [D("1"), D("2"), D("3"), D("4")]
    y = [D("10"), D("20"), D("30"), D("40")]
    assert round(pearson_correlation(x, y), 6) == D("1")


def test_pearson_correlation_perfect_negative():
    x = [D("1"), D("2"), D("3"), D("4")]
    y = [D("40"), D("30"), D("20"), D("10")]
    assert round(pearson_correlation(x, y), 6) == D("-1")


def test_pearson_correlation_zero_covariance_is_exactly_zero():
    # Constructed so sum((x - mean_x) * (y - mean_y)) is exactly 0: x's
    # deviations from its mean are [-1.5, -0.5, 0.5, 1.5], y's are
    # [1, -1, -1, 1], and their dot product is 0.
    x = [D("1"), D("2"), D("3"), D("4")]
    y = [D("6"), D("4"), D("4"), D("6")]
    assert pearson_correlation(x, y) == D("0")


def test_pearson_correlation_rejects_mismatched_lengths():
    with pytest.raises(ValueError):
        pearson_correlation([D("1"), D("2")], [D("1")])


def test_pearson_correlation_rejects_zero_variance_series():
    with pytest.raises(ValueError):
        pearson_correlation([D("1"), D("1"), D("1")], [D("1"), D("2"), D("3")])
