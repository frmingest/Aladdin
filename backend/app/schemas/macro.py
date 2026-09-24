"""Pydantic schemas for the numeric macro data API (app/api/macro.py)."""
from __future__ import annotations

from datetime import date, datetime
from decimal import Decimal

from pydantic import BaseModel


class MacroHistoryPointOut(BaseModel):
    date: date
    value: Decimal


class MacroIndicatorOut(BaseModel):
    key: str
    label: str
    region: str
    group: str
    display_unit: str
    frequency: str
    change_kind: str
    description: str
    source_name: str
    source_series_id: str
    source_url: str
    derived: bool
    value: Decimal | None
    observed_on: date | None
    value_3m_ago: Decimal | None
    change_3m: Decimal | None
    value_12m_ago: Decimal | None
    change_12m: Decimal | None
    stale: bool
    age_days: int | None
    formula: str | None
    last_success_at: datetime | None
    last_error: str | None
    history: list[MacroHistoryPointOut]


class MacroIndicatorsOut(BaseModel):
    series_version: str
    fetching_enabled: bool
    last_success_at: datetime | None
    indicators: list[MacroIndicatorOut]
    derived: list[MacroIndicatorOut]


class MacroSeriesRefreshOut(BaseModel):
    key: str
    label: str
    status: str
    inserted: int
    latest_observed: date | None
    error: str | None


class MacroRefreshOut(BaseModel):
    results: list[MacroSeriesRefreshOut]
    indicators: MacroIndicatorsOut
