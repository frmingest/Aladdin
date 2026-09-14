"""Analysis-run tables (architecture §10, §20, §26 Phase 3).

An analysis run is a first-class, append-only domain object: a historical
analysis must remain understandable even after the application, model,
prompt, or scoring methodology changes later (§10, §28 rule 9) — every row
here records exactly which provider/model/prompt/scoring version produced
it, so nothing here is ever mutated in place once a run completes.

Table shapes follow §20 closely, with two intentional naming deviations
documented in docs/decisions/0006-phase3-ai-analysis-engine.md:
`evidence_references.holding_analysis_id` (§20 names it `analysis_id`) and
`factor_assessments`/`evidence_references` both keying off `holding_analysis`
rather than a separate `analyses` concept — Phase 3 only ever analyzes at
the holding level, portfolio-level synthesis is Phase 5 (§20's
portfolio_risk_snapshots, not built here).
"""

import enum
import uuid
from datetime import datetime, timezone
from decimal import Decimal

from sqlalchemy import JSON, DateTime, ForeignKey, Integer, Numeric, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.config.database import Base
from app.models.types import GUID, new_uuid


class AnalysisRunStatus(str, enum.Enum):
    QUEUED = "QUEUED"
    RUNNING = "RUNNING"
    COMPLETED = "COMPLETED"
    PARTIAL = "PARTIAL"
    FAILED = "FAILED"


class AnalysisRun(Base):
    __tablename__ = "analysis_runs"

    id: Mapped["uuid.UUID"] = mapped_column(GUID, primary_key=True, default=new_uuid)
    portfolio_snapshot_id: Mapped["uuid.UUID"] = mapped_column(
        GUID, ForeignKey("portfolio_snapshots.id"), nullable=False, index=True
    )
    started_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    status: Mapped[str] = mapped_column(String(16), nullable=False, default=AnalysisRunStatus.QUEUED.value)

    # §2.4/§10 — reproducibility: exactly what produced this run.
    provider: Mapped[str] = mapped_column(String(32), nullable=False)
    model_name: Mapped[str] = mapped_column(String(64), nullable=False)
    prompt_version: Mapped[str] = mapped_column(String(16), nullable=False)
    scoring_version: Mapped[str] = mapped_column(String(16), nullable=False)
    # ECON-002 fix (docs/decisions/0014, architecture §13.1) — which named
    # weight profile (app.domain.scoring, scoring/versions/{scoring_version}.yaml)
    # was actually used for every holding in this run, classified once
    # up front from the macro snapshot in effect at run time
    # (app.domain.scoring.classify_macro_regime). Recorded alongside
    # scoring_version (not instead of it) so a past run's weights stay
    # reconstructable even after regime-classification thresholds change
    # later (§2.4) — "baseline" for a scoring_version with no regime
    # profiles at all (e.g. v1), matching that version's only behavior.
    macro_regime: Mapped[str] = mapped_column(String(16), nullable=False, default="baseline")
    extraction_schema_version: Mapped[str] = mapped_column(String(16), nullable=False)
    application_version: Mapped[str] = mapped_column(String(32), nullable=False)
    # Phase 4 (external research) doesn't exist yet — always NULL until then.
    research_snapshot_id: Mapped["uuid.UUID | None"] = mapped_column(GUID, nullable=True)

    # Every holding_id this run was asked to analyze, including ones that
    # failed (see holding_analyses for the ones that succeeded) — so a run's
    # failure count/detail is reconstructable without a separate table.
    requested_holding_ids: Mapped[list] = mapped_column(JSON, nullable=False, default=list)
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)

    holding_analyses: Mapped[list["HoldingAnalysis"]] = relationship(
        back_populates="analysis_run", cascade="all, delete-orphan"
    )

    def __repr__(self) -> str:  # pragma: no cover
        return f"<AnalysisRun {self.id} ({self.status})>"


class HoldingAnalysis(Base):
    __tablename__ = "holding_analyses"

    id: Mapped["uuid.UUID"] = mapped_column(GUID, primary_key=True, default=new_uuid)
    analysis_run_id: Mapped["uuid.UUID"] = mapped_column(
        GUID, ForeignKey("analysis_runs.id"), nullable=False, index=True
    )
    holding_id: Mapped["uuid.UUID"] = mapped_column(
        GUID, ForeignKey("holdings.id"), nullable=False, index=True
    )

    # The full HoldingAnalysisOutput (app.schemas.analysis), as returned by
    # the two-pass LLM analysis (§12) — the LLM's interpretation, kept
    # verbatim for provenance even though structured facts also get their
    # own queryable rows below (factor_assessments, evidence_references).
    structured_output_json: Mapped[dict] = mapped_column(JSON, nullable=False)

    # Deterministic aggregate over factor_assessments (app.domain.scoring) —
    # never LLM-produced (§28 rule 4).
    overall_score: Mapped[Decimal | None] = mapped_column(Numeric(5, 2), nullable=True)
    confidence: Mapped[str] = mapped_column(String(8), nullable=False)  # low | medium | high

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )

    analysis_run: Mapped["AnalysisRun"] = relationship(back_populates="holding_analyses")
    factor_assessments: Mapped[list["FactorAssessment"]] = relationship(
        back_populates="holding_analysis", cascade="all, delete-orphan"
    )
    evidence_references: Mapped[list["EvidenceReference"]] = relationship(
        back_populates="holding_analysis", cascade="all, delete-orphan"
    )

    def __repr__(self) -> str:  # pragma: no cover
        return f"<HoldingAnalysis holding={self.holding_id} score={self.overall_score}>"


class FactorAssessment(Base):
    """One factor's score/confidence/reasoning (§12, §13, §14) — business
    quality, financial strength, and valuation are tracked as separate rows
    (and separate dimensions) rather than folded into one blended number."""

    __tablename__ = "factor_assessments"

    id: Mapped["uuid.UUID"] = mapped_column(GUID, primary_key=True, default=new_uuid)
    holding_analysis_id: Mapped["uuid.UUID"] = mapped_column(
        GUID, ForeignKey("holding_analyses.id"), nullable=False, index=True
    )
    # business_quality | financial_strength | valuation (app.schemas.analysis).
    factor: Mapped[str] = mapped_column(String(32), nullable=False)
    score: Mapped[int] = mapped_column(Integer, nullable=False)
    confidence: Mapped[str] = mapped_column(String(8), nullable=False)
    # §13.2 — every factor here is currently LLM-scored qualitative judgment;
    # the column exists so a future deterministic factor doesn't need a
    # schema change to be told apart from one.
    methodology: Mapped[str] = mapped_column(String(16), nullable=False, default="llm_qualitative")
    reasoning: Mapped[str] = mapped_column(Text, nullable=False)

    holding_analysis: Mapped["HoldingAnalysis"] = relationship(back_populates="factor_assessments")


class EvidenceReference(Base):
    """A specific piece of evidence a holding analysis materially relied on
    (§5.2 provenance, §27 Definition of Done: "material claims have evidence
    references"). Populated from the LLM's `source_references` (evidence_ids
    from the packet it was given — app.services.analysis.context), filtered
    to ids that actually existed in that packet (§28 rule 10: never
    fabricate — an unrecognized cited id is dropped, not invented a home)."""

    __tablename__ = "evidence_references"

    id: Mapped["uuid.UUID"] = mapped_column(GUID, primary_key=True, default=new_uuid)
    holding_analysis_id: Mapped["uuid.UUID"] = mapped_column(
        GUID, ForeignKey("holding_analyses.id"), nullable=False, index=True
    )
    # document_chunk | financial_line_item | market_observation (app.services.analysis.context).
    source_type: Mapped[str] = mapped_column(String(32), nullable=False)
    source_id: Mapped[str] = mapped_column(String(64), nullable=False)
    page_start: Mapped[int | None] = mapped_column(Integer, nullable=True)
    page_end: Mapped[int | None] = mapped_column(Integer, nullable=True)
    section: Mapped[str | None] = mapped_column(String(255), nullable=True)
    relevance: Mapped[str] = mapped_column(String(16), nullable=False, default="cited")

    holding_analysis: Mapped["HoldingAnalysis"] = relationship(back_populates="evidence_references")
