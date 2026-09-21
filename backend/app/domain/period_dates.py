"""Shared FinancialLineItem.period -> approximate-date helpers.

`period` is a free-text label (e.g. "FY2025"), not a real date column —
both app/services/valuation/multiples.py (matching a period to the
nearest historical price) and app/services/valuation/holding_valuation.py
(sorting periods chronologically for the DCF's growth-rate history) need
the same year-extraction/approximation logic, so it lives here once
rather than being duplicated.
"""
from __future__ import annotations

import re
from datetime import datetime, timezone

_YEAR_PATTERN = re.compile(r"(\d{4})")


def extract_year(period: str) -> int | None:
    match = _YEAR_PATTERN.search(period)
    return int(match.group(1)) if match else None


def period_end_date(year: int) -> datetime:
    """Treats a fiscal year label as ending December 31 — a documented
    approximation (see module docstring), not a precise fiscal-year-end
    date."""
    return datetime(year, 12, 31, tzinfo=timezone.utc)
