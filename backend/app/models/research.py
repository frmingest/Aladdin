"""
External research tables (architecture §9.4, §20, §26 Phase 4).

Three append-only tables, matching the Phase 2 market_observations/
fx_observations precedent (§28: never silently overwrite historical data —
a refresh inserts new rows, "latest" is a query, not a mutated field):

- `research_runs` — one row per refresh attempt (§9.4/§10-style run
  record): what kind, which sector (for SECTOR runs), when, and whether it
  completed. This is what app.services.research checks the age of to decide
  whether a refresh is due (§2.7 cache aggressively) — a run's completion
  and timestamp are themselves the cache, not a separate cache layer.
- `research_items` — qualitative macro/sector research (§9.2/§9.3), one row
  per source-attributed item a ResearchProvider returned, keeping the
  source metadata §9.4 requires for auditability.
- `macro_observations` — numeric central-bank/macro data (§9.1), the
  MacroDataProvider counterpart to Phase 2's MarketObservation/FxObservation:
  a source fact (§5.1 evidence tier 1), not a derived metric.
"""

import enum
import uuid
from datetime import datetime, timezone
from decimal import Decimal

from sqlalchemy import DateTime, ForeignKey, Index, Numeric, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.config.database import Base
from app.models.types import GUID, new_uuid


class ResearchRunType(str, enum.Enum):
    MACRO = "MACRO"
    SECTOR = "SECTOR"
    # Per-holding company-specific research (Phase 11/Buffett-Munger redesign
    # Sprint 2, claude/buffett-munger-redesign-sprint-plan-2026-09-20.md) —
    # the Brain's opening step asks for company-specific industry/geography/
    # competitive-environment research (the Iran/energy example), which
    # neither portfolio-wide MACRO nor generic-by-sector SECTOR research
    # covers. Routed by holding_id (see ResearchRun.holding_id below), not
    # sector — one company's research is not shared with sibling holdings
    # the way SECTOR research is.
    COMPANY = "COMPANY"


class ResearchRunStatus(str, enum.Enum):
    RUNNING = "RUNNING"
    COMPLETED = "COMPLETED"
    PARTIAL = "PARTIAL"  # some series/sources failed but at least one item/observation was persisted
    FAILED = "FAILED"


class ResearchRun(Base):
    __tablename__ = "research_runs"
    __table_args__ = (
        # The query app.services.research runs constantly: "what's the most
        # recent completed run of this type (and, for SECTOR, this sector /
        # for COMPANY, this holding)?"
        Index("ix_research_runs_type_sector_completed", "type", "sector", "completed_at"),
        Index("ix_research_runs_type_holding_completed", "type", "holding_id", "completed_at"),
    )

    id: Mapped["uuid.UUID"] = mapped_column(GUID, primary_key=True, default=new_uuid)
    type: Mapped[str] = mapped_column(String(16), nullable=False)  # MACRO | SECTOR | COMPANY
    # Only set for type=SECTOR — the sector string as it appears on
    # Holding.sector (§20), e.g. "Energy". NULL for a portfolio-wide MACRO run.
    sector: Mapped[str | None] = mapped_column(String(128), nullable=True, index=True)
    # Only set for type=COMPANY — the holding this per-company research run
    # is scoped to (Sprint 2). NULL for MACRO/SECTOR runs. Deliberately a
    # column on ResearchRun itself, not just on ResearchItem (which already
    # had a nullable holding_id from Phase 4 but was never populated) —
    # app.services.research.common.latest_completed_run needs to filter runs
    # by holding for the same "is a refresh due" staleness check SECTOR
    # already does by sector.
    holding_id: Mapped["uuid.UUID | None"] = mapped_column(
        GUID, ForeignKey("holdings.id"), nullable=True, index=True
    )
    started_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    status: Mapped[str] = mapped_column(String(16), nullable=False, default=ResearchRunStatus.RUNNING.value)
    # Which registry/prompt version produced this run's items (§2.4
    # reproducibility) — app.domain.macro_series's version for MACRO runs,
    # the research-prompt version (settings.active_research_prompt_version)
    # for both.
    methodology_version: Mapped[str] = mapped_column(String(16), nullable=False)
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)

    items: Mapped[list["ResearchItem"]] = relationship(back_populates="research_run", cascade="all, delete-orphan")

    def __repr__(self) -> str:  # pragma: no cover
        return f"<ResearchRun {self.type} sector={self.sector} ({self.status})>"


class ResearchItem(Base):
    """One source-attributed qualitative research finding (§9.2/§9.3/§9.4)."""

    __tablename__ = "research_items"
    __table_args__ = (Index("ix_research_items_run_id", "research_run_id"),)

    id: Mapped["uuid.UUID"] = mapped_column(GUID, primary_key=True, default=new_uuid)
    research_run_id: Mapped["uuid.UUID"] = mapped_column(
        GUID, ForeignKey("research_runs.id"), nullable=False, index=True
    )
    # Set only when a SECTOR-run item is naturally scoped to one holding —
    # not populated by Phase 4 (sector research is stored per-sector, not
    # per-holding), kept nullable/present now so a future per-holding
    # routing refinement doesn't need a schema change (§20 names this
    # column explicitly).
    holding_id: Mapped["uuid.UUID | None"] = mapped_column(GUID, ForeignKey("holdings.id"), nullable=True)

    source_url: Mapped[str] = mapped_column(Text, nullable=False)
    source_name: Mapped[str] = mapped_column(String(255), nullable=False)
    published_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    retrieved_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    title: Mapped[str] = mapped_column(Text, nullable=False)
    summary: Mapped[str] = mapped_column(Text, nullable=False)
    # macro_news | sector_research (app.providers.gemini_research_provider).
    source_type: Mapped[str] = mapped_column(String(32), nullable=False)
    relevance: Mapped[str] = mapped_column(String(16), nullable=False, default="grounded")
    content_hash: Mapped[str | None] = mapped_column(String(64), nullable=True)

    research_run: Mapped["ResearchRun"] = relationship(back_populates="items")

    def __repr__(self) -> str:  # pragma: no cover
        return f"<ResearchItem {self.source_name} run={self.research_run_id}>"


class MacroObservation(Base):
    """One numeric central-bank/macro data point (§9.1), the MacroDataProvider
    counterpart to app.models.market_data's MarketObservation/FxObservation —
    same append-only, source-fact-not-derived-metric role (§5.1, §28)."""

    __tablename__ = "macro_observations"
    __table_args__ = (
        Index("ix_macro_observations_series_observed", "series_key", "observed_at"),
    )

    id: Mapped["uuid.UUID"] = mapped_column(GUID, primary_key=True, default=new_uuid)
    # Canonical registry key (app.domain.macro_series), e.g. "us_real_yield_10y"
    # — never a raw vendor series id (§28 rule 8).
    series_key: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    provider: Mapped[str] = mapped_column(String(32), nullable=False)  # fred | norges_bank
    region: Mapped[str] = mapped_column(String(8), nullable=False)
    value: Mapped[Decimal] = mapped_column(Numeric(20, 6), nullable=False)
    unit: Mapped[str] = mapped_column(String(16), nullable=False)
    # The period/date the observation covers, per the vendor.
    observed_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    # When this application fetched it — separate from observed_at so a
    # historical run stays reconstructable (§2.3) even though vendors
    # sometimes revise/backfill a prior period's value.
    retrieved_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )

    def __repr__(self) -> str:  # pragma: no cover
        return f"<MacroObservation {self.series_key}={self.value}{self.unit} @ {self.observed_at}>"
