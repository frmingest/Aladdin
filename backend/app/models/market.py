"""Market data tables (Sprint 3 — valuation engine, see
claude/buffett-munger-rebuild-sprint-plan-2026-09-21.md).

Three append-only observation tables, all with the same provenance shape
(`provider`, `observed_at`, `created_at`) as app/models/research.py's
precedent: a refresh inserts a new row, "latest" is a query, never a
mutated field — so a DCF/multiple computed from one of these is always
traceable back to exactly which observation it used (CLAUDE.md Rule 2).

- `MarketObservation` / `FxObservation` match tables that already existed
  in the real Supabase DB before the 2026-09-21 reset
  (alembic/versions/b7018dd1789a_phase2_market_data_and_fx.py) — no new
  migration needed for these two.
- `RiskFreeRateObservation` is new this sprint
  (alembic/versions/a4c9f7e2b6d1_risk_free_rate_observations.py) — backs
  the DCF discount rate (app/services/valuation/discount_rate.py).
"""
from __future__ import annotations

import uuid
from datetime import datetime, timezone
from decimal import Decimal
from typing import TYPE_CHECKING

from sqlalchemy import DateTime, ForeignKey, Index, Numeric, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base
from app.models.types import GUID

if TYPE_CHECKING:
    from app.models.holding import Holding


class MarketObservation(Base):
    """One point-in-time price for a holding, from a market data provider
    (app/providers/base.py's MarketDataProvider) — e.g. yfinance."""

    __tablename__ = "market_observations"
    __table_args__ = (
        Index("ix_market_observations_holding_observed", "holding_id", "observed_at"),
    )

    id: Mapped[uuid.UUID] = mapped_column(GUID(), primary_key=True, default=uuid.uuid4)
    holding_id: Mapped[uuid.UUID] = mapped_column(GUID(), ForeignKey("holdings.id"), nullable=False)
    observed_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    price: Mapped[Decimal] = mapped_column(Numeric(20, 6), nullable=False)
    currency: Mapped[str] = mapped_column(String(3), nullable=False)
    provider: Mapped[str] = mapped_column(String(32), nullable=False)
    # "ok" | "stale" (see app/services/market_data/common.py) — mirrors
    # ResearchRun.status's fail-visibly discipline for a single observation
    # row rather than a whole run.
    data_status: Mapped[str] = mapped_column(String(16), nullable=False, default="ok")
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc)
    )

    holding: Mapped[Holding] = relationship(back_populates="market_observations")

    def __repr__(self) -> str:  # pragma: no cover
        return f"<MarketObservation holding_id={self.holding_id} price={self.price} {self.currency}>"


class FxObservation(Base):
    """One point-in-time FX rate (from_currency -> to_currency)."""

    __tablename__ = "fx_observations"
    __table_args__ = (
        Index(
            "ix_fx_observations_pair_observed",
            "from_currency",
            "to_currency",
            "observed_at",
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(GUID(), primary_key=True, default=uuid.uuid4)
    from_currency: Mapped[str] = mapped_column(String(3), nullable=False)
    to_currency: Mapped[str] = mapped_column(String(3), nullable=False)
    rate: Mapped[Decimal] = mapped_column(Numeric(20, 8), nullable=False)
    observed_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    provider: Mapped[str] = mapped_column(String(32), nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc)
    )

    def __repr__(self) -> str:  # pragma: no cover
        return f"<FxObservation {self.from_currency}->{self.to_currency} rate={self.rate}>"


class RiskFreeRateObservation(Base):
    """One point-in-time government-bond-yield observation for a currency
    (app/providers/base.py's RiskFreeRateProvider) — feeds the DCF discount
    rate's risk-free-rate term."""

    __tablename__ = "risk_free_rate_observations"
    __table_args__ = (
        Index(
            "ix_risk_free_rate_observations_currency_observed",
            "currency",
            "observed_at",
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(GUID(), primary_key=True, default=uuid.uuid4)
    currency: Mapped[str] = mapped_column(String(3), nullable=False)
    rate: Mapped[Decimal] = mapped_column(Numeric(10, 6), nullable=False)
    observed_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    provider: Mapped[str] = mapped_column(String(32), nullable=False)
    source_series_id: Mapped[str] = mapped_column(String(64), nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc)
    )

    def __repr__(self) -> str:  # pragma: no cover
        return f"<RiskFreeRateObservation {self.currency} rate={self.rate} ({self.source_series_id})>"
