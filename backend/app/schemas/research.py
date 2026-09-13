"""API request/response schemas for the Phase 4 research endpoints (§26)."""

from datetime import datetime
from decimal import Decimal
from uuid import UUID

from pydantic import BaseModel


class MacroObservationOut(BaseModel):
    series_key: str
    value: Decimal
    unit: str
    region: str
    provider: str
    observed_at: datetime


class ResearchItemOut(BaseModel):
    title: str
    summary: str
    source_name: str
    source_url: str
    published_at: datetime | None
    retrieved_at: datetime


class MacroSnapshotOut(BaseModel):
    available: bool
    as_of: datetime | None
    observations: list[MacroObservationOut]
    narrative_items: list[ResearchItemOut]
    reason: str | None = None


class SectorResearchOut(BaseModel):
    available: bool
    sector: str
    as_of: datetime | None
    items: list[ResearchItemOut]
    reason: str | None = None


class ResearchRunOut(BaseModel):
    id: UUID
    type: str
    sector: str | None
    status: str
    started_at: datetime
    completed_at: datetime | None
    methodology_version: str
    item_count: int
    error_message: str | None
