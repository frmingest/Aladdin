"""Pydantic schemas for the primary-source filings API (app/api/sources.py)."""
from __future__ import annotations

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel

from app.schemas.research import ResearchItemOut


class SourceEligibilityOut(BaseModel):
    holding_id: UUID
    ticker: str
    sec_edgar: bool
    sec_edgar_reason: str | None = None
    newsweb: bool
    newsweb_reason: str | None = None


class EdgarFilingOut(BaseModel):
    accession_number: str
    form: str
    filed: str
    url: str


class EdgarImportOut(BaseModel):
    holding_id: UUID
    imported: bool  # False = nothing stored yet for this holding
    cik: str | None = None
    entity_name: str | None = None
    source_url: str | None = None
    document_id: str | None = None
    was_duplicate: bool = False
    periods_imported: list[str] = []
    periods_skipped_manual: list[str] = []
    facts_imported: int = 0
    metrics_by_period: dict[str, list[str]] = {}
    filings: list[EdgarFilingOut] = []
    retrieved_at: datetime | None = None
    warnings: list[str] = []


class AnnouncementsOut(BaseModel):
    available: bool
    holding_id: UUID
    ticker: str
    as_of: datetime | None
    items: list[ResearchItemOut]
    reason: str | None = None
