"""Frozen forecasts (game mode C2, 2026-10-14).

Append-only. A row is written when a journal entry is saved with a confidence
and again whenever that confidence is changed, so the calibration view can use
the confidence as first written and a later edit cannot rewrite the past.
Analyst runs already store their own price targets and are never edited, so
`source = "oracle"` is reserved but not written today.
See alembic/versions/w1e2f3a4b5c6_forecasts.py.
"""
from __future__ import annotations

import uuid
from datetime import datetime, timezone

from sqlalchemy import DateTime, ForeignKey, Index, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base
from app.models.types import GUID


class Forecast(Base):
    __tablename__ = "forecasts"
    __table_args__ = (Index("ix_forecasts_entry_id", "entry_id"),)

    id: Mapped[uuid.UUID] = mapped_column(GUID(), primary_key=True, default=uuid.uuid4)
    entry_id: Mapped[uuid.UUID | None] = mapped_column(
        GUID(), ForeignKey("decision_journal_entries.id", ondelete="SET NULL"), nullable=True
    )
    holding_id: Mapped[uuid.UUID | None] = mapped_column(GUID(), ForeignKey("holdings.id"), nullable=True)
    source: Mapped[str] = mapped_column(String(16), nullable=False, default="user")
    confidence: Mapped[int | None] = mapped_column(Integer, nullable=True)
    made_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc)
    )
