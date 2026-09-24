"""Pydantic schemas for the analysis API (app/api/analysis.py, Sprint 4).

`blind_pass`/`reconciliation` reuse the versioned domain schemas directly
(app/domain/analysis_schema/) rather than re-declaring their shape here —
they're already the exact validated contract the LLM's output was checked
against, so there's nothing to translate.
"""
from __future__ import annotations

from datetime import datetime
from decimal import Decimal
from typing import Literal
from uuid import UUID

from pydantic import BaseModel

from app.domain.analysis_schema import (
    BlindPassOutputV1,
    FundBlindPassOutputV1,
    ReconciliationOutputV1,
)


class EvidenceItemOut(BaseModel):
    """One item from the evidence packet a run was built on — lets the
    frontend resolve every `evidence_ids` citation in the output to what it
    actually points at (CLAUDE.md Rule 2: traceable). Read back from the
    run's stored `evidence_packet_json`, so it always shows exactly what the
    model was given for that run, not today's data."""

    id: str
    category: str
    label: str
    content: str
    citation: str | None = None


class EquityAnalysisRunOut(BaseModel):
    model_config = {"protected_namespaces": ()}

    id: UUID
    holding_id: UUID
    status: str
    schema_version: str
    blind_prompt_version: str
    reconciliation_prompt_version: str | None
    evidence_packet_version: str
    provider: str | None
    model_name: str | None
    started_at: datetime
    blind_completed_at: datetime | None
    completed_at: datetime | None
    error_message: str | None
    evidence_unavailable_reasons: list[str]
    # Which one is decided by `schema_version` ("v1" vs "fund_v1", Sprint 8).
    blind_pass: BlindPassOutputV1 | FundBlindPassOutputV1 | None
    blind_pass_citation_warnings: list[str] | None
    reconciliation: ReconciliationOutputV1 | None
    reconciliation_citation_warnings: list[str] | None
    price_target_low: Decimal | None
    price_target_high: Decimal | None
    price_target_currency: str | None
    evidence_items: list[EvidenceItemOut] = []
    user_notes_snapshot: str | None = None
    engine: str = "cloud"
    queued_at: datetime | None = None
    claimed_by: str | None = None
    attempts: int = 0


class EquityHoldingNoteOut(BaseModel):
    holding_id: UUID
    content: str
    updated_at: datetime | None


class EquityHoldingNoteIn(BaseModel):
    content: str


class AnalysisReadinessCheckOut(BaseModel):
    key: str
    label: str
    status: Literal["ok", "warn", "block"]
    detail: str


class AnalysisReadinessOut(BaseModel):
    """GET /analysis/holdings/{id}/readiness — see
    app/services/analysis/readiness.py. Side-effect free: no LLM, market-data
    or research call is made to produce it."""

    holding_id: UUID
    ready: bool
    blockers: int
    warnings: int
    estimated_gemini_calls: int
    gemini_calls_remaining_today: int | None
    checks: list[AnalysisReadinessCheckOut]


# --- Sprint 5B: local worker queue (F8 + F5) ---


class QueuedRunOut(BaseModel):
    """A run as the queue list shows it: no analysis payload, just where it is."""

    model_config = {"protected_namespaces": ()}

    id: UUID
    holding_id: UUID
    ticker: str | None
    holding_name: str | None
    status: str
    engine: str
    queued_at: datetime | None
    claimed_by: str | None
    claimed_at: datetime | None
    started_at: datetime
    completed_at: datetime | None
    attempts: int
    error_message: str | None
    provider: str | None
    model_name: str | None
    verdict: str | None = None


class AnalysisWorkerOut(BaseModel):
    model_config = {"protected_namespaces": ()}

    worker_id: str
    hostname: str | None
    llm_provider: str | None
    model_name: str | None
    state: str
    detail: str | None
    current_run_id: UUID | None
    started_at: datetime
    last_seen_at: datetime
    online: bool


class AnalysisQueueOut(BaseModel):
    workers: list[AnalysisWorkerOut]
    any_worker_online: bool
    pending: list[QueuedRunOut]
    recent: list[QueuedRunOut]


class QueueSkippedOut(BaseModel):
    holding_id: UUID
    ticker: str | None
    holding_name: str | None
    reason: str


class QueueReadyHoldingsOut(BaseModel):
    queued: list[QueuedRunOut]
    already_queued: list[QueuedRunOut]
    skipped: list[QueueSkippedOut]
