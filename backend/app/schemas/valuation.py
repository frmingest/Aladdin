"""Pydantic schemas for the valuation API (app/api/valuation.py, Sprint 3)."""
from __future__ import annotations

from datetime import datetime
from decimal import Decimal
from uuid import UUID

from pydantic import BaseModel


class DCFScenarioOut(BaseModel):
    label: str
    growth_rate: Decimal
    intrinsic_value_per_share: Decimal
    margin_of_safety: Decimal | None = None


class DCFOut(BaseModel):
    discount_rate: Decimal
    terminal_growth_rate: Decimal
    scenarios: list[DCFScenarioOut]


class PeriodMultiplesOut(BaseModel):
    period: str
    matched_price_observed_at: datetime | None
    computed: dict[str, Decimal]
    skipped: dict[str, str]


class HoldingValuationOut(BaseModel):
    holding_id: UUID
    ticker: str
    valuation_currency: str | None
    as_of: datetime | None
    base_growth_rate: Decimal | None
    discount_rate: Decimal | None
    risk_free_rate_pct: Decimal | None
    beta: Decimal | None
    equity_risk_premium: Decimal | None
    current_price_per_share: Decimal | None
    dcf: DCFOut | None
    reverse_dcf_implied_growth: Decimal | None
    multiples: list[PeriodMultiplesOut]
    assumptions_version: str
    unavailable_reasons: list[str]
