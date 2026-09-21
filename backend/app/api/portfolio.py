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
from app.models.portfolio import PortfolioPosition, PortfolioSnapshot
from app.providers.factory import get_object_storage
from app.schemas.account import AccountOut
from app.schemas.document import DocumentOut
from app.schemas.portfolio import (
    ConcentrationOut,
    PortfolioImportResponse,
    PortfolioPositionIn,
    PortfolioPositionOut,
    PortfolioSnapshotCreate,
    PortfolioSnapshotOut,
    PortfolioSnapshotSummary,
)
from app.services.calculations import herfindahl_hirschman_index
from app.services.portfolio_import.csv_parser import CsvParseError
from app.services.portfolio_import.ingestion import import_portfolio_csv

router = APIRouter(prefix="/portfolio", tags=["portfolio"])

SNAPSHOT_STATUS_PROCESSED = "processed"


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

    return [
        PortfolioSnapshotSummary(
            id=s.id,
            uploaded_at=s.uploaded_at,
            source_file_id=s.source_file_id,
            reporting_currency=s.reporting_currency,
            status=s.status,
            account_id=s.account_id,
            position_count=db.scalar(
                select(func.count())
                .select_from(PortfolioPosition)
                .where(PortfolioPosition.snapshot_id == s.id)
            )
            or 0,
        )
        for s in snapshots
    ]


@router.get("/snapshots/{snapshot_id}", response_model=PortfolioSnapshotOut)
def get_snapshot(snapshot_id: UUID, db: Session = Depends(get_db)) -> PortfolioSnapshotOut:
    snapshot = db.get(PortfolioSnapshot, snapshot_id)
    if snapshot is None:
        raise HTTPException(status_code=404, detail="portfolio snapshot not found")
    return _snapshot_to_out(snapshot)


@router.delete("/snapshots/{snapshot_id}", status_code=204, response_model=None)
def delete_snapshot(
    snapshot_id: UUID, confirm: bool = False, db: Session = Depends(get_db)
) -> None:
    if not confirm:
        raise HTTPException(
            status_code=400,
            detail="deleting a portfolio snapshot is destructive — pass confirm=true to proceed",
        )
    snapshot = db.get(PortfolioSnapshot, snapshot_id)
    if snapshot is None:
        raise HTTPException(status_code=404, detail="portfolio snapshot not found")
    # cascade="all, delete-orphan" on PortfolioSnapshot.positions (see
    # app/models/portfolio.py) — its positions go with it, by design.
    db.delete(snapshot)
    db.commit()


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
