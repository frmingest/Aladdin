"""Holding CRUD endpoints — Sprint 1's "Minimal API" deliverable.

Closes the gap flagged after document ingestion shipped: a document could
only be attached to a `holding_id` that already existed in the DB, created
directly (not through the app). This router is how a holding gets created
in the first place.

Deletion is destructive (CLAUDE.md "Destructive operations"): it requires
`confirm=true` and is refused outright if the holding still has documents,
positions, or extracted facts pointing at it — no cascade, no silent
orphaning. Delete those first.
"""
from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.config.database import get_db
from app.models.document import Document
from app.models.financial_line_item import FinancialLineItem
from app.models.holding import Holding
from app.models.portfolio import PortfolioPosition
from app.schemas.holding import HoldingCreate, HoldingOut, HoldingUpdate

router = APIRouter(prefix="/holdings", tags=["holdings"])


def _to_out(db: Session, holding: Holding) -> HoldingOut:
    document_count = db.scalar(
        select(func.count()).select_from(Document).where(Document.holding_id == holding.id)
    )
    position_count = db.scalar(
        select(func.count())
        .select_from(PortfolioPosition)
        .where(PortfolioPosition.holding_id == holding.id)
    )
    return HoldingOut(
        id=holding.id,
        ticker=holding.ticker,
        name=holding.name,
        sector=holding.sector,
        trading_currency=holding.trading_currency,
        institution=holding.institution,
        custody_type=holding.custody_type,
        created_at=holding.created_at,
        updated_at=holding.updated_at,
        document_count=document_count or 0,
        position_count=position_count or 0,
    )


@router.post("", response_model=HoldingOut, status_code=201)
def create_holding(payload: HoldingCreate, db: Session = Depends(get_db)) -> HoldingOut:
    existing = db.scalar(select(Holding).where(Holding.ticker == payload.ticker))
    if existing is not None:
        raise HTTPException(
            status_code=409, detail=f"a holding with ticker '{payload.ticker}' already exists"
        )

    holding = Holding(
        ticker=payload.ticker,
        name=payload.name,
        trading_currency=payload.trading_currency.upper(),
        sector=payload.sector,
        institution=payload.institution,
        custody_type=payload.custody_type,
    )
    db.add(holding)
    db.commit()
    db.refresh(holding)
    return _to_out(db, holding)


@router.get("", response_model=list[HoldingOut])
def list_holdings(db: Session = Depends(get_db)) -> list[HoldingOut]:
    holdings = db.scalars(select(Holding).order_by(Holding.ticker)).all()
    return [_to_out(db, h) for h in holdings]


@router.get("/{holding_id}", response_model=HoldingOut)
def get_holding(holding_id: UUID, db: Session = Depends(get_db)) -> HoldingOut:
    holding = db.get(Holding, holding_id)
    if holding is None:
        raise HTTPException(status_code=404, detail="holding not found")
    return _to_out(db, holding)


@router.patch("/{holding_id}", response_model=HoldingOut)
def update_holding(
    holding_id: UUID, payload: HoldingUpdate, db: Session = Depends(get_db)
) -> HoldingOut:
    holding = db.get(Holding, holding_id)
    if holding is None:
        raise HTTPException(status_code=404, detail="holding not found")

    updates = payload.model_dump(exclude_unset=True)
    if "trading_currency" in updates and updates["trading_currency"] is not None:
        updates["trading_currency"] = updates["trading_currency"].upper()
    for field, value in updates.items():
        setattr(holding, field, value)

    db.commit()
    db.refresh(holding)
    return _to_out(db, holding)


@router.delete("/{holding_id}", status_code=204, response_model=None)
def delete_holding(
    holding_id: UUID, confirm: bool = False, db: Session = Depends(get_db)
) -> None:
    if not confirm:
        raise HTTPException(
            status_code=400,
            detail="deleting a holding is destructive — pass confirm=true to proceed",
        )

    holding = db.get(Holding, holding_id)
    if holding is None:
        raise HTTPException(status_code=404, detail="holding not found")

    blockers = []
    document_count = db.scalar(
        select(func.count()).select_from(Document).where(Document.holding_id == holding_id)
    )
    if document_count:
        blockers.append(f"{document_count} document(s)")
    position_count = db.scalar(
        select(func.count())
        .select_from(PortfolioPosition)
        .where(PortfolioPosition.holding_id == holding_id)
    )
    if position_count:
        blockers.append(f"{position_count} portfolio position(s)")
    fact_count = db.scalar(
        select(func.count())
        .select_from(FinancialLineItem)
        .where(FinancialLineItem.holding_id == holding_id)
    )
    if fact_count:
        blockers.append(f"{fact_count} extracted fact(s)")

    if blockers:
        raise HTTPException(
            status_code=409,
            detail=(
                f"cannot delete holding '{holding.ticker}': still referenced by "
                f"{', '.join(blockers)}. Delete those first."
            ),
        )

    try:
        db.delete(holding)
        db.commit()
    except IntegrityError as exc:  # belt-and-braces — the checks above should catch this first
        db.rollback()
        raise HTTPException(
            status_code=409, detail="cannot delete holding: still referenced elsewhere"
        ) from exc
