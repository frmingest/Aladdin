"""Pydantic schemas for the portfolio API (app/api/portfolio.py) —
snapshots and their positions.
"""
from __future__ import annotations

from datetime import datetime
from decimal import Decimal
from uuid import UUID

from pydantic import BaseModel, Field


class PortfolioPositionIn(BaseModel):
    holding_id: UUID
    weight_pct: Decimal | None = None
    quantity: Decimal | None = None
    cost_basis: Decimal | None = None
    cost_basis_currency: str | None = Field(default=None, min_length=3, max_length=3)
    notes: str | None = None
    account_id: UUID | None = None


class PortfolioPositionOut(BaseModel):
    id: UUID
    holding_id: UUID
    ticker: str
    holding_name: str
    weight_pct: Decimal | None
    quantity: Decimal | None
    cost_basis: Decimal | None
    cost_basis_currency: str | None
    notes: str | None
    account_id: UUID | None


class PortfolioSnapshotCreate(BaseModel):
    source_file_id: UUID
    reporting_currency: str = Field(min_length=3, max_length=3)
    account_id: UUID | None = None
    positions: list[PortfolioPositionIn] = Field(default_factory=list)


class PortfolioSnapshotOut(BaseModel):
    id: UUID
    uploaded_at: datetime
    source_file_id: UUID
    reporting_currency: str
    status: str
    account_id: UUID | None
    positions: list[PortfolioPositionOut]


class PortfolioSnapshotSummary(BaseModel):
    """List view — same fields as PortfolioSnapshotOut minus the expanded
    position list, plus a count (fetching every position for every
    snapshot on a list endpoint doesn't scale)."""

    id: UUID
    uploaded_at: datetime
    source_file_id: UUID
    reporting_currency: str
    status: str
    account_id: UUID | None
    position_count: int


class ConcentrationOut(BaseModel):
    snapshot_id: UUID
    hhi: Decimal
    position_count: int
