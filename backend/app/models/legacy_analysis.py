"""Legacy Phase-3/5 AI-analysis and risk tables.

`analysis_runs`, `holding_analyses`, `factor_assessments`,
`evidence_references` (from alembic/versions/b2ad6aca76c1_phase3_ai_analysis_engine.py
+ d8f3a6b2c710's `macro_regime` column), `llm_usage_events` (from
alembic/versions/c7e2f9a1b8d3_llm_usage_ledger.py), and
`portfolio_risk_snapshots` (from
alembic/versions/d4e8b5f1a903_phase5_thesis_and_portfolio_intelligence.py)
all pre-exist in the real Supabase DB from the pre-2026-09-21 app
(CLAUDE.md: the DB is not being reset). Sprint 4 — this rebuild's own
Buffett/Munger analysis engine — hasn't been built yet, so nothing in this
app writes to these tables today.

They're mapped here only so a portfolio-snapshot delete can cascade-purge
the legacy rows that reference it, instead of 500ing with a raw
`ForeignKeyViolation` (which is exactly what happened deleting a real
snapshot, and again with `portfolio_risk_snapshots` on a `/portfolio/all`
wipe, 2026-09-21 — see app/api/portfolio.py's `_purge_legacy_analysis`).
Faiz's explicit choice, 2026-09-21: cascade-delete the legacy analysis (and
risk-snapshot) chain, but never the `llm_usage_events` spend ledger — those
rows just get unlinked (their FKs here are nullable), since that's real
usage/cost history, not disposable analysis output.

When Sprint 4 actually gets built, expect these models to be redesigned
from scratch to match its own versioned output schema (CLAUDE.md Rule 3),
not extended in place — this file exists purely to make the old rows
deletable, not to resurrect the old analysis engine's API surface.
"""
from __future__ import annotations

import uuid
from datetime import datetime
from decimal import Decimal
from typing import Any

from sqlalchemy import JSON, DateTime, Float, ForeignKey, Integer, Numeric, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base
from app.models.types import GUID


class AnalysisRun(Base):
    __tablename__ = "analysis_runs"

    id: Mapped[uuid.UUID] = mapped_column(GUID(), primary_key=True, default=uuid.uuid4)
    portfolio_snapshot_id: Mapped[uuid.UUID] = mapped_column(
        GUID(), ForeignKey("portfolio_snapshots.id"), nullable=False
    )
    started_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    status: Mapped[str] = mapped_column(String(16), nullable=False)
    provider: Mapped[str] = mapped_column(String(32), nullable=False)
    model_name: Mapped[str] = mapped_column(String(64), nullable=False)
    prompt_version: Mapped[str] = mapped_column(String(16), nullable=False)
    scoring_version: Mapped[str] = mapped_column(String(16), nullable=False)
    extraction_schema_version: Mapped[str] = mapped_column(String(16), nullable=False)
    application_version: Mapped[str] = mapped_column(String(32), nullable=False)
    research_snapshot_id: Mapped[uuid.UUID | None] = mapped_column(GUID(), nullable=True)
    requested_holding_ids: Mapped[Any] = mapped_column(JSON, nullable=False)
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)
    macro_regime: Mapped[str] = mapped_column(String(16), nullable=False)


class PortfolioRiskSnapshot(Base):
    """Phase 5's risk-analysis output for a portfolio snapshot (see
    alembic/versions/d4e8b5f1a903_phase5_thesis_and_portfolio_intelligence.py).
    `portfolio_snapshot_id` has no ON DELETE CASCADE, so — like
    `analysis_runs` above — this must be purged before its snapshot can be
    deleted; unlike `analysis_runs` it has no children, so it's a plain
    bulk delete in `_purge_legacy_analysis`, not a cascade chain."""

    __tablename__ = "portfolio_risk_snapshots"

    id: Mapped[uuid.UUID] = mapped_column(GUID(), primary_key=True, default=uuid.uuid4)
    portfolio_snapshot_id: Mapped[uuid.UUID] = mapped_column(
        GUID(), ForeignKey("portfolio_snapshots.id"), nullable=False
    )
    analysis_run_id: Mapped[uuid.UUID | None] = mapped_column(
        GUID(), ForeignKey("analysis_runs.id"), nullable=True
    )
    concentration_json: Mapped[Any] = mapped_column(JSON, nullable=False)
    correlation_json: Mapped[Any] = mapped_column(JSON, nullable=False)
    exposure_json: Mapped[Any] = mapped_column(JSON, nullable=False)
    scenario_json: Mapped[Any] = mapped_column(JSON, nullable=False)
    systemic_state_risk_json: Mapped[Any] = mapped_column(JSON, nullable=False)
    risk_band: Mapped[str] = mapped_column(String(24), nullable=False)
    composite_risk_score: Mapped[Decimal | None] = mapped_column(Numeric(6, 2), nullable=True)
    narrative: Mapped[str] = mapped_column(Text, nullable=False)
    risk_scoring_version: Mapped[str] = mapped_column(String(16), nullable=False)
    scenario_version: Mapped[str] = mapped_column(String(16), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)


class HoldingAnalysis(Base):
    __tablename__ = "holding_analyses"

    id: Mapped[uuid.UUID] = mapped_column(GUID(), primary_key=True, default=uuid.uuid4)
    analysis_run_id: Mapped[uuid.UUID] = mapped_column(
        GUID(), ForeignKey("analysis_runs.id"), nullable=False
    )
    holding_id: Mapped[uuid.UUID] = mapped_column(GUID(), ForeignKey("holdings.id"), nullable=False)
    structured_output_json: Mapped[Any] = mapped_column(JSON, nullable=False)
    overall_score: Mapped[Decimal | None] = mapped_column(Numeric(5, 2), nullable=True)
    confidence: Mapped[str] = mapped_column(String(8), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)


class FactorAssessment(Base):
    __tablename__ = "factor_assessments"

    id: Mapped[uuid.UUID] = mapped_column(GUID(), primary_key=True, default=uuid.uuid4)
    holding_analysis_id: Mapped[uuid.UUID] = mapped_column(
        GUID(), ForeignKey("holding_analyses.id"), nullable=False
    )
    factor: Mapped[str] = mapped_column(String(32), nullable=False)
    score: Mapped[int] = mapped_column(Integer, nullable=False)
    confidence: Mapped[str] = mapped_column(String(8), nullable=False)
    methodology: Mapped[str] = mapped_column(String(16), nullable=False)
    reasoning: Mapped[str] = mapped_column(Text, nullable=False)


class EvidenceReference(Base):
    __tablename__ = "evidence_references"

    id: Mapped[uuid.UUID] = mapped_column(GUID(), primary_key=True, default=uuid.uuid4)
    holding_analysis_id: Mapped[uuid.UUID] = mapped_column(
        GUID(), ForeignKey("holding_analyses.id"), nullable=False
    )
    source_type: Mapped[str] = mapped_column(String(32), nullable=False)
    source_id: Mapped[str] = mapped_column(String(64), nullable=False)
    page_start: Mapped[int | None] = mapped_column(Integer, nullable=True)
    page_end: Mapped[int | None] = mapped_column(Integer, nullable=True)
    section: Mapped[str | None] = mapped_column(String(255), nullable=True)
    relevance: Mapped[str] = mapped_column(String(16), nullable=False)


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
