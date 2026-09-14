"""Portfolio snapshot tables (architecture §7, §20)."""

import enum
import uuid
from datetime import datetime, timezone
from decimal import Decimal

from sqlalchemy import DateTime, ForeignKey, Numeric, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.config.database import Base
from app.models.account import Account
from app.models.holding import Holding
from app.models.types import GUID, new_uuid


class SnapshotStatus(str, enum.Enum):
    PENDING = "PENDING"
    VALIDATED = "VALIDATED"
    FAILED = "FAILED"


class PortfolioSnapshot(Base):
    __tablename__ = "portfolio_snapshots"

    id: Mapped["uuid.UUID"] = mapped_column(GUID, primary_key=True, default=new_uuid)
    uploaded_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )
    # The portfolio CSV/XLSX file itself, stored as a Document (holding_id=NULL).
    source_file_id: Mapped["uuid.UUID"] = mapped_column(
        GUID, ForeignKey("documents.id"), nullable=False
    )
    reporting_currency: Mapped[str] = mapped_column(String(3), nullable=False, default="NOK")
    status: Mapped[str] = mapped_column(
        String(16), nullable=False, default=SnapshotStatus.PENDING.value
    )
    # Which real-world account this upload's file belongs to. Nullable so an
    # upload made before accounts existed, or one the user chooses not to
    # tag, still works — filtering by account simply treats it as
    # unassigned rather than being forced to guess.
    account_id: Mapped["uuid.UUID | None"] = mapped_column(
        GUID, ForeignKey("accounts.id"), nullable=True, index=True
    )

    positions: Mapped[list["PortfolioPosition"]] = relationship(
        back_populates="snapshot", cascade="all, delete-orphan"
    )
    account: Mapped["Account | None"] = relationship("Account")

    def __repr__(self) -> str:  # pragma: no cover
        return f"<PortfolioSnapshot {self.id} ({self.status})>"


class PortfolioPosition(Base):
    __tablename__ = "portfolio_positions"

    id: Mapped["uuid.UUID"] = mapped_column(GUID, primary_key=True, default=new_uuid)
    snapshot_id: Mapped["uuid.UUID"] = mapped_column(
        GUID, ForeignKey("portfolio_snapshots.id"), nullable=False, index=True
    )
    holding_id: Mapped["uuid.UUID"] = mapped_column(
        GUID, ForeignKey("holdings.id"), nullable=False, index=True
    )

    # Denormalized from the snapshot's account_id at merge time (see
    # app.services.portfolio.ingestion) rather than only read off the
    # snapshot, because uploads merge forward onto the *latest* snapshot:
    # each position needs to remember which account it actually came from
    # so a later upload for a different account doesn't inherit the wrong
    # one, and so the same instrument held in two different accounts stays
    # two distinct rows instead of colliding on ticker alone.
    account_id: Mapped["uuid.UUID | None"] = mapped_column(
        GUID, ForeignKey("accounts.id"), nullable=True, index=True
    )
    weight_pct: Mapped[Decimal | None] = mapped_column(Numeric(9, 4), nullable=True)
    quantity: Mapped[Decimal | None] = mapped_column(Numeric(20, 6), nullable=True)
    cost_basis: Mapped[Decimal | None] = mapped_column(Numeric(20, 6), nullable=True)
    cost_basis_currency: Mapped[str | None] = mapped_column(String(3), nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    snapshot: Mapped["PortfolioSnapshot"] = relationship(back_populates="positions")
    holding: Mapped["Holding"] = relationship("Holding")
    account: Mapped["Account | None"] = relationship("Account")
