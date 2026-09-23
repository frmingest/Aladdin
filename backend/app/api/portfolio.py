"""Portfolio snapshot/position endpoints — the last Sprint 1 "Minimal API"
deliverable.

Every snapshot must point at a real uploaded document (`source_file_id`,
NOT NULL on the model) — Faiz's explicit choice, 2026-09-21: portfolio
positions stay traceable to real evidence, the same standard as everything
else in this app, no manual-entry shortcut. Upload the portfolio export
first via POST /documents/upload (document_type="portfolio_export", no
holding_id needed — see app/api/documents.py), then create the snapshot
from it here.

Deletion (a whole snapshot, or one position) is destructive (CLAUDE.md
"Destructive operations"): both require `confirm=true`.
"""
from __future__ import annotations

from decimal import Decimal
from uuid import UUID

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.config.database import get_db
from app.domain.errors import FileTooLargeError, UnsupportedFileTypeError
from app.models.account import Account
from app.models.document import Document, DocumentPage
from app.models.financial_line_item import FinancialLineItem
from app.models.holding import Holding
from app.models.legacy_analysis import (
    AnalysisRun,
    EvidenceReference,
    FactorAssessment,
    HoldingAnalysis,
    LlmUsageEvent,
    PortfolioRiskSnapshot,
)
from app.models.portfolio import PortfolioPosition, PortfolioSnapshot
from app.providers.factory import get_object_storage
from app.schemas.account import AccountOut
from app.schemas.document import DocumentOut
from app.schemas.portfolio import (
    ConcentrationOut,
    LegacyAnalysisPurgeCounts,
    PortfolioImportResponse,
    PortfolioOverviewOut,
    PortfolioPositionIn,
    PortfolioPositionOut,
    PortfolioSnapshotCreate,
    PortfolioSnapshotOut,
    PortfolioSnapshotSummary,
    PortfolioWipeResult,
    SnapshotDeleteResult,
)
from app.services.calculations import herfindahl_hirschman_index
from app.services.portfolio_import.csv_parser import CsvParseError
from app.services.portfolio_import.ingestion import import_portfolio_csv
from app.services.portfolio_overview import build_overview

router = APIRouter(prefix="/portfolio", tags=["portfolio"])

SNAPSHOT_STATUS_PROCESSED = "processed"


def _purge_legacy_analysis(db: Session, snapshot_ids: list[UUID]) -> LegacyAnalysisPurgeCounts:
    """Cascade-removes legacy Phase-3/5 rows (see app/models/legacy_analysis.py)
    that reference the given portfolio snapshots — the pre-2026-09-21 app's
    `analysis_runs` and its children, plus `portfolio_risk_snapshots`.

    Deleting a snapshot used to 500 with a raw psycopg2 ForeignKeyViolation
    once a real snapshot had one of these attached (`analysis_runs` and
    `portfolio_risk_snapshots` both reference `portfolio_snapshot_id` with no
    ON DELETE CASCADE — the latter is what Faiz hit doing a `/portfolio/all`
    wipe, 2026-09-21, since it was missed when this function was first
    written for `analysis_runs`). Faiz's explicit choice, 2026-09-21:
    cascade-delete the whole legacy chain rather than block the snapshot
    delete or silently orphan rows. `llm_usage_events` is real spend/usage
    history, not disposable analysis output, so those rows are only
    unlinked (their FKs here are nullable), never deleted.

    Uses plain SQLAlchemy queries (not raw SQL) so this also works against
    the test suite's in-memory SQLite, not just Postgres.
    """
    empty = LegacyAnalysisPurgeCounts(
        analysis_runs=0,
        holding_analyses=0,
        factor_assessments=0,
        evidence_references=0,
        portfolio_risk_snapshots=0,
    )
    if not snapshot_ids:
        return empty

    # portfolio_risk_snapshots hangs directly off portfolio_snapshot_id
    # (not through analysis_runs — its analysis_run_id FK is nullable), so
    # purge it unconditionally rather than only when an analysis_runs row
    # exists too.
    risk_snapshots_deleted = (
        db.query(PortfolioRiskSnapshot)
        .filter(PortfolioRiskSnapshot.portfolio_snapshot_id.in_(snapshot_ids))
        .delete(synchronize_session=False)
    )

    run_ids = list(
        db.scalars(
            select(AnalysisRun.id).where(AnalysisRun.portfolio_snapshot_id.in_(snapshot_ids))
        )
    )
    if not run_ids:
        return LegacyAnalysisPurgeCounts(
            analysis_runs=0,
            holding_analyses=0,
            factor_assessments=0,
            evidence_references=0,
            portfolio_risk_snapshots=risk_snapshots_deleted,
        )

    ha_ids = list(
        db.scalars(select(HoldingAnalysis.id).where(HoldingAnalysis.analysis_run_id.in_(run_ids)))
    )

    evidence_deleted = 0
    factor_deleted = 0
    if ha_ids:
        evidence_deleted = (
            db.query(EvidenceReference)
            .filter(EvidenceReference.holding_analysis_id.in_(ha_ids))
            .delete(synchronize_session=False)
        )
        factor_deleted = (
            db.query(FactorAssessment)
            .filter(FactorAssessment.holding_analysis_id.in_(ha_ids))
            .delete(synchronize_session=False)
        )
        db.query(LlmUsageEvent).filter(LlmUsageEvent.holding_analysis_id.in_(ha_ids)).update(
            {"holding_analysis_id": None}, synchronize_session=False
        )
        db.query(HoldingAnalysis).filter(HoldingAnalysis.id.in_(ha_ids)).delete(
            synchronize_session=False
        )

    db.query(LlmUsageEvent).filter(LlmUsageEvent.analysis_run_id.in_(run_ids)).update(
        {"analysis_run_id": None}, synchronize_session=False
    )
    analysis_runs_deleted = (
        db.query(AnalysisRun).filter(AnalysisRun.id.in_(run_ids)).delete(synchronize_session=False)
    )

    return LegacyAnalysisPurgeCounts(
        analysis_runs=analysis_runs_deleted,
        holding_analyses=len(ha_ids),
        factor_assessments=factor_deleted,
        evidence_references=evidence_deleted,
        portfolio_risk_snapshots=risk_snapshots_deleted,
    )


def _position_to_out(position: PortfolioPosition) -> PortfolioPositionOut:
    return PortfolioPositionOut(
        id=position.id,
        holding_id=position.holding_id,
        ticker=position.holding.ticker,
        holding_name=position.holding.name,
        weight_pct=position.weight_pct,
        quantity=position.quantity,
        cost_basis=position.cost_basis,
        cost_basis_currency=position.cost_basis_currency,
        last_price=position.last_price,
        market_value_nok=position.market_value_nok,
        notes=position.notes,
        account_id=position.account_id,
    )


def _snapshot_to_out(snapshot: PortfolioSnapshot) -> PortfolioSnapshotOut:
    return PortfolioSnapshotOut(
        id=snapshot.id,
        uploaded_at=snapshot.uploaded_at,
        source_file_id=snapshot.source_file_id,
        reporting_currency=snapshot.reporting_currency,
        status=snapshot.status,
        account_id=snapshot.account_id,
        positions=[_position_to_out(p) for p in snapshot.positions],
    )


def _account_to_out(db: Session, account: Account) -> AccountOut:
    position_count = db.scalar(
        select(func.count())
        .select_from(PortfolioPosition)
        .where(PortfolioPosition.account_id == account.id)
    )
    snapshot_count = db.scalar(
        select(func.count())
        .select_from(PortfolioSnapshot)
        .where(PortfolioSnapshot.account_id == account.id)
    )
    return AccountOut(
        id=account.id,
        name=account.name,
        account_number=account.account_number,
        institution=account.institution,
        created_at=account.created_at,
        updated_at=account.updated_at,
        position_count=position_count or 0,
        snapshot_count=snapshot_count or 0,
    )


def _document_to_out(db: Session, document: Document) -> DocumentOut:
    page_count = db.scalar(
        select(func.count()).select_from(DocumentPage).where(DocumentPage.document_id == document.id)
    )
    fact_count = db.scalar(
        select(func.count())
        .select_from(FinancialLineItem)
        .where(FinancialLineItem.document_id == document.id)
    )
    return DocumentOut(
        id=document.id,
        holding_id=document.holding_id,
        type=document.type,
        original_filename=document.original_filename,
        mime_type=document.mime_type,
        size_bytes=document.size_bytes,
        uploaded_at=document.uploaded_at,
        reporting_period=document.reporting_period,
        sha256=document.sha256,
        status=document.status,
        quality_flags=document.quality_flags,
        page_count=page_count or 0,
        fact_count=fact_count or 0,
    )


@router.post("/import-csv", response_model=PortfolioImportResponse, status_code=201)
async def import_csv(
    file: UploadFile = File(...),
    account_number: str | None = Form(default=None),
    account_name: str | None = Form(default=None),
    db: Session = Depends(get_db),
    storage=Depends(get_object_storage),
) -> PortfolioImportResponse:
    """Imports a broker-export CSV (Nordnet-style "Beholdningstabell", one
    per real-world account) straight into an Account + traceable Document +
    PortfolioSnapshot + PortfolioPositions — see
    app/services/portfolio_import/. `account_number` is optional: if
    omitted, it's parsed from the filename (the real exports embed it as
    "...kontono._12345678_..."). Every row is imported and tagged with its
    real instrument type (app/domain/instrument_types.py) — Faiz's explicit
    choice (2026-09-21) over silently skipping non-equity rows (bond funds,
    a physical gold ETC) found in these exports.
    """
    content = await file.read()
    try:
        result = import_portfolio_csv(
            db,
            storage,
            filename=file.filename or "upload.csv",
            content=content,
            account_number=account_number,
            account_name=account_name,
        )
    except UnsupportedFileTypeError as exc:
        raise HTTPException(status_code=415, detail=str(exc)) from exc
    except FileTooLargeError as exc:
        raise HTTPException(status_code=413, detail=str(exc)) from exc
    except CsvParseError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc

    return PortfolioImportResponse(
        document=_document_to_out(db, result.document),
        account=_account_to_out(db, result.account),
        snapshot=_snapshot_to_out(result.snapshot),
        holdings_created=result.holdings_created,
        holdings_matched=result.holdings_matched,
        was_duplicate_file=result.was_duplicate_file,
    )


def _validate_position_refs(db: Session, position: PortfolioPositionIn) -> None:
    if db.get(Holding, position.holding_id) is None:
        raise HTTPException(
            status_code=404, detail=f"holding '{position.holding_id}' not found"
        )
    if position.account_id is not None and db.get(Account, position.account_id) is None:
        raise HTTPException(
            status_code=404, detail=f"account '{position.account_id}' not found"
        )


@router.post("/snapshots", response_model=PortfolioSnapshotOut, status_code=201)
def create_snapshot(
    payload: PortfolioSnapshotCreate, db: Session = Depends(get_db)
) -> PortfolioSnapshotOut:
    document = db.get(Document, payload.source_file_id)
    if document is None:
        raise HTTPException(
            status_code=404, detail=f"document '{payload.source_file_id}' not found"
        )
    if payload.account_id is not None and db.get(Account, payload.account_id) is None:
        raise HTTPException(status_code=404, detail=f"account '{payload.account_id}' not found")
    for position in payload.positions:
        _validate_position_refs(db, position)

    snapshot = PortfolioSnapshot(
        source_file_id=payload.source_file_id,
        reporting_currency=payload.reporting_currency.upper(),
        status=SNAPSHOT_STATUS_PROCESSED,
        account_id=payload.account_id,
    )
    db.add(snapshot)
    db.flush()  # assigns snapshot.id for the positions below

    for position in payload.positions:
        db.add(
            PortfolioPosition(
                snapshot_id=snapshot.id,
                holding_id=position.holding_id,
                weight_pct=position.weight_pct,
                quantity=position.quantity,
                cost_basis=position.cost_basis,
                cost_basis_currency=position.cost_basis_currency,
                last_price=position.last_price,
                market_value_nok=position.market_value_nok,
                notes=position.notes,
                account_id=position.account_id,
            )
        )

    db.commit()
    db.refresh(snapshot)
    return _snapshot_to_out(snapshot)


@router.get("/snapshots", response_model=list[PortfolioSnapshotSummary])
def list_snapshots(
    account_id: UUID | None = None, db: Session = Depends(get_db)
) -> list[PortfolioSnapshotSummary]:
    query = select(PortfolioSnapshot).order_by(PortfolioSnapshot.uploaded_at.desc())
    if account_id is not None:
        query = query.where(PortfolioSnapshot.account_id == account_id)
    snapshots = db.scalars(query).all()
    if not snapshots:
        return []

    # One aggregate query for every snapshot's position count, not one
    # query per snapshot — the page-load-speed fix (2026-09-21): with N
    # snapshots this used to be N round trips to Postgres, now it's 1.
    snapshot_ids = [snap.id for snap in snapshots]
    position_counts = dict(
        db.execute(
            select(PortfolioPosition.snapshot_id, func.count())
            .where(PortfolioPosition.snapshot_id.in_(snapshot_ids))
            .group_by(PortfolioPosition.snapshot_id)
        ).all()
    )

    return [
        PortfolioSnapshotSummary(
            id=snap.id,
            uploaded_at=snap.uploaded_at,
            source_file_id=snap.source_file_id,
            reporting_currency=snap.reporting_currency,
            status=snap.status,
            account_id=snap.account_id,
            position_count=position_counts.get(snap.id, 0),
        )
        for snap in snapshots
    ]


@router.get("/snapshots/{snapshot_id}", response_model=PortfolioSnapshotOut)
def get_snapshot(snapshot_id: UUID, db: Session = Depends(get_db)) -> PortfolioSnapshotOut:
    snapshot = db.get(PortfolioSnapshot, snapshot_id)
    if snapshot is None:
        raise HTTPException(status_code=404, detail="portfolio snapshot not found")
    return _snapshot_to_out(snapshot)


@router.delete("/snapshots/{snapshot_id}", response_model=SnapshotDeleteResult)
def delete_snapshot(
    snapshot_id: UUID, confirm: bool = False, db: Session = Depends(get_db)
) -> SnapshotDeleteResult:
    if not confirm:
        raise HTTPException(
            status_code=400,
            detail="deleting a portfolio snapshot is destructive — pass confirm=true to proceed",
        )
    snapshot = db.get(PortfolioSnapshot, snapshot_id)
    if snapshot is None:
        raise HTTPException(status_code=404, detail="portfolio snapshot not found")

    positions_deleted = len(snapshot.positions)
    # Cascade-purge any legacy Phase-3 analysis rows referencing this
    # snapshot *before* deleting it — otherwise Postgres 500s with a raw
    # ForeignKeyViolation (analysis_runs.portfolio_snapshot_id has no ON
    # DELETE CASCADE). See _purge_legacy_analysis's docstring.
    purge_counts = _purge_legacy_analysis(db, [snapshot_id])

    # cascade="all, delete-orphan" on PortfolioSnapshot.positions (see
    # app/models/portfolio.py) — its positions go with it, by design.
    db.delete(snapshot)
    db.commit()

    return SnapshotDeleteResult(
        deleted_snapshot_id=snapshot_id,
        positions_deleted=positions_deleted,
        legacy_analysis_purged=purge_counts,
    )


@router.delete("/all", response_model=PortfolioWipeResult)
def delete_all_portfolio_data(
    confirm: bool = False, db: Session = Depends(get_db)
) -> PortfolioWipeResult:
    """Wipes every account, portfolio snapshot, and position in one call —
    added 2026-09-21 at Faiz's request, as a faster reset path than
    deleting snapshots/accounts one by one in the UI.

    Scope is deliberately narrower than "everything": Holdings (ticker
    records) and any Documents/extracted financial facts attached to them
    are left untouched — Faiz's explicit choice, since those aren't
    "portfolio" data in the same sense and are often worth keeping even
    after a portfolio reset. This supersedes the CSV-import session's
    earlier "granular deletes only, no bulk wipe" decision, at his
    explicit ask this session — same destructive-operation guardrail
    still applies (CLAUDE.md): `confirm=true` required, same as every
    other delete here.
    """
    if not confirm:
        raise HTTPException(
            status_code=400,
            detail="wiping all portfolio data is destructive — pass confirm=true to proceed",
        )

    snapshot_ids = list(db.scalars(select(PortfolioSnapshot.id)))
    purge_counts = _purge_legacy_analysis(db, snapshot_ids)

    positions_deleted = db.query(PortfolioPosition).delete(synchronize_session=False)
    snapshots_deleted = db.query(PortfolioSnapshot).delete(synchronize_session=False)
    accounts_deleted = db.query(Account).delete(synchronize_session=False)
    db.commit()

    return PortfolioWipeResult(
        accounts_deleted=accounts_deleted,
        snapshots_deleted=snapshots_deleted,
        positions_deleted=positions_deleted,
        legacy_analysis_purged=purge_counts,
    )


@router.post(
    "/snapshots/{snapshot_id}/positions", response_model=PortfolioPositionOut, status_code=201
)
def add_position(
    snapshot_id: UUID, payload: PortfolioPositionIn, db: Session = Depends(get_db)
) -> PortfolioPositionOut:
    snapshot = db.get(PortfolioSnapshot, snapshot_id)
    if snapshot is None:
        raise HTTPException(status_code=404, detail="portfolio snapshot not found")
    _validate_position_refs(db, payload)

    position = PortfolioPosition(
        snapshot_id=snapshot_id,
        holding_id=payload.holding_id,
        weight_pct=payload.weight_pct,
        quantity=payload.quantity,
        cost_basis=payload.cost_basis,
        cost_basis_currency=payload.cost_basis_currency,
        last_price=payload.last_price,
        market_value_nok=payload.market_value_nok,
        notes=payload.notes,
        account_id=payload.account_id,
    )
    db.add(position)
    db.commit()
    db.refresh(position)
    return _position_to_out(position)


@router.delete(
    "/snapshots/{snapshot_id}/positions/{position_id}", status_code=204, response_model=None
)
def delete_position(
    snapshot_id: UUID, position_id: UUID, confirm: bool = False, db: Session = Depends(get_db)
) -> None:
    if not confirm:
        raise HTTPException(
            status_code=400,
            detail="deleting a portfolio position is destructive — pass confirm=true to proceed",
        )
    position = db.get(PortfolioPosition, position_id)
    if position is None or position.snapshot_id != snapshot_id:
        raise HTTPException(status_code=404, detail="portfolio position not found")
    db.delete(position)
    db.commit()


@router.get("/snapshots/{snapshot_id}/concentration", response_model=ConcentrationOut)
def get_concentration(snapshot_id: UUID, db: Session = Depends(get_db)) -> ConcentrationOut:
    """Herfindahl-Hirschman concentration index over this snapshot's
    positions' weight_pct — CLAUDE.md Rule 1, deterministic application
    code (app/services/calculations.py), never the LLM.
    """
    snapshot = db.get(PortfolioSnapshot, snapshot_id)
    if snapshot is None:
        raise HTTPException(status_code=404, detail="portfolio snapshot not found")

    weights: list[Decimal] = [p.weight_pct for p in snapshot.positions if p.weight_pct is not None]
    if not weights:
        raise HTTPException(
            status_code=422,
            detail="cannot compute concentration: no position in this snapshot has a weight_pct",
        )

    hhi = herfindahl_hirschman_index(weights)
    return ConcentrationOut(snapshot_id=snapshot_id, hhi=hhi, position_count=len(weights))


@router.get("/overview", response_model=PortfolioOverviewOut)
def get_portfolio_overview(db: Session = Depends(get_db)) -> PortfolioOverviewOut:
    """Sprint 5 dashboard roll-up: value, allocation, concentration,
    verdict/moat roll-up and a deterministic executive summary over the
    latest snapshot of each account (app/services/portfolio_overview.py).
    Database-only; never calls market data or an LLM."""
    overview = build_overview(db)
    return PortfolioOverviewOut.model_validate(overview, from_attributes=True)
