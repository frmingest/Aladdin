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

    # The Yahoo-Finance-resolvable symbol used by the Phase 2 market-data
    # layer (e.g. "VAR.OL"), which is *not* always the same as `ticker`
    # above. For a canonical-schema upload (§7) `ticker` already is a real
    # exchange ticker. For a Nordnet export (decision 0003) `ticker` is the
    # instrument name instead, since that export has no ticker column at
    # all — using the name there as a market-data symbol would silently
    # fail or, worse, silently match the wrong instrument. So this field
    # starts NULL for those holdings and must be set explicitly (see
    # PATCH /portfolio/holdings/{id}) rather than guessed (§21).
    market_ticker: Mapped[str | None] = mapped_column(String(64), nullable=True)

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
