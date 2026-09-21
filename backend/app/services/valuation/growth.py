"""Deterministic historical growth rate — the DCF's base-case growth
assumption, computed from real, sourced values (FinancialLineItem-derived
owner earnings/FCF across periods) rather than guessed (CLAUDE.md Rule 1).
"""
from __future__ import annotations

from collections.abc import Sequence
from decimal import Decimal

ONE = Decimal(1)


def historical_cagr(values: Sequence[Decimal]) -> Decimal:
    """Compound annual growth rate across `values`, oldest first — one
    value per period (matching FinancialLineItem.period's yearly cadence).

    Raises ValueError (CLAUDE.md: fail visibly, never guess) when:
    - fewer than two periods are given (no growth to compute),
    - the earliest period's value isn't strictly positive (a CAGR from a
      loss-making or zero base is undefined, not silently zero), or
    - the sign flips between the earliest and latest period (a positive-
      to-negative or negative-to-positive swing has no meaningful CAGR).
    """
    if len(values) < 2:
        raise ValueError("Cannot compute CAGR: need at least two periods")
    first, last = values[0], values[-1]
    if first <= 0:
        raise ValueError("Cannot compute CAGR: earliest period's value is not positive")
    if last <= 0:
        raise ValueError("Cannot compute CAGR: latest period's value is not positive")
    years = len(values) - 1
    ratio = last / first
    return ratio ** (ONE / Decimal(years)) - ONE
