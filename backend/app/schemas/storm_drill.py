"""Schemas for Storm Drill notes (3D courtyard quest 3)."""
from __future__ import annotations

from datetime import datetime
from decimal import Decimal
from uuid import UUID

from pydantic import BaseModel, Field


class StormDrillCreate(BaseModel):
    market_drop: Decimal = Field(gt=0, lt=1, description="Market fall as a fraction (0.30 = 30%).")
    plan: str = Field(min_length=1, max_length=4000)


class StormDrillOut(BaseModel):
    id: UUID
    market_drop: Decimal
    plan: str
    scenarios_version: str
    created_at: datetime


class StormDrillsOut(BaseModel):
    drills: list[StormDrillOut]
    demo: bool = False
