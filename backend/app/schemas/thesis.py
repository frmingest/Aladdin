"""Pydantic schemas for the thesis tracking API (Sprint 11, app/api/thesis.py)."""
from __future__ import annotations

from datetime import datetime
from decimal import Decimal
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict


class MetricDefOut(BaseModel):
    key: str
    label: str
    group: Literal["fundamentals", "market_multiples", "price"]
    unit: str


class TripwireCreate(BaseModel):
    metric: str
    operator: Literal["below", "above"]
    threshold: Decimal
    label: str | None = None
    origin: str | None = None
    source_run_id: UUID | None = None


class TripwireUpdate(BaseModel):
    operator: Literal["below", "above"] | None = None
    threshold: Decimal | None = None
    label: str | None = None
    active: bool | None = None


class TripwireOut(BaseModel):
    id: UUID
    holding_id: UUID
    metric: str
    metric_label: str
    operator: str
    threshold: Decimal
    label: str | None
    origin: str | None
    source_run_id: UUID | None
    active: bool
    fired_at: datetime | None
    seen_at: datetime | None
    created_at: datetime
    updated_at: datetime
    current_value: Decimal | None = None
    unavailable_reason: str | None = None
    firing: bool = False


class ChangeReasonOut(BaseModel):
    key: str
    text: str


class TimelineEntryOut(BaseModel):
    # `model_name` collides with pydantic's "model_" protected-namespace
    # heuristic (a model attribute, not a method), so it's just a field.
    model_config = ConfigDict(protected_namespaces=())

    run_id: UUID
    date: datetime
    verdict: str | None
    verdict_direction: str | None
    moat: str | None
    moat_direction: str | None
    price: Decimal | None
    price_currency: str | None
    dcf_low: Decimal | None
    dcf_high: Decimal | None
    pass_type: str
    engine: str
    model_name: str | None
    thesis_bullets: list[str]


class TripwireSuggestionOut(BaseModel):
    text: str
    metric: str | None
    operator: str | None
    threshold: Decimal | None


class HoldingThesisOut(BaseModel):
    holding_id: UUID
    ticker: str
    name: str
    status: str
    status_label: str
    analyzed_at: datetime | None
    change_reasons: list[ChangeReasonOut]
    tripwires: list[TripwireOut]
    timeline: list[TimelineEntryOut]
    suggestions: list[TripwireSuggestionOut]


class MonitorRowOut(BaseModel):
    holding_id: UUID
    ticker: str
    name: str
    status: str
    status_label: str
    firing_count: int
    change_reason_count: int
    analyzed_at: datetime | None


class MonitorOut(BaseModel):
    rows: list[MonitorRowOut]
