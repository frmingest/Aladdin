"""Investment thesis ledger (architecture §16, §20, §26 Phase 5).

A first-class, user-maintained record of *why* a holding is owned, kept
separate from any AI-generated analysis (§16: "a historical thesis ledger,
rather than a collection of disconnected AI memos"). An LLM analysis run can
read this (it becomes `AnalysisContext.user_notes` — see
app.services.analysis.context) and can flag possible invalidation signals
(app.services.thesis.service.check_invalidation_signal), but per §25's
non-goal ("never automatically alter the user's investment thesis without
explicit user action") nothing here is ever mutated by an analysis run —
only a human's own PATCH request changes a thesis.
"""

import enum
import uuid
from datetime import datetime, timezone

from sqlalchemy import JSON, DateTime, ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.config.database import Base
from app.models.types import GUID, new_uuid


class InvestmentThesisStatus(str, enum.Enum):
    ACTIVE = "ACTIVE"
    UNDER_REVIEW = "UNDER_REVIEW"
    INVALIDATED = "INVALIDATED"
    CLOSED = "CLOSED"  # position sold / thesis retired, kept for history


class InvestmentThesis(Base):
    __tablename__ = "investment_theses"

    id: Mapped["uuid.UUID"] = mapped_column(GUID, primary_key=True, default=new_uuid)
    holding_id: Mapped["uuid.UUID"] = mapped_column(
        GUID, ForeignKey("holdings.id"), nullable=False, index=True
    )

    thesis: Mapped[str] = mapped_column(Text, nullable=False)
    bull_case: Mapped[str | None] = mapped_column(Text, nullable=True)
    bear_case: Mapped[str | None] = mapped_column(Text, nullable=True)
    # list[str] each — free-text assumptions/conditions, not a structured
    # schema (§16 gives no fixed shape for these; forcing one here would
    # invite fabricated structure over what the user actually wrote).
    key_assumptions_json: Mapped[list] = mapped_column(JSON, nullable=False, default=list)
    invalidation_conditions_json: Mapped[list] = mapped_column(JSON, nullable=False, default=list)

    confidence: Mapped[str] = mapped_column(String(8), nullable=False)  # low | medium | high
    status: Mapped[str] = mapped_column(
        String(16), nullable=False, default=InvestmentThesisStatus.ACTIVE.value
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )

    def __repr__(self) -> str:  # pragma: no cover
        return f"<InvestmentThesis holding={self.holding_id} status={self.status}>"
