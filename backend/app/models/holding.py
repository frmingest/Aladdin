"""Holding — one row per distinct instrument the portfolio ever held (§20)."""

import uuid
from datetime import datetime, timezone

from sqlalchemy import DateTime, String
from sqlalchemy.orm import Mapped, mapped_column

from app.config.database import Base
from app.models.types import GUID, new_uuid


class Holding(Base):
    __tablename__ = "holdings"

    id: Mapped["uuid.UUID"] = mapped_column(GUID, primary_key=True, default=new_uuid)
    ticker: Mapped[str] = mapped_column(String(32), unique=True, index=True, nullable=False)
    name: Mapped[str] = mapped_column(String(255), nullable=False)

    # Canonical, normalized value (app.domain.asset_class.AssetClass) plus the
    # raw label as originally uploaded, for provenance (§5.2).
    asset_class: Mapped[str] = mapped_column(String(16), nullable=False)
    asset_class_raw: Mapped[str] = mapped_column(String(64), nullable=False)

    sector: Mapped[str | None] = mapped_column(String(128), nullable=True)
    trading_currency: Mapped[str] = mapped_column(String(3), nullable=False)
    institution: Mapped[str | None] = mapped_column(String(128), nullable=True)
    custody_type: Mapped[str | None] = mapped_column(String(64), nullable=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )

    def __repr__(self) -> str:  # pragma: no cover
        return f"<Holding {self.ticker}>"
