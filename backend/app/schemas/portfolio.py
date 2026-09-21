"""Pydantic schemas for the portfolio API (app/api/portfolio.py) —
snapshots and their positions.
"""
from __future__ import annotations

from datetime import datetime
from decimal import Decimal
from uuid import UUID

from pydantic import BaseModel, Field

from app.schemas.account import AccountOut
from app.schemas.document import DocumentOut


class PortfolioPositionIn(BaseModel):
    holding_id: UUID
    weight_pct: Decimal | None = None
    quantity: Decimal | None = None
    cost_basis: Decimal | None = None
    cost_basis_currency: str | None = Field(default=None, min_length=3, max_length=3)
    notes: str | None = None
    account_id: UUID | None = None


class PortfolioPositionOut(BaseModel):
    id: UUID
    holding_id: UUID
    ticker: str
    holding_name: str
    weight_pct: Decimal | None
    quantity: Decimal | None
    cost_basis: Decimal | None
    cost_basis_currency: str | None
    notes: str | None
    account_id: UUID | None


class PortfolioSnapshotCreate(BaseModel):
    source_file_id: UUID
    reporting_currency: str = Field(min_length=3, max_length=3)
    account_id: UUID | None = None
    positions: list[PortfolioPositionIn] = Field(default_factory=list)


class PortfolioSnapshotOut(BaseModel):
    id: UUID
    uploaded_at: datetime
    source_file_id: UUID
    reporting_currency: str
    status: str
    account_id: UUID | None
    positions: list[PortfolioPositionOut]


class PortfolioSnapshotSummary(BaseModel):
    """List view — same fields as PortfolioSnapshotOut minus the expanded
    position list, plus a count (fetching every position for every
    snapshot on a list endpoint doesn't scale)."""

    id: UUID
    uploaded_at: datetime
    source_file_id: UUID
    reporting_currency: str
    status: str
    account_id: UUID | None
    position_count: int


class ConcentrationOut(BaseModel):
    snapshot_id: UUID
    hhi: Decimal
    position_count: int


class PortfolioImportResponse(BaseModel):
    """POST /portfolio/import-csv's response — a broker-export CSV parsed
    straight into an Account, a Document (the traceable source file), and
    a PortfolioSnapshot with its positions in one call. See
    app/services/portfolio_import/ingestion.py.
    """

    document: DocumentOut
    account: AccountOut
    snapshot: PortfolioSnapshotOut
    holdings_created: int
    holdings_matched: int
    was_duplicate_file: bool


class LegacyAnalysisPurgeCounts(BaseModel):
    """How many pre-2026-09-21 Phase-3/5 rows a snapshot delete (or the bulk
    portfolio wipe) cascade-removed — see app/api/portfolio.py's
    `_purge_legacy_analysis`. `llm_usage_events` rows are never counted
    here because they're never deleted, only unlinked (real spend history).
    """

    analysis_runs: int
    holding_analyses: int
    factor_assessments: int
    evidence_references: int
    portfolio_risk_snapshots: int


class SnapshotDeleteResult(BaseModel):
    """DELETE /portfolio/snapshots/{id}'s response. Changed from a bare 204
    (2026-09-21) so the frontend can tell the person when deleting their
    snapshot also cleaned up legacy analysis records left over from the
    pre-reset app — it previously 500'd outright in that case."""

    deleted_snapshot_id: UUID
    positions_deleted: int
    legacy_analysis_purged: LegacyAnalysisPurgeCounts


class PortfolioWipeResult(BaseModel):
    """DELETE /portfolio/all's response — every account, snapshot, and
    position that was removed. Added 2026-09-21 at Faiz's request, as a
    faster reset path than deleting snapshots/accounts one by one.
    Holdings (ticker records) and their documents are deliberately out of
    scope — his explicit choice."""

    accounts_deleted: int
    snapshots_deleted: int
    positions_deleted: int
    legacy_analysis_purged: LegacyAnalysisPurgeCounts
