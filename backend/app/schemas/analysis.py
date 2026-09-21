"""Pydantic schemas for the analysis API (app/api/analysis.py, Sprint 4).

`blind_pass`/`reconciliation` reuse the versioned domain schemas directly
(app/domain/analysis_schema/) rather than re-declaring their shape here —
they're already the exact validated contract the LLM's output was checked
against, so there's nothing to translate.
"""
from __future__ import annotations

from datetime import datetime
from decimal import Decimal
from uuid import UUID

from pydantic import BaseModel

from app.domain.analysis_schema import BlindPassOutputV1, ReconciliationOutputV1


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
    blind_pass: BlindPassOutputV1 | None
    blind_pass_citation_warnings: list[str] | None
    reconciliation: ReconciliationOutputV1 | None
    reconciliation_citation_warnings: list[str] | None
    price_target_low: Decimal | None
    price_target_high: Decimal | None
    price_target_currency: str | None


class EquityHoldingNoteOut(BaseModel):
    holding_id: UUID
    content: str
    updated_at: datetime | None


class EquityHoldingNoteIn(BaseModel):
    content: str
