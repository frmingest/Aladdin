"""Pydantic schemas for the research API (app/api/research.py)."""
from __future__ import annotations

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel


class ResearchItemOut(BaseModel):
    title: str
    summary: str
    source_name: str
    source_url: str
    source_type: str
    published_at: datetime | None
    retrieved_at: datetime


class MacroResearchOut(BaseModel):
    available: bool
    as_of: datetime | None
    items: list[ResearchItemOut]
    reason: str | None = None


class SectorResearchOut(BaseModel):
    available: bool
    sector: str
    as_of: datetime | None
    items: list[ResearchItemOut]
    reason: str | None = None


class CompanyResearchOut(BaseModel):
    available: bool
    holding_id: UUID
    ticker: str
    as_of: datetime | None
    items: list[ResearchItemOut]
    reason: str | None = None


class ResearchRunOut(BaseModel):
    id: UUID
    type: str
    sector: str | None
    holding_id: UUID | None
    status: str
    started_at: datetime
    completed_at: datetime | None
    methodology_version: str
    item_count: int
    error_message: str | None
