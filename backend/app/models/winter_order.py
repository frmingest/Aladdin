"""Winter order (game mode E3, 2026-10-16).

The short note you write to your future self for the worst fall of the book.
Append-only: saving writes a new row, the newest row is the current order and
older rows stay as history. Deliberately NOT a journal entry: journal entries
are decisions about a holding and feed the temperament and calibration
counts; this is a standing note about the whole book.
See alembic/versions/x1f2a3b4c5d6_winter_orders.py.
"""
from __future__ import annotations

import uuid
from datetime import datetime, timezone

from sqlalchemy import DateTime, String
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base
from app.models.types import GUID

MAX_ORDER_CHARS = 200


class WinterOrder(Base):
    __tablename__ = "winter_orders"

    id: Mapped[uuid.UUID] = mapped_column(GUID(), primary_key=True, default=uuid.uuid4)
    text: Mapped[str] = mapped_column(String(MAX_ORDER_CHARS), nullable=False)
    made_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc)
    )
