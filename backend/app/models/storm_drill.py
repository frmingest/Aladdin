"""Storm Drill notes (3D courtyard quest 3, 2026-11-01).

A drill is a pre-commitment, written BEFORE a fall: "if the market drops X%, here is what I would do".
It lives in its own table on purpose. It is not a decision (so it is not a journal entry and never
triggers a thesis check or a 6/12-month review) and it is not an order. Nothing reads it to act.
"""
from __future__ import annotations

import uuid
from datetime import datetime, timezone
from decimal import Decimal

from sqlalchemy import DateTime, Numeric, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base
from app.models.types import GUID


class StormDrill(Base):
    __tablename__ = "storm_drills"

    id: Mapped[uuid.UUID] = mapped_column(GUID(), primary_key=True, default=uuid.uuid4)
    market_drop: Mapped[Decimal] = mapped_column(Numeric(5, 4), nullable=False)
    """The market fall rehearsed, as a fraction (0.30 = 30%), inside the siege scenarios' range."""
    plan: Mapped[str] = mapped_column(Text, nullable=False)
    """What I would do, in my own words, written before it happens."""
    scenarios_version: Mapped[str] = mapped_column(String(16), nullable=False)
    """The siege scenarios file the slider range came from."""
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc)
    )
