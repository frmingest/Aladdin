"""Live research tables (Sprint 2 — evidence-first macro/sector/company
research, claude/buffett-munger-rebuild-sprint-plan-2026-09-21.md).

Two append-only tables, matching the ingestion precedent in
app/models/document.py (§28-style discipline carried over from the
pre-reset build: never silently overwrite historical data — a refresh
inserts new rows, "latest" is a query, not a mutated field):

- `research_runs` — one row per refresh attempt: what kind (MACRO/SECTOR/
  COMPANY), which sector or holding it's scoped to, when, and whether it
  completed. app/services/research/common.py checks the age of the latest
  COMPLETED run to decide whether a refresh is due — the run record *is*
  the cache, not a separate cache layer.
- `research_items` — one row per source-attributed finding a
  ResearchProvider returned (app/providers/base.py's ResearchItem),
  keeping the source URL/name CLAUDE.md Rule 2 (evidence-first, always
  traceable) requires for every citable claim.

Both tables already exist in the real Supabase database from before the
2026-09-21 reset (alembic/versions/c3f6a1d9e274_phase4_external_research.py
and .../833738bc967f_company_research.py are still part of this repo's
migration chain — CLAUDE.md: the DB is not being reset, this rebuild's
models are simply built fresh against tables that already match). No new
migration is needed for these two models.

`macro_observations` (numeric central-bank/macro series, e.g. FRED/Norges
Bank) is a separate, not-yet-built subsystem — deliberately deferred, see
the sprint plan doc. This file only covers the qualitative, grounded-search
research this sprint actually implements.
"""
from __future__ import annotations

import enum
import uuid
from datetime import datetime, timezone

from sqlalchemy import DateTime, ForeignKey, Index, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base
from app.models.types import GUID


class ResearchRunType(str, enum.Enum):
    MACRO = "MACRO"
    SECTOR = "SECTOR"
    COMPANY = "COMPANY"


class ResearchRunStatus(str, enum.Enum):
    RUNNING = "RUNNING"
    COMPLETED = "COMPLETED"
    FAILED = "FAILED"


class ResearchRun(Base):
    """One refresh attempt. `sector`/`holding_id` scope SECTOR/COMPANY runs
    respectively and are both NULL for a portfolio-wide MACRO run."""

    __tablename__ = "research_runs"
    __table_args__ = (
        Index("ix_research_runs_sector", "sector"),
        Index("ix_research_runs_type_sector_completed", "type", "sector", "completed_at"),
        Index("ix_research_runs_holding_id", "holding_id"),
        Index("ix_research_runs_type_holding_completed", "type", "holding_id", "completed_at"),
    )

    id: Mapped[uuid.UUID] = mapped_column(GUID(), primary_key=True, default=uuid.uuid4)
    type: Mapped[str] = mapped_column(String(16), nullable=False)  # ResearchRunType
    sector: Mapped[str | None] = mapped_column(String(128), nullable=True)
    holding_id: Mapped[uuid.UUID | None] = mapped_column(
        GUID(), ForeignKey("holdings.id"), nullable=True
    )
    started_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc)
    )
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    status: Mapped[str] = mapped_column(
        String(16), nullable=False, default=ResearchRunStatus.RUNNING.value
    )
    # Which prompt version produced this run's items (app/config/paths.py's
    # prompts/research/{kind}_{version}.md) — CLAUDE.md Rule 3, so a stored
    # item is always traceable back to the exact prompt that produced it.
    methodology_version: Mapped[str] = mapped_column(String(16), nullable=False)
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)

    items: Mapped[list[ResearchItem]] = relationship(
        back_populates="research_run", cascade="all, delete-orphan"
    )

    def __repr__(self) -> str:  # pragma: no cover
        return f"<ResearchRun {self.type} sector={self.sector} holding_id={self.holding_id} ({self.status})>"


class ResearchItem(Base):
    """One source-attributed research finding, always citable as evidence
    (CLAUDE.md Rule 2) via `source_url`/`source_name`."""

    __tablename__ = "research_items"
    __table_args__ = (Index("ix_research_items_research_run_id", "research_run_id"),)

    id: Mapped[uuid.UUID] = mapped_column(GUID(), primary_key=True, default=uuid.uuid4)
    research_run_id: Mapped[uuid.UUID] = mapped_column(
        GUID(), ForeignKey("research_runs.id"), nullable=False
    )
    holding_id: Mapped[uuid.UUID | None] = mapped_column(
        GUID(), ForeignKey("holdings.id"), nullable=True
    )

    source_url: Mapped[str] = mapped_column(Text, nullable=False)
    source_name: Mapped[str] = mapped_column(String(255), nullable=False)
    published_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    retrieved_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    title: Mapped[str] = mapped_column(Text, nullable=False)
    summary: Mapped[str] = mapped_column(Text, nullable=False)
    # macro_news | sector_research | company_research (see
    # app/providers/gemini_research_provider.py) — a plain String(32), not
    # an enforced enum, matching Document.type's precedent.
    source_type: Mapped[str] = mapped_column(String(32), nullable=False)
    relevance: Mapped[str] = mapped_column(String(16), nullable=False, default="grounded")
    content_hash: Mapped[str | None] = mapped_column(String(64), nullable=True)

    research_run: Mapped[ResearchRun] = relationship(back_populates="items")

    def __repr__(self) -> str:  # pragma: no cover
        return f"<ResearchItem {self.source_name} run={self.research_run_id}>"
