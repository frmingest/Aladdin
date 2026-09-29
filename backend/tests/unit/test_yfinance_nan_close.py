"""Regression: NaN closes from yfinance must be skipped, not crash the run.

`Decimal('NaN') <= 0` raises decimal.InvalidOperation, which used to surface as
"worker error: decimal.InvalidOperation" on every local-LLM analysis whose
ticker had a missing close.
"""

from decimal import Decimal

import pytest

from app.providers.yfinance_provider import _to_decimal


@pytest.mark.parametrize("raw", [float("nan"), "nan", float("inf"), float("-inf"), None, "abc"])
def test_to_decimal_rejects_non_finite_and_garbage(raw):
    assert _to_decimal(raw) is None


def test_to_decimal_keeps_normal_values():
    assert _to_decimal(12.5) == Decimal("12.5")
    assert _to_decimal("0") == Decimal(0)
