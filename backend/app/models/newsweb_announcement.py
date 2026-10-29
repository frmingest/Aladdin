"""Newsweb announcements the background watch has seen (2026-10-28).

The announcements cache (research_items, run type ANNOUNCEMENTS) is replaced
on every refresh, so it cannot say what is *new*. This table keeps one row per
(holding, Newsweb message) with the time the watch first saw it.

`acknowledged_at` is NULL while the announcement is unread. The first check of
a holding stores its existing announcements already acknowledged (a baseline),
so connecting a holding never floods you with a year of "new" items.

Only metadata is stored (title, summary line, link, dates), never body text.
CLAUDE.md Rule 5: the title is issuer-written text, i.e. data, not instructions.
"""
from __future__ import annotations

import uuid
from datetime import datetime, timezone

from sqlalchemy import DateTime, ForeignKey, Index, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base
from app.models.types import GUID


class NewswebAnnouncement(Base):
    __tablename__ = "newsweb_announcements"
    __table_args__ = (
        UniqueConstraint("holding_id", "message_id", name="uq_newsweb_announcements_holding_message"),
        Index("ix_newsweb_announcements_unread", "acknowledged_at", "first_seen_at"),
    )

    id: Mapped[uuid.UUID] = mapped_column(GUID(), primary_key=True, default=uuid.uuid4)
    holding_id: Mapped[uuid.UUID] = mapped_column(GUID(), ForeignKey("holdings.id"), nullable=False, index=True)
    message_id: Mapped[str] = mapped_column(String(64), nullable=False)
    title: Mapped[str] = mapped_column(Text, nullable=False)
    summary: Mapped[str | None] = mapped_column(Text, nullable=True)
    source_url: Mapped[str] = mapped_column(String(512), nullable=False)
    published_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    first_seen_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc)
    )
    acknowledged_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
