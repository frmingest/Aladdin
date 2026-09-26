"""ThesisTripwire — Sprint 11 thesis tracking's one new table: a
user-defined "metric crosses threshold" rule for a holding, checked by
app/services/thesis/tripwires.py every time it's read — never by the LLM
(CLAUDE.md Rule 1). See
alembic/versions/c7a1e9f3b2d5_thesis_tripwires.py.

`fired_at` is set the first time the metric crosses the threshold in the
configured direction and cleared once it's back on the right side, or the
rule itself is edited/paused (the old firing belonged to the old rule).
`seen_at` records "Faiz looked at this" and is cleared whenever the
tripwire fires again after being acknowledged.
"""
from __future__ import annotations

import uuid
from datetime import datetime, timezone
from decimal import Decimal
from typing import TYPE_CHECKING

from sqlalchemy import Boolean, DateTime, ForeignKey, Numeric, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base
from app.models.types import GUID

if TYPE_CHECKING:
    from app.models.holding import Holding

OPERATOR_BELOW = "below"
OPERATOR_ABOVE = "above"
TRIPWIRE_OPERATORS = (OPERATOR_BELOW, OPERATOR_ABOVE)


class ThesisTripwire(Base):
    __tablename__ = "thesis_tripwires"

    id: Mapped[uuid.UUID] = mapped_column(GUID(), primary_key=True, default=uuid.uuid4)
    holding_id: Mapped[uuid.UUID] = mapped_column(GUID(), ForeignKey("holdings.id"), nullable=False)
    metric: Mapped[str] = mapped_column(String(64), nullable=False)
    operator: Mapped[str] = mapped_column(String(8), nullable=False)
    threshold: Mapped[Decimal] = mapped_column(Numeric(24, 6), nullable=False)
    label: Mapped[str | None] = mapped_column(Text, nullable=True)
    # "manual" (typed in) or "from_analysis" (made from a run's invalidation
    # triggers / metrics-to-monitor) — free text, not an enum, so a new
    # origin never needs a migration.
    origin: Mapped[str | None] = mapped_column(String(32), nullable=True)
    source_run_id: Mapped[uuid.UUID | None] = mapped_column(
        GUID(), ForeignKey("equity_analysis_runs.id"), nullable=True
    )
    active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    fired_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    seen_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc)
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )

    holding: Mapped[Holding] = relationship()

    def __repr__(self) -> str:  # pragma: no cover
        return f"<ThesisTripwire holding_id={self.holding_id} {self.metric} {self.operator} {self.threshold}>"
