"""Destructive deletes for documents and holdings (CLAUDE.md "Destructive
operations"): every caller is an endpoint that already required
`confirm=true`. Added 2026-09-23 at Faiz's request — until then an uploaded
filing, its extracted facts and the stored original file could not be
removed at all, so a true clean slate (or a re-upload after an extraction
fix, blocked by the sha256 duplicate check) was impossible.

Order matters and is the same everywhere: child rows first (facts, pages,
chunks), then the document rows, committed in one transaction; only after
the commit are the original files removed from object storage. A storage
failure therefore never leaves DB rows pointing at a deleted file — at
worst an orphaned file in the bucket, which is reported back by name.

What is never deleted here: `llm_usage_events` (real spend history — only
unlinked, as `_purge_legacy_analysis` does), FX / risk-free-rate
observations (market reference data, not tied to a holding) and sector /
macro research (not holding-specific).
"""
from __future__ import annotations

import logging
import uuid
from dataclasses import dataclass, field

from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from app.models.analysis import EquityAnalysisRun, EquityHoldingNote
from app.models.document import Document, DocumentChunk, DocumentPage
from app.models.financial_line_item import FinancialLineItem
from app.models.holding import Holding
from app.models.legacy_analysis import (
    EvidenceReference,
    FactorAssessment,
    HoldingAnalysis,
    LlmUsageEvent,
)
from app.models.market import MarketObservation
from app.models.portfolio import PortfolioPosition, PortfolioSnapshot
from app.models.research import ResearchItem, ResearchRun
from app.providers.object_storage import ObjectStorageProvider

logger = logging.getLogger(__name__)


class DeletionBlockedError(Exception):
    """The delete would orphan or break something outside its own scope
    (a portfolio snapshot built from this file, positions on a holding).
    The message says what to delete first."""


@dataclass
class DeletionCounts:
    documents: int = 0
    pages: int = 0
    chunks: int = 0
    facts: int = 0
    analysis_runs: int = 0
    notes: int = 0
    market_observations: int = 0
    research_runs: int = 0
    research_items: int = 0
    legacy_holding_analyses: int = 0
    holdings: int = 0
    storage_files_deleted: int = 0
    storage_files_failed: list[str] = field(default_factory=list)


def _snapshot_blockers(db: Session, document_ids: list[uuid.UUID]) -> list[str]:
    if not document_ids:
        return []
    rows = db.execute(
        select(Document.original_filename)
        .join(PortfolioSnapshot, PortfolioSnapshot.source_file_id == Document.id)
        .where(Document.id.in_(document_ids))
        .distinct()
    ).all()
    return [name for (name,) in rows]


def _delete_document_rows(
    db: Session, document_ids: list[uuid.UUID], counts: DeletionCounts
) -> list[str]:
    """Deletes the rows (no commit) and returns the storage paths to remove
    once the caller has committed."""
    if not document_ids:
        return []
    paths = list(db.scalars(select(Document.storage_path).where(Document.id.in_(document_ids))))
    counts.facts += (
        db.query(FinancialLineItem)
        .filter(FinancialLineItem.document_id.in_(document_ids))
        .delete(synchronize_session=False)
    )
    counts.pages += (
        db.query(DocumentPage)
        .filter(DocumentPage.document_id.in_(document_ids))
        .delete(synchronize_session=False)
    )
    counts.chunks += (
        db.query(DocumentChunk)
        .filter(DocumentChunk.document_id.in_(document_ids))
        .delete(synchronize_session=False)
    )
    counts.documents += (
        db.query(Document).filter(Document.id.in_(document_ids)).delete(synchronize_session=False)
    )
    return paths


def _remove_files(storage: ObjectStorageProvider, paths: list[str], counts: DeletionCounts) -> None:
    for path in paths:
        try:
            storage.delete(path)
            counts.storage_files_deleted += 1
        except Exception as exc:  # noqa: BLE001 — reported, never swallowed silently
            logger.warning("could not delete stored file %s: %s", path, exc)
            counts.storage_files_failed.append(path)


def delete_documents(
    db: Session, storage: ObjectStorageProvider, document_ids: list[uuid.UUID]
) -> DeletionCounts:
    """Deletes documents with their pages, chunks and extracted facts, then
    the original files. Refused if a portfolio snapshot was imported from
    one of them — delete that snapshot on the Portfolio page first."""
    blockers = _snapshot_blockers(db, document_ids)
    if blockers:
        raise DeletionBlockedError(
            "a portfolio snapshot was imported from "
            + ", ".join(f"'{b}'" for b in blockers)
            + " — delete that snapshot (Portfolio page) first"
        )
    counts = DeletionCounts()
    paths = _delete_document_rows(db, document_ids, counts)
    db.commit()
    _remove_files(storage, paths, counts)
    return counts


def _purge_holding_rows(db: Session, holding_ids: list[uuid.UUID], counts: DeletionCounts) -> list[str]:
    """Everything that hangs off the given holdings except portfolio
    positions (checked by callers). No commit."""
    document_ids = list(db.scalars(select(Document.id).where(Document.holding_id.in_(holding_ids))))
    blockers = _snapshot_blockers(db, document_ids)
    if blockers:
        raise DeletionBlockedError(
            "a portfolio snapshot was imported from "
            + ", ".join(f"'{b}'" for b in blockers)
            + " — delete that snapshot (Portfolio page) first"
        )
    paths = _delete_document_rows(db, document_ids, counts)
    # Facts are keyed on holding too; any left without a document (none
    # expected) go as well so the holding row can be removed.
    counts.facts += (
        db.query(FinancialLineItem)
        .filter(FinancialLineItem.holding_id.in_(holding_ids))
        .delete(synchronize_session=False)
    )
    counts.analysis_runs += (
        db.query(EquityAnalysisRun)
        .filter(EquityAnalysisRun.holding_id.in_(holding_ids))
        .delete(synchronize_session=False)
    )
    counts.notes += (
        db.query(EquityHoldingNote)
        .filter(EquityHoldingNote.holding_id.in_(holding_ids))
        .delete(synchronize_session=False)
    )
    counts.market_observations += (
        db.query(MarketObservation)
        .filter(MarketObservation.holding_id.in_(holding_ids))
        .delete(synchronize_session=False)
    )
    run_ids = list(db.scalars(select(ResearchRun.id).where(ResearchRun.holding_id.in_(holding_ids))))
    item_filters = [ResearchItem.holding_id.in_(holding_ids)]
    if run_ids:
        item_filters.append(ResearchItem.research_run_id.in_(run_ids))
    counts.research_items += (
        db.query(ResearchItem).filter(or_(*item_filters)).delete(synchronize_session=False)
    )
    if run_ids:
        counts.research_runs += (
            db.query(ResearchRun).filter(ResearchRun.id.in_(run_ids)).delete(synchronize_session=False)
        )
    # Pre-rebuild analysis rows (normally already purged with their
    # snapshots) and spend history links.
    ha_ids = list(db.scalars(select(HoldingAnalysis.id).where(HoldingAnalysis.holding_id.in_(holding_ids))))
    if ha_ids:
        db.query(EvidenceReference).filter(EvidenceReference.holding_analysis_id.in_(ha_ids)).delete(
            synchronize_session=False
        )
        db.query(FactorAssessment).filter(FactorAssessment.holding_analysis_id.in_(ha_ids)).delete(
            synchronize_session=False
        )
        db.query(LlmUsageEvent).filter(LlmUsageEvent.holding_analysis_id.in_(ha_ids)).update(
            {"holding_analysis_id": None}, synchronize_session=False
        )
        counts.legacy_holding_analyses += (
            db.query(HoldingAnalysis).filter(HoldingAnalysis.id.in_(ha_ids)).delete(synchronize_session=False)
        )
    db.query(LlmUsageEvent).filter(LlmUsageEvent.holding_id.in_(holding_ids)).update(
        {"holding_id": None}, synchronize_session=False
    )
    return paths


def purge_holding(
    db: Session, storage: ObjectStorageProvider, holding: Holding, *, keep_holding: bool
) -> DeletionCounts:
    """Deletes every document, fact, analysis run, note, price observation
    and company research item for one holding. With keep_holding=False the
    holding row goes too. Refused while portfolio positions reference the
    holding (portfolio data is deleted on the Portfolio page)."""
    counts = DeletionCounts()
    if not keep_holding:
        positions = db.scalar(
            select(PortfolioPosition.id).where(PortfolioPosition.holding_id == holding.id).limit(1)
        )
        if positions is not None:
            raise DeletionBlockedError(
                f"'{holding.ticker}' is still in a portfolio snapshot — delete that snapshot "
                "(or wipe the portfolio) first"
            )
    paths = _purge_holding_rows(db, [holding.id], counts)
    if not keep_holding:
        db.query(Holding).filter(Holding.id == holding.id).delete(synchronize_session=False)
        counts.holdings = 1
    db.commit()
    db.expire_all()
    _remove_files(storage, paths, counts)
    return counts


def wipe_all_holdings(db: Session, storage: ObjectStorageProvider) -> DeletionCounts:
    """Clean slate for the holdings side: every holding and everything
    attached to it, plus any remaining document not tied to a holding (old
    portfolio CSV exports). Refused while any portfolio snapshot exists —
    wipe the portfolio first (DELETE /portfolio/all), so the two destructive
    steps each stay explicit."""
    if db.scalar(select(PortfolioSnapshot.id).limit(1)) is not None:
        raise DeletionBlockedError(
            "portfolio snapshots still exist — wipe the portfolio first (DELETE /portfolio/all)"
        )
    counts = DeletionCounts()
    holding_ids = list(db.scalars(select(Holding.id)))
    paths: list[str] = []
    if holding_ids:
        paths += _purge_holding_rows(db, holding_ids, counts)
    remaining = list(db.scalars(select(Document.id)))
    paths += _delete_document_rows(db, remaining, counts)
    if holding_ids:
        counts.holdings = (
            db.query(Holding).filter(Holding.id.in_(holding_ids)).delete(synchronize_session=False)
        )
    db.commit()
    db.expire_all()
    _remove_files(storage, paths, counts)
    return counts
