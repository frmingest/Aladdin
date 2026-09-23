"""Sprint 4 — the Buffett/Munger analysis engine's own tables.

Deliberately separate from app/models/legacy_analysis.py's Phase 3 tables
(mapped there read/delete-only, purely so a snapshot delete can cascade-
purge them) — this is a fresh schema per CLAUDE.md Rule 3, not the old one
extended in place. See alembic/versions/b5e1a9c3d7f2_sprint4_equity_analysis.py.
"""
from __future__ import annotations

import enum
import uuid
from datetime import datetime, timezone
from decimal import Decimal
from typing import TYPE_CHECKING, Any

from sqlalchemy import JSON, DateTime, ForeignKey, Index, Integer, Numeric, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base
from app.models.types import GUID

if TYPE_CHECKING:
    from app.models.holding import Holding


class EquityAnalysisRunStatus(str, enum.Enum):
    QUEUED = "QUEUED"  # waiting for the local worker (engine="local", Sprint 5B)
    RUNNING = "RUNNING"
    BLIND_ONLY = "BLIND_ONLY"  # blind pass completed, reconciliation not (yet) run
    COMPLETED = "COMPLETED"  # both passes completed
    FAILED = "FAILED"
    CANCELLED = "CANCELLED"  # a queued run removed before a worker claimed it


class EquityAnalysisEngine(str, enum.Enum):
    """Where the two analysis passes run (Sprint 5B / F8).

    cloud: synchronously inside the request on the server's configured
           LLM (Railway: Gemini).
    local: queued in the shared database; the worker on Faiz's PC
           (`python -m app.worker`) claims it and runs research, blind and
           reconciliation passes there, on Ollama.
    """

    CLOUD = "cloud"
    LOCAL = "local"


PENDING_RUN_STATUSES = (EquityAnalysisRunStatus.QUEUED.value, EquityAnalysisRunStatus.RUNNING.value)


class EquityAnalysisRun(Base):
    """One run of the two-pass Buffett/Munger analysis pipeline for one
    holding: the evidence packet actually used, the blind pass output (no
    user notes — CLAUDE.md Rule 4), and the reconciliation pass output
    (blind output + the holding's notes, if any). Every stored JSON blob
    has already been validated against the versioned pydantic schema in
    app/domain/analysis_schema/ before being written here.
    """

    __tablename__ = "equity_analysis_runs"
    __table_args__ = (
        Index("ix_equity_analysis_runs_holding_completed", "holding_id", "completed_at"),
        Index("ix_equity_analysis_runs_status_queued", "status", "queued_at"),
    )

    id: Mapped[uuid.UUID] = mapped_column(GUID(), primary_key=True, default=uuid.uuid4)
    holding_id: Mapped[uuid.UUID] = mapped_column(GUID(), ForeignKey("holdings.id"), nullable=False)
    status: Mapped[str] = mapped_column(
        String(20), nullable=False, default=EquityAnalysisRunStatus.RUNNING.value
    )

    schema_version: Mapped[str] = mapped_column(String(16), nullable=False)
    blind_prompt_version: Mapped[str] = mapped_column(String(16), nullable=False)
    reconciliation_prompt_version: Mapped[str | None] = mapped_column(String(16), nullable=True)
    evidence_packet_version: Mapped[str] = mapped_column(String(16), nullable=False)
    provider: Mapped[str | None] = mapped_column(String(32), nullable=True)
    model_name: Mapped[str | None] = mapped_column(String(64), nullable=True)

    started_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc)
    )
    blind_completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)

    # The full evidence packet as handed to the LLM (every EvidenceItem,
    # its id, category, label, content, citation) — CLAUDE.md Rule 2: a
    # stored analysis is always independently auditable against exactly
    # what it saw, even if the underlying research/valuation data changes
    # or goes stale afterwards.
    evidence_packet_json: Mapped[Any] = mapped_column(JSON, nullable=False)
    evidence_unavailable_reasons: Mapped[Any] = mapped_column(JSON, nullable=False, default=list)

    blind_pass_json: Mapped[Any] = mapped_column(JSON, nullable=True)
    # evidence_ids the blind pass cited that don't exist in the packet —
    # never silently dropped (CLAUDE.md: fail visibly), surfaced instead.
    blind_pass_citation_warnings: Mapped[Any] = mapped_column(JSON, nullable=True)

    # A snapshot of EquityHoldingNote.content at the moment the
    # reconciliation pass ran (notes are editable later; this is what that
    # specific reconciliation actually saw).
    user_notes_snapshot: Mapped[str | None] = mapped_column(Text, nullable=True)
    reconciliation_json: Mapped[Any] = mapped_column(JSON, nullable=True)
    reconciliation_citation_warnings: Mapped[Any] = mapped_column(JSON, nullable=True)

    # Deterministic (Python-computed from the Sprint 3 DCF bear/bull
    # scenarios, never LLM arithmetic — CLAUDE.md Rule 1). NULL when the
    # DCF itself was unavailable for this holding.
    price_target_low: Mapped[Decimal | None] = mapped_column(Numeric(18, 4), nullable=True)
    price_target_high: Mapped[Decimal | None] = mapped_column(Numeric(18, 4), nullable=True)
    price_target_currency: Mapped[str | None] = mapped_column(String(3), nullable=True)

    # --- Sprint 5B queue (F8 + F5) ---
    # engine: see EquityAnalysisEngine. queued_at is NULL for a cloud run.
    # claimed_by/claimed_at: which worker picked a local run up and when.
    # attempts: how many times a worker has claimed it; a run whose worker
    # disappears is re-queued until attempts reaches the configured maximum,
    # then marked FAILED (app/services/analysis/queue.py).
    engine: Mapped[str] = mapped_column(
        String(16), nullable=False, default=EquityAnalysisEngine.CLOUD.value, server_default="cloud"
    )
    queued_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    claimed_by: Mapped[str | None] = mapped_column(String(128), nullable=True)
    claimed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    attempts: Mapped[int] = mapped_column(Integer, nullable=False, default=0, server_default="0")

    holding: Mapped[Holding] = relationship()

    def __repr__(self) -> str:  # pragma: no cover
        return f"<EquityAnalysisRun holding_id={self.holding_id} ({self.status})>"


class EquityHoldingNote(Base):
    """The portfolio owner's own freeform thesis/notes on a holding — one
    row per holding, edited in place (not append-only like ResearchItem;
    this is the person's own current thinking, not a historical record).

    CLAUDE.md Rule 4: the blind pass must never see this, directly or
    indirectly. Only app/services/analysis/reconciliation_pass.py reads it.
    """

    __tablename__ = "equity_holding_notes"

    id: Mapped[uuid.UUID] = mapped_column(GUID(), primary_key=True, default=uuid.uuid4)
    holding_id: Mapped[uuid.UUID] = mapped_column(
        GUID(), ForeignKey("holdings.id"), nullable=False, unique=True
    )
    content: Mapped[str] = mapped_column(Text, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )

    def __repr__(self) -> str:  # pragma: no cover
        return f"<EquityHoldingNote holding_id={self.holding_id}>"


class AnalysisWorkerHeartbeat(Base):
    """One row per local analysis worker (Sprint 5B / F8), upserted every
    ~30 s by `python -m app.worker`. The server never contacts the worker:
    this row is the only way Railway knows whether a PC is online, which
    model it runs and what it's doing. It is also the worker's lease: a
    RUNNING run whose worker hasn't been seen for the lease period is
    released (app/services/analysis/queue.py).
    """

    __tablename__ = "analysis_worker_heartbeats"

    worker_id: Mapped[str] = mapped_column(String(128), primary_key=True)
    hostname: Mapped[str | None] = mapped_column(String(255), nullable=True)
    llm_provider: Mapped[str | None] = mapped_column(String(32), nullable=True)
    model_name: Mapped[str | None] = mapped_column(String(64), nullable=True)
    # idle | running | waiting_quota | llm_unavailable | stopped
    state: Mapped[str] = mapped_column(String(32), nullable=False, default="idle")
    detail: Mapped[str | None] = mapped_column(Text, nullable=True)
    current_run_id: Mapped[uuid.UUID | None] = mapped_column(GUID(), nullable=True)
    started_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc)
    )
    last_seen_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc)
    )

    def __repr__(self) -> str:  # pragma: no cover
        return f"<AnalysisWorkerHeartbeat {self.worker_id} ({self.state})>"
