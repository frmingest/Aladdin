"""Deterministic historical growth rate — the DCF's base-case growth
assumption, computed from real, sourced values (FinancialLineItem-derived
owner earnings/FCF across periods) rather than guessed (CLAUDE.md Rule 1).
"""
from __future__ import annotations

from collections.abc import Sequence
from dataclasses import dataclass
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


@dataclass(frozen=True)
class RunGrowth:
    """A growth rate measured over the latest unbroken run of profitable years."""

    rate: Decimal
    start_year: int
    end_year: int
    skipped_years: tuple[int, ...]  # older loss-making years left out of the base


def profitable_run_cagr(history: Sequence[tuple[int, Decimal]]) -> RunGrowth:
    """CAGR over the latest unbroken run of strictly positive years.

    `history` is (fiscal year, owner earnings), oldest first. Valuation
    assumptions v3: a company whose earliest filed year is a loss (a ramp-up
    producer, or one bad year) is no longer unrankable because of it. The
    base becomes the first year of the trailing run of profitable years, and
    the years elapsed are the real year difference (a missing filing does not
    shrink the span). Older loss-making years are reported, never papered over.

    Still fails visibly (CLAUDE.md Rule 1) when there is no honest growth rate:
    - the latest year is not profitable (nothing to project from), or
    - only one profitable year ends the series (one point has no growth).
    """
    if len(history) < 2:
        raise ValueError("Cannot compute CAGR: need at least two periods")
    last_year, last_value = history[-1]
    if last_value <= 0:
        raise ValueError(f"Cannot compute CAGR: latest period (FY{last_year}) is not profitable")
    start = len(history) - 1
    while start > 0 and history[start - 1][1] > 0:
        start -= 1
    first_year, first_value = history[start]
    if start == len(history) - 1:
        raise ValueError(
            f"Cannot compute CAGR: only one profitable year on file (FY{last_year}); "
            "a growth rate needs at least two consecutive profitable years"
        )
    years = last_year - first_year
    if years <= 0:
        raise ValueError("Cannot compute CAGR: the profitable periods do not span a full year")
    rate = (last_value / first_value) ** (ONE / Decimal(years)) - ONE
    skipped = tuple(year for year, _v in history[:start])
    return RunGrowth(rate=rate, start_year=first_year, end_year=last_year, skipped_years=skipped)
