"""Market price and FX observation tables (architecture §8.3, §20, §26 Phase 2).

These are source facts (§5.1 evidence tier 1) about what a provider reported
and when — not derived metrics. Every row carries its own `data_status`
(current | delayed | stale | unavailable, §8.3) so a historical valuation
can be reconstructed later without re-querying the provider, and so the UI
can show *how fresh* a number was rather than presenting it as a bare fact
(§13.3 — never false precision).

Observations are append-only: refreshing market data inserts new rows, it
never overwrites a prior observation (§28 — never silently overwrite
historical data). "Latest for a holding" is a query (ORDER BY observed_at
DESC LIMIT 1), not a mutable field.
"""

import uuid
from datetime import datetime, timezone
from decimal import Decimal

from sqlalchemy import DateTime, ForeignKey, Index, Numeric, String
from sqlalchemy.orm import Mapped, mapped_column

from app.config.database import Base
from app.models.types import GUID, new_uuid


class MarketObservation(Base):
    __tablename__ = "market_observations"
    __table_args__ = (
        Index("ix_market_observations_holding_observed", "holding_id", "observed_at"),
    )

    id: Mapped["uuid.UUID"] = mapped_column(GUID, primary_key=True, default=new_uuid)
    holding_id: Mapped["uuid.UUID"] = mapped_column(
        GUID, ForeignKey("holdings.id"), nullable=False, index=True
    )
    observed_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    price: Mapped[Decimal] = mapped_column(Numeric(20, 6), nullable=False)
    currency: Mapped[str] = mapped_column(String(3), nullable=False)
    provider: Mapped[str] = mapped_column(String(32), nullable=False)
    # current | delayed | stale | unavailable (§8.3) — see app.providers.base.
    data_status: Mapped[str] = mapped_column(String(16), nullable=False)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )

    def __repr__(self) -> str:  # pragma: no cover
        return f"<MarketObservation holding={self.holding_id} {self.price} {self.currency} @ {self.observed_at}>"


class FxObservation(Base):
    __tablename__ = "fx_observations"
    __table_args__ = (
        Index("ix_fx_observations_pair_observed", "from_currency", "to_currency", "observed_at"),
    )

    id: Mapped["uuid.UUID"] = mapped_column(GUID, primary_key=True, default=new_uuid)
    from_currency: Mapped[str] = mapped_column(String(3), nullable=False)
    to_currency: Mapped[str] = mapped_column(String(3), nullable=False)
    rate: Mapped[Decimal] = mapped_column(Numeric(20, 8), nullable=False)
    observed_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    provider: Mapped[str] = mapped_column(String(32), nullable=False)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )

    def __repr__(self) -> str:  # pragma: no cover
        return f"<FxObservation {self.from_currency}/{self.to_currency}={self.rate} @ {self.observed_at}>"
