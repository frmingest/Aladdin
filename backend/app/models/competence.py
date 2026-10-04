"""Circle of Competence marks (game mode G19, Sprint 25).

One row per sector the user has marked: how well they know it (`know`,
`partly`, `outside`) and an optional note. The marks are the user's own
statement and are never inferred; a sector with no row is simply unmarked.
Additive table, no existing table is touched. See
alembic/versions/r1d9e0f1a2b3_competence_marks.py.
"""
from __future__ import annotations

import uuid
from datetime import datetime, timezone

from sqlalchemy import DateTime, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base
from app.models.types import GUID


class CompetenceMark(Base):
    __tablename__ = "competence_marks"

    id: Mapped[uuid.UUID] = mapped_column(GUID(), primary_key=True, default=uuid.uuid4)
    sector: Mapped[str] = mapped_column(String(128), nullable=False, unique=True)
    level: Mapped[str] = mapped_column(String(16), nullable=False)
    note: Mapped[str | None] = mapped_column(Text, nullable=True)
    marked_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc)
    )
