"""PortfolioSnapshot, PortfolioPosition — an uploaded portfolio export and
its per-holding positions.

Matches alembic/versions/a0f4172c5989 (original) + f7c8d9e0a1b2_accounts.py
(account_id added to both tables) +
f1a2b3c4d5e6_portfolio_position_acquired_at.py (acquired_at added to
positions).

`acquired_at` is a legacy column from the precious-metals/collectibles
phase (a manually-entered lot's purchase date) — kept per CLAUDE.md (the DB
is not being reset) but this equity-only rebuild never populates or queries
it; every brokerage position's effective date is its snapshot's
`uploaded_at` instead.
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
    from app.models.account import Account
    from app.models.document import Document
    from app.models.holding import Holding


class PortfolioSnapshot(Base):
    __tablename__ = "portfolio_snapshots"

    id: Mapped[uuid.UUID] = mapped_column(GUID(), primary_key=True, default=uuid.uuid4)
    uploaded_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc)
    )
    source_file_id: Mapped[uuid.UUID] = mapped_column(
        GUID(), ForeignKey("documents.id"), nullable=False
    )
    reporting_currency: Mapped[str] = mapped_column(String(3), nullable=False)
    status: Mapped[str] = mapped_column(String(16), nullable=False)
    account_id: Mapped[uuid.UUID | None] = mapped_column(
        GUID(), ForeignKey("accounts.id"), nullable=True
    )

    source_file: Mapped[Document] = relationship(back_populates="source_of_snapshots")
    account: Mapped[Account | None] = relationship(back_populates="snapshots")
    positions: Mapped[list[PortfolioPosition]] = relationship(
        back_populates="snapshot", cascade="all, delete-orphan"
    )


class PortfolioPosition(Base):
    __tablename__ = "portfolio_positions"

    id: Mapped[uuid.UUID] = mapped_column(GUID(), primary_key=True, default=uuid.uuid4)
    snapshot_id: Mapped[uuid.UUID] = mapped_column(
        GUID(), ForeignKey("portfolio_snapshots.id"), nullable=False
    )
    holding_id: Mapped[uuid.UUID] = mapped_column(
        GUID(), ForeignKey("holdings.id"), nullable=False
    )
    weight_pct: Mapped[Decimal | None] = mapped_column(Numeric(9, 4), nullable=True)
    quantity: Mapped[Decimal | None] = mapped_column(Numeric(20, 6), nullable=True)
    cost_basis: Mapped[Decimal | None] = mapped_column(Numeric(20, 6), nullable=True)
    cost_basis_currency: Mapped[str | None] = mapped_column(String(3), nullable=True)
    # Both added in migration a2b4c6d8e0f1 (2026-09-22) — the CSV importer
    # always parsed these out of the broker export ("siste kurs" /
    # "Verdi NOK") but neither was ever persisted; see that migration's
    # docstring.
    last_price: Mapped[Decimal | None] = mapped_column(Numeric(20, 6), nullable=True)
    """Last traded price at import time, in the same currency as
    cost_basis_currency (the security's own trading currency) — not
    necessarily NOK."""
    market_value_nok: Mapped[Decimal | None] = mapped_column(Numeric(20, 6), nullable=True)
    """Total market value of this position at import time, in NOK (the
    snapshot's reporting_currency, always NOK for CSV-imported snapshots —
    see PortfolioSnapshot.reporting_currency)."""
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    account_id: Mapped[uuid.UUID | None] = mapped_column(
        GUID(), ForeignKey("accounts.id"), nullable=True
    )
    acquired_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    snapshot: Mapped[PortfolioSnapshot] = relationship(back_populates="positions")
    holding: Mapped[Holding] = relationship(back_populates="positions")
    account: Mapped[Account | None] = relationship(back_populates="positions")
