"""Pydantic schemas for the decision journal API (feature F6)."""
from __future__ import annotations

from datetime import date, datetime
from decimal import Decimal
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, Field

Action = Literal["buy", "add", "trim", "sell", "hold", "pass"]


class JournalEntryCreate(BaseModel):
    holding_id: UUID
    action: Action
    decided_on: date
    price: Decimal | None = Field(default=None, gt=0)
    currency: str | None = Field(default=None, min_length=3, max_length=3)
    quantity: Decimal | None = Field(default=None, gt=0)
    thesis: str = Field(min_length=1)
    invalidation: str | None = None
    confidence: int | None = Field(default=None, ge=1, le=5)


class JournalEntryUpdate(BaseModel):
    action: Action | None = None
    decided_on: date | None = None
    price: Decimal | None = Field(default=None, gt=0)
    currency: str | None = Field(default=None, min_length=3, max_length=3)
    quantity: Decimal | None = Field(default=None, gt=0)
    thesis: str | None = Field(default=None, min_length=1)
    invalidation: str | None = None
    confidence: int | None = Field(default=None, ge=1, le=5)
    review_6m: str | None = None
    review_12m: str | None = None


class JournalOutcomeOut(BaseModel):
    days_since: int
    latest_price: Decimal | None
    latest_price_at: datetime | None
    return_pct: Decimal | None
    in_favour: bool | None
    price_6m: Decimal | None
    return_6m_pct: Decimal | None
    price_12m: Decimal | None
    return_12m_pct: Decimal | None
    review_6m_due: bool
    review_12m_due: bool
    note: str | None


class JournalEntryOut(BaseModel):
    id: UUID
    holding_id: UUID | None
    ticker: str
    company_name: str
    action: Action
    decided_on: date
    price: Decimal | None
    currency: str | None
    quantity: Decimal | None
    thesis: str
    invalidation: str | None
    confidence: int | None
    verdict_at_decision: str | None
    review_6m: str | None
    review_12m: str | None
    created_at: datetime
    updated_at: datetime
    outcome: JournalOutcomeOut


class JournalOut(BaseModel):
    entries: list[JournalEntryOut]
    reviews_due: int
