"""Pydantic schemas for the portfolio risk API (app/api/risk.py, Sprint 12)."""
from __future__ import annotations

from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel


class CorrelationPairOut(BaseModel):
    ticker_a: str
    ticker_b: str
    correlation: Decimal
    overlap_days: int


class ExcludedOut(BaseModel):
    key: str
    reason: str


class CorrelationOut(BaseModel):
    lookback_days: int
    tickers: list[str]
    pairs: list[CorrelationPairOut]
    excluded: list[ExcludedOut]


class ClusterFlagOut(BaseModel):
    tickers: list[str]
    names: list[str]
    correlation: Decimal
    combined_weight_pct: Decimal


class HoldingStressOut(BaseModel):
    holding_id: str
    ticker: str
    name: str
    method: str  # "dcf_bear" | "volatility" | "unavailable"
    value_nok: Decimal
    weight_pct: Decimal | None
    shock_pct: Decimal | None
    contribution_nok: Decimal | None
    reason: str | None


class StressOut(BaseModel):
    std_devs: Decimal
    horizon_note: str
    portfolio_shock_pct: Decimal | None
    portfolio_drawdown_nok: Decimal | None
    total_value_considered_nok: Decimal
    holdings: list[HoldingStressOut]


class RegimeInputOut(BaseModel):
    key: str
    label: str
    region: str
    latest_value: Decimal | None
    smoothed_value: Decimal | None
    unit: str


class RegimeOut(BaseModel):
    regime: str
    home_market_series_included: bool
    curve_and_credit_are_us_only: bool
    explanation: str
    method_note: str
    inputs: list[RegimeInputOut]
    data_complete: bool
    missing: list[str]


class PortfolioRiskOut(BaseModel):
    as_of: datetime | None
    equity_value_nok: Decimal
    lookback_days: int
    cluster_threshold: Decimal
    correlation: CorrelationOut
    clusters: list[ClusterFlagOut]
    stress: StressOut
    regime: RegimeOut
    price_history_notes: list[str]
