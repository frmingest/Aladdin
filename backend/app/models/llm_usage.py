"""LLM usage ledger (§28 observability follow-up — flagged in the Phase 8
status review as "computed per analysis run, never persisted or surfaced").
See docs/decisions/0013-llm-usage-ledger-and-rate-limit-estimation.md.

One append-only row per real Gemini API call this application makes, across
both roles that call it (app.providers.google_ai_studio_provider — analysis
blind/reconciliation passes — and app.providers.gemini_research_provider —
macro/sector search grounding). Populated straight from the vendor's own
usage_metadata via the vendor-agnostic app.providers.base.LLMUsageMetrics
shape (§28 rule 8) — these are exact counts, the same numbers Google's own
AI Studio usage/rate-limit dashboards are built from, not an estimate this
application derives independently.

Used by app.services.usage to answer "how much of today's free-tier quota is
left" and "how many more holding analyses can we run" — see that module for
the quota-vs-baseline estimation logic.
"""

import enum
import uuid
from datetime import datetime, timezone

from sqlalchemy import DateTime, Float, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from app.config.database import Base
from app.models.types import GUID, new_uuid


class LLMCallType(str, enum.Enum):
    ANALYSIS_BLIND = "ANALYSIS_BLIND"
    ANALYSIS_RECONCILIATION = "ANALYSIS_RECONCILIATION"
    RESEARCH_MACRO = "RESEARCH_MACRO"
    RESEARCH_SECTOR = "RESEARCH_SECTOR"
    RESEARCH_COMPANY = "RESEARCH_COMPANY"


class LLMUsageEvent(Base):
    __tablename__ = "llm_usage_events"

    id: Mapped["uuid.UUID"] = mapped_column(GUID, primary_key=True, default=new_uuid)
    occurred_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), index=True
    )
    provider: Mapped[str] = mapped_column(String(32), nullable=False)
    model_name: Mapped[str] = mapped_column(String(64), nullable=False)
    # ANALYSIS_BLIND | ANALYSIS_RECONCILIATION | RESEARCH_MACRO | RESEARCH_SECTOR | RESEARCH_COMPANY.
    call_type: Mapped[str] = mapped_column(String(32), nullable=False)
    prompt_version: Mapped[str | None] = mapped_column(String(16), nullable=True)

    # Vendor-reported, exact — see app.providers.base.LLMUsageMetrics. Either
    # can be NULL if the vendor response carried no usage_metadata at all
    # (§28 rule 10: record what we actually got, never fabricate a count).
    input_tokens: Mapped[int | None] = mapped_column(Integer, nullable=True)
    output_tokens: Mapped[int | None] = mapped_column(Integer, nullable=True)
    latency_ms: Mapped[float | None] = mapped_column(Float, nullable=True)

    # Optional provenance — only whichever apply to this call_type. A
    # holding-analysis call (ANALYSIS_*) sets holding_id/analysis_run_id/
    # holding_analysis_id; a macro research call sets none of these; a
    # sector research call sets only `sector` (§9.3 — sector research is
    # cached per-sector, not per-holding).
    holding_id: Mapped["uuid.UUID | None"] = mapped_column(GUID, ForeignKey("holdings.id"), nullable=True)
    analysis_run_id: Mapped["uuid.UUID | None"] = mapped_column(GUID, ForeignKey("analysis_runs.id"), nullable=True)
    holding_analysis_id: Mapped["uuid.UUID | None"] = mapped_column(
        GUID, ForeignKey("holding_analyses.id"), nullable=True
    )
    sector: Mapped[str | None] = mapped_column(String(128), nullable=True)

    def __repr__(self) -> str:  # pragma: no cover
        return f"<LLMUsageEvent {self.call_type} in={self.input_tokens} out={self.output_tokens}>"
