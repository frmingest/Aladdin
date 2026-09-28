"""The LLM usage ledger: one append-only row per real provider request.

The table (`llm_usage_events`) pre-dates the rebuild — created by
alembic/versions/c7e2f9a1b8d3_llm_usage_ledger.py and never written to by the
new app until 2026-09-28 (Sprint 15 item #1). It is now the source of truth
for "how much of today's Gemini quota is spent", replacing the in-process
counter that reset on every restart and was invisible to the PC worker.

One row = one *real request that reached the vendor* — a retried 429 is its
own row, because a failed call still spends quota. A request the budget guard
refused before sending is recorded as `blocked_by_budget` and never counts
against the budget.

`holding_id` / `analysis_run_id` / `holding_analysis_id` stay unset for now:
the last two point at the legacy analysis tables, and threading a holding id
through every provider call is a separate change (see docs).
"""
from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import DateTime, Float, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base
from app.models.types import GUID

# outcome values
OUTCOME_SUCCESS = "success"
OUTCOME_ERROR = "error"
OUTCOME_BLOCKED = "blocked_by_budget"
# Outcomes that count against a provider's daily request budget.
COUNTED_OUTCOMES = (OUTCOME_SUCCESS, OUTCOME_ERROR)


class LlmUsageEvent(Base):
    __tablename__ = "llm_usage_events"

    id: Mapped[uuid.UUID] = mapped_column(GUID(), primary_key=True, default=uuid.uuid4)
    occurred_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    provider: Mapped[str] = mapped_column(String(32), nullable=False)
    model_name: Mapped[str] = mapped_column(String(64), nullable=False)
    call_type: Mapped[str] = mapped_column(String(32), nullable=False)
    prompt_version: Mapped[str | None] = mapped_column(String(16), nullable=True)
    input_tokens: Mapped[int | None] = mapped_column(Integer, nullable=True)
    output_tokens: Mapped[int | None] = mapped_column(Integer, nullable=True)
    latency_ms: Mapped[float | None] = mapped_column(Float, nullable=True)
    holding_id: Mapped[uuid.UUID | None] = mapped_column(
        GUID(), ForeignKey("holdings.id"), nullable=True
    )
    analysis_run_id: Mapped[uuid.UUID | None] = mapped_column(
        GUID(), ForeignKey("analysis_runs.id"), nullable=True
    )
    holding_analysis_id: Mapped[uuid.UUID | None] = mapped_column(
        GUID(), ForeignKey("holding_analyses.id"), nullable=True
    )
    sector: Mapped[str | None] = mapped_column(String(128), nullable=True)
    # Added 2026-09-28 (migration l1d2e3f4a5b6). Rows written before it were
    # all successful calls, hence the server default.
    outcome: Mapped[str] = mapped_column(
        String(24), nullable=False, default=OUTCOME_SUCCESS, server_default=OUTCOME_SUCCESS
    )
    error_detail: Mapped[str | None] = mapped_column(String(240), nullable=True)
