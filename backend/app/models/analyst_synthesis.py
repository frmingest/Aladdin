"""Optional "where they'd argue" synthesis (Epic F22, story 22.8).

One row per explicit synthesis run over one Buffett/Munger run and one
Dalio run of the same holding. It is a separate, labelled LLM pass: it
cites both runs' evidence (prefixed B: / D:), and it never overwrites
either run's verdict — the two runs stay independent (ECON-F22-06).
"""
from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Any

from sqlalchemy import JSON, DateTime, ForeignKey, Index, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base
from app.models.types import GUID


class AnalystSynthesis(Base):
    __tablename__ = "analyst_syntheses"
    __table_args__ = (Index("ix_analyst_syntheses_holding_created", "holding_id", "created_at"),)

    id: Mapped[uuid.UUID] = mapped_column(GUID(), primary_key=True, default=uuid.uuid4)
    holding_id: Mapped[uuid.UUID] = mapped_column(GUID(), ForeignKey("holdings.id"), nullable=False)
    buffett_run_id: Mapped[uuid.UUID] = mapped_column(
        GUID(), ForeignKey("equity_analysis_runs.id"), nullable=False
    )
    dalio_run_id: Mapped[uuid.UUID] = mapped_column(
        GUID(), ForeignKey("equity_analysis_runs.id"), nullable=False
    )
    schema_version: Mapped[str] = mapped_column(String(16), nullable=False)
    prompt_version: Mapped[str] = mapped_column(String(16), nullable=False)
    status: Mapped[str] = mapped_column(String(16), nullable=False)  # COMPLETED | FAILED
    provider: Mapped[str | None] = mapped_column(String(32), nullable=True)
    model_name: Mapped[str | None] = mapped_column(String(64), nullable=True)
    output_json: Mapped[Any] = mapped_column(JSON, nullable=True)
    citation_warnings: Mapped[Any] = mapped_column(JSON, nullable=True)
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc)
    )

    def __repr__(self) -> str:  # pragma: no cover
        return f"<AnalystSynthesis holding_id={self.holding_id} ({self.status})>"
