"""Watchlist (feature F7): companies you follow but may not own.

A watchlist entry points at a Holding row. `holdings` is the instrument
table (what a ticker is), not a positions table (ownership comes from
portfolio_positions), so a watched company gets the full holding page
for free: valuation, research, primary sources and the Buffett/Munger
analysis all work unchanged. See
alembic/versions/c4d5e6f7a8b9_watchlist_items.py.
"""
from __future__ import annotations

import uuid
from datetime import datetime, timezone
from decimal import Decimal
from typing import TYPE_CHECKING

from sqlalchemy import DateTime, ForeignKey, Numeric, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base
from app.models.types import GUID

if TYPE_CHECKING:
    from app.models.holding import Holding


class WatchlistItem(Base):
    __tablename__ = "watchlist_items"

    id: Mapped[uuid.UUID] = mapped_column(GUID(), primary_key=True, default=uuid.uuid4)
    holding_id: Mapped[uuid.UUID] = mapped_column(
        GUID(), ForeignKey("holdings.id"), nullable=False, unique=True
    )
    buy_below_price: Mapped[Decimal | None] = mapped_column(Numeric(18, 4), nullable=True)
    """Your own "I'd buy at or below this" price, per share."""
    buy_below_currency: Mapped[str | None] = mapped_column(String(3), nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    added_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc)
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )

    holding: Mapped[Holding] = relationship()
