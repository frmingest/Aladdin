"""Decision journal (feature F6): why you bought or sold, at what price,
and what would prove you wrong, so the outcome can be checked later.

`ticker`/`company_name` are copied onto the entry and `holding_id` is
nullable: deleting a holding unlinks its entries (holding_id -> NULL)
instead of deleting them, because a journal is your own record and should
outlive the data it was about. See
alembic/versions/d5e6f7a8b9c0_decision_journal_entries.py.
"""
from __future__ import annotations

import uuid
from datetime import date, datetime, timezone
from decimal import Decimal

from sqlalchemy import Date, DateTime, ForeignKey, Index, Integer, Numeric, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base
from app.models.types import GUID

JOURNAL_ACTIONS = ("buy", "add", "trim", "sell", "hold", "pass")


class DecisionJournalEntry(Base):
    __tablename__ = "decision_journal_entries"
    __table_args__ = (Index("ix_decision_journal_entries_holding_id", "holding_id"),)

    id: Mapped[uuid.UUID] = mapped_column(GUID(), primary_key=True, default=uuid.uuid4)
    holding_id: Mapped[uuid.UUID | None] = mapped_column(
        GUID(), ForeignKey("holdings.id"), nullable=True
    )
    ticker: Mapped[str] = mapped_column(String(255), nullable=False)
    company_name: Mapped[str] = mapped_column(String(255), nullable=False)

    action: Mapped[str] = mapped_column(String(16), nullable=False)
    decided_on: Mapped[date] = mapped_column(Date, nullable=False)
    price: Mapped[Decimal | None] = mapped_column(Numeric(18, 4), nullable=True)
    currency: Mapped[str | None] = mapped_column(String(3), nullable=True)
    quantity: Mapped[Decimal | None] = mapped_column(Numeric(20, 6), nullable=True)

    thesis: Mapped[str] = mapped_column(Text, nullable=False)
    """Why: the reason for the decision, in your own words."""
    invalidation: Mapped[str | None] = mapped_column(Text, nullable=True)
    """What would prove this decision wrong."""
    confidence: Mapped[int | None] = mapped_column(Integer, nullable=True)
    """1 (low) to 5 (high)."""
    verdict_at_decision: Mapped[str | None] = mapped_column(String(16), nullable=True)
    """The latest analysis verdict when the entry was written, if any."""

    review_6m: Mapped[str | None] = mapped_column(Text, nullable=True)
    review_12m: Mapped[str | None] = mapped_column(Text, nullable=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc)
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )
