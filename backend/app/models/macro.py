"""Numeric macro observations (2026-09-24) — policy rates, yields, CPI,
FX, credit spreads from Norges Bank / FRED / SSB
(app/domain/macro_series.py, app/services/macro/).

Maps the `macro_observations` table that already exists in the real
database from the pre-reset Phase 4 migration (c3f6a1d9e274) and was never
used by the rebuild. Migration a9b0c1d2e3f4 adds `source_series_id`
(nullable, additive) so each value is traceable to the publisher's own
series id, one level more specific than `provider` (CLAUDE.md Rule 2).

Append-only, like the other observation tables: a refresh inserts a row
only for a date that is new or whose published value changed (a revision);
"the value for a date" is the row with the latest `retrieved_at`.
"""
from __future__ import annotations

import uuid
from datetime import datetime, timezone
from decimal import Decimal

from sqlalchemy import DateTime, Index, Numeric, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base
from app.models.types import GUID


class MacroObservation(Base):
    __tablename__ = "macro_observations"
    __table_args__ = (
        Index("ix_macro_observations_series_key", "series_key"),
        Index("ix_macro_observations_series_observed", "series_key", "observed_at"),
    )

    id: Mapped[uuid.UUID] = mapped_column(GUID(), primary_key=True, default=uuid.uuid4)
    series_key: Mapped[str] = mapped_column(String(64), nullable=False)
    provider: Mapped[str] = mapped_column(String(32), nullable=False)
    region: Mapped[str] = mapped_column(String(8), nullable=False)
    value: Mapped[Decimal] = mapped_column(Numeric(20, 6), nullable=False)
    unit: Mapped[str] = mapped_column(String(16), nullable=False)
    observed_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    retrieved_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc)
    )
    source_series_id: Mapped[str | None] = mapped_column(String(64), nullable=True)

    def __repr__(self) -> str:  # pragma: no cover
        return f"<MacroObservation {self.series_key} {self.observed_at:%Y-%m-%d}={self.value}>"


class MacroSeriesStatus(Base):
    """Last fetch attempt per catalogue series — the refresh cache key and
    what System status / the Macro page show when a publisher fails. A
    fetch that finds no new values still counts as a success here, which
    is why this can't be read off macro_observations.retrieved_at."""

    __tablename__ = "macro_series_status"

    series_key: Mapped[str] = mapped_column(String(64), primary_key=True)
    provider: Mapped[str] = mapped_column(String(32), nullable=False)
    last_attempt_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    last_success_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    last_error: Mapped[str | None] = mapped_column(Text, nullable=True)
    # Points inserted by the last successful fetch (new dates + revisions).
    last_inserted: Mapped[int] = mapped_column(nullable=False, default=0)
