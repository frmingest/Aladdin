"""Account — one row per real-world custody/brokerage account.

Matches alembic/versions/f7c8d9e0a1b2_accounts.py exactly (the DB is not
being reset — CLAUDE.md — so the model has to match what's already there,
not an ideal fresh design).
"""
from __future__ import annotations

import uuid
from datetime import datetime, timezone
from decimal import Decimal
from typing import TYPE_CHECKING

from sqlalchemy import DateTime, Numeric, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base
from app.models.types import GUID

if TYPE_CHECKING:
    from app.models.portfolio import PortfolioPosition, PortfolioSnapshot


class Account(Base):
    __tablename__ = "accounts"

    id: Mapped[uuid.UUID] = mapped_column(GUID(), primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String(128), nullable=False)
    account_number: Mapped[str] = mapped_column(String(64), nullable=False, unique=True)
    institution: Mapped[str | None] = mapped_column(String(128), nullable=True)
    # Cash held in the account, in NOK, typed in by hand (the Nordnet holdings
    # export has no cash line). NULL = never entered, which is different from
    # 0 = entered and empty. Used by game mode's Vault (2026-10-01).
    cash_nok: Mapped[Decimal | None] = mapped_column(Numeric(20, 2), nullable=True)
    cash_as_of: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc)
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )

    snapshots: Mapped[list[PortfolioSnapshot]] = relationship(back_populates="account")
    positions: Mapped[list[PortfolioPosition]] = relationship(back_populates="account")
