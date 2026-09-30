"""Stored, ready-to-serve copies of the slow read endpoints (2026-09-30).

One row per page payload (`risk_portfolio`, `valuation_board`, `watchlist`,
`performance:<days>:<benchmark>`). The payload is the endpoint's own JSON
response, so serving it is one primary-key read instead of dozens of
queries and provider calls. `fingerprint` records what the inputs looked
like when it was computed (see app/services/snapshots.py); a mismatch means
the portfolio, watchlist, holdings, documents or analyses changed and the
row is rebuilt on the next read.
"""
from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy import DateTime, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base


class ComputedSnapshot(Base):
    __tablename__ = "computed_snapshots"

    key: Mapped[str] = mapped_column(String(160), primary_key=True)
    payload: Mapped[str] = mapped_column(Text, nullable=False)
    fingerprint: Mapped[str] = mapped_column(String(64), nullable=False)
    computed_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc)
    )
