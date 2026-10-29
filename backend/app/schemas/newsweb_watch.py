"""Response shapes for the Newsweb watch endpoints (2026-10-28)."""
from __future__ import annotations

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel


class NewAnnouncementOut(BaseModel):
    id: UUID
    holding_id: UUID
    ticker: str
    holding_name: str
    title: str
    summary: str | None
    source_url: str
    published_at: datetime | None
    first_seen_at: datetime


class NewAnnouncementsOut(BaseModel):
    count: int
    items: list[NewAnnouncementOut]
    last_checked_at: datetime | None
    last_summary: str | None


class AcknowledgeIn(BaseModel):
    holding_id: UUID | None = None
    """Omit to mark every unread announcement as seen."""


class AcknowledgeOut(BaseModel):
    acknowledged: int
