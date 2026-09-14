"""Portfolio risk snapshot (architecture §15, §15.1, §18, §20, §26 Phase 5).

One row per risk assessment: concentration/correlation/exposure/scenario/
systemic-state-risk are each deterministic application-code calculations
(app.domain.portfolio_risk, app.domain.scenarios — §2.2), stored as JSON
because their internal shape is genuinely per-dimension-variable data, not
because they're LLM output. `risk_band` is the primary representation
(§15: "prioritize a risk profile over a single number");
`composite_risk_score` is deliberately secondary (same section) and
`narrative` is a short, code-generated summary sentence, not an LLM memo —
see docs/decisions/0008 for why a portfolio-risk LLM narrative was deferred.
"""

import uuid
from datetime import datetime, timezone
from decimal import Decimal

from sqlalchemy import JSON, DateTime, ForeignKey, Numeric, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.config.database import Base
from app.models.types import GUID, new_uuid


class PortfolioRiskSnapshot(Base):
    __tablename__ = "portfolio_risk_snapshots"

    id: Mapped["uuid.UUID"] = mapped_column(GUID, primary_key=True, default=new_uuid)
    # §20 names the FK analysis_run_id; this snapshot is portfolio-scoped so
    # it also needs the portfolio_snapshot_id an analysis_run_id alone
    # doesn't always give you (a risk snapshot can be built without a
    # completed analysis run) — see docs/decisions/0008 for this deviation,
    # matching the evidence_references.holding_analysis_id precedent (ADR 0006).
    portfolio_snapshot_id: Mapped["uuid.UUID"] = mapped_column(
        GUID, ForeignKey("portfolio_snapshots.id"), nullable=False, index=True
    )
    analysis_run_id: Mapped["uuid.UUID | None"] = mapped_column(
        GUID, ForeignKey("analysis_runs.id"), nullable=True, index=True
    )

    concentration_json: Mapped[dict] = mapped_column(JSON, nullable=False)
    correlation_json: Mapped[dict] = mapped_column(JSON, nullable=False)
    exposure_json: Mapped[dict] = mapped_column(JSON, nullable=False)
    scenario_json: Mapped[dict] = mapped_column(JSON, nullable=False)
    systemic_state_risk_json: Mapped[dict] = mapped_column(JSON, nullable=False)

    risk_band: Mapped[str] = mapped_column(String(24), nullable=False)
    composite_risk_score: Mapped[Decimal | None] = mapped_column(Numeric(6, 2), nullable=True)
    narrative: Mapped[str] = mapped_column(Text, nullable=False)
    risk_scoring_version: Mapped[str] = mapped_column(String(16), nullable=False)
    scenario_version: Mapped[str] = mapped_column(String(16), nullable=False)
    # NULL = built for every account (no filter). A sorted list of account-id
    # strings records which accounts (§26 accounts feature dashboard filter)
    # this particular row was scoped to, so the dashboard can tell an
    # all-accounts risk snapshot apart from one computed for a subset without
    # re-deriving it, and so this table's append-only history (§28: never
    # overwrite, only add rows) stays legible across both kinds.
    account_ids_json: Mapped[list[str] | None] = mapped_column(JSON, nullable=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )

    def __repr__(self) -> str:  # pragma: no cover
        return f"<PortfolioRiskSnapshot {self.id} band={self.risk_band}>"
