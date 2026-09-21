"""Pydantic schemas for the holdings API (app/api/holdings.py)."""
from __future__ import annotations

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field


class HoldingCreate(BaseModel):
    ticker: str = Field(min_length=1, max_length=255)
    name: str = Field(min_length=1, max_length=255)
    trading_currency: str = Field(min_length=3, max_length=3)
    sector: str | None = None
    institution: str | None = None
    custody_type: str | None = None


class HoldingUpdate(BaseModel):
    """Every field optional — only what's supplied is changed.

    `ticker` is deliberately excluded: it's the unique identifier documents
    and positions are keyed against, so changing it is a delete+recreate,
    not an update.
    """

    name: str | None = Field(default=None, min_length=1, max_length=255)
    trading_currency: str | None = Field(default=None, min_length=3, max_length=3)
    sector: str | None = None
    institution: str | None = None
    custody_type: str | None = None


class HoldingOut(BaseModel):
    id: UUID
    ticker: str
    name: str
    sector: str | None
    trading_currency: str
    institution: str | None
    custody_type: str | None
    created_at: datetime
    updated_at: datetime
    document_count: int
    position_count: int
