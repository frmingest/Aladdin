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

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.config.database import get_db
from app.models.account import Account
from app.models.document import Document
from app.models.holding import Holding
from app.models.portfolio import PortfolioPosition, PortfolioSnapshot
from app.schemas.portfolio import (
    ConcentrationOut,
    PortfolioPositionIn,
    PortfolioPositionOut,
    PortfolioSnapshotCreate,
    PortfolioSnapshotOut,
    PortfolioSnapshotSummary,
)
from app.services.calculations import herfindahl_hirschman_index

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
