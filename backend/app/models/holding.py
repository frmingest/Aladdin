"""Holding — one row per equity instrument.

Matches alembic/versions/a0f4172c5989 (original) widened by
e1a2b3c4d5f6_widen_holdings_ticker.py (ticker varchar(32) -> 255).

`asset_class`/`asset_class_raw` are legacy columns from the app's pre-reset
multi-asset design (kept per CLAUDE.md — the DB is not being reset). This
equity-only rebuild always writes `asset_class="equity"` to satisfy the
NOT NULL constraint and never branches on it — see
claude/buffett-munger-rebuild-sprint-plan-2026-09-21.md.
"""
from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import TYPE_CHECKING

from sqlalchemy import DateTime, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base
from app.models.types import GUID

if TYPE_CHECKING:
    from app.models.document import Document
    from app.models.financial_line_item import FinancialLineItem
    from app.models.portfolio import PortfolioPosition

# This rebuild is equity-only; every Holding created here writes this value
# to satisfy the legacy NOT NULL column. Never read/branch on it elsewhere.
EQUITY_ASSET_CLASS = "equity"


class Holding(Base):
    __tablename__ = "holdings"

    id: Mapped[uuid.UUID] = mapped_column(GUID(), primary_key=True, default=uuid.uuid4)
    ticker: Mapped[str] = mapped_column(String(255), nullable=False, unique=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    asset_class: Mapped[str] = mapped_column(String(16), nullable=False, default=EQUITY_ASSET_CLASS)
    asset_class_raw: Mapped[str] = mapped_column(
        String(64), nullable=False, default=EQUITY_ASSET_CLASS
    )
    sector: Mapped[str | None] = mapped_column(String(128), nullable=True)
    trading_currency: Mapped[str] = mapped_column(String(3), nullable=False)
    institution: Mapped[str | None] = mapped_column(String(128), nullable=True)
    custody_type: Mapped[str | None] = mapped_column(String(64), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc)
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )

    documents: Mapped[list[Document]] = relationship(back_populates="holding")
    positions: Mapped[list[PortfolioPosition]] = relationship(back_populates="holding")
    financial_line_items: Mapped[list[FinancialLineItem]] = relationship(
        back_populates="holding"
    )
