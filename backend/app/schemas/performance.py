"""Pydantic schemas for the portfolio performance API
(app/api/performance.py, Sprint 13)."""
from __future__ import annotations

from datetime import date, datetime
from decimal import Decimal

from pydantic import BaseModel


class ExcludedHoldingOut(BaseModel):
    ticker: str
    name: str
    reason: str


class DailyValueOut(BaseModel):
    on: date
    portfolio_value_nok: Decimal
    partial: bool
    portfolio_return_pct: Decimal | None
    daily_pnl_nok: Decimal | None
    benchmark_return_pct: Decimal | None
    real_return_pct: Decimal | None = None


class PortfolioPerformanceOut(BaseModel):
    as_of: datetime | None
    lookback_days: int
    equity_value_nok: Decimal
    included_value_nok: Decimal
    covered_pct: Decimal | None
    full_coverage_from: date | None
    starting_value_nok: Decimal | None
    ending_value_nok: Decimal | None
    total_return_pct: Decimal | None
    best_day: DailyValueOut | None
    worst_day: DailyValueOut | None
    benchmark_ticker: str
    benchmark_available: bool
    benchmark_reason: str | None
    real_return_available: bool = False
    real_return_reason: str | None = None
    cpi_region: str = "NO"
    excluded: list[ExcludedHoldingOut]
    method_note: str
    real_return_note: str = ""
    series: list[DailyValueOut]
