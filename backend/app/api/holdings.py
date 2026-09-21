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
from app.domain.instrument_types import INSTRUMENT_TYPES
from app.domain.sectors import SECTORS
from app.models.document import Document
from app.models.financial_line_item import FinancialLineItem
from app.models.holding import Holding
from app.models.portfolio import PortfolioPosition
from app.schemas.holding import HoldingCreate, HoldingFieldOptions, HoldingOut, HoldingUpdate
from app.schemas.metrics import HoldingMetricsOut
from app.services.metrics import compute_holding_metrics

router = APIRouter(prefix="/holdings", tags=["holdings"])


def _to_out(db: Session, holding: Holding) -> HoldingOut:
    return _to_out_many(db, [holding])[0]


def _to_out_many(db: Session, holdings: list[Holding]) -> list[HoldingOut]:
    """Batches the document/position counts for every holding into two
    aggregate queries total, not two queries per holding — the page-load-
    speed fix (2026-09-21). `list_holdings` returns every row in the
    `holdings` table, including the legacy pre-reset ones (individual
    whisky/precious-metals entries — see CLAUDE.md), so on the real DB this
    was previously 2N+1 round trips to Postgres for a page load; now it's
    3 regardless of N.
    """
    if not holdings:
        return []

    ids = [h.id for h in holdings]
    document_counts = dict(
        db.execute(
            select(Document.holding_id, func.count())
            .where(Document.holding_id.in_(ids))
            .group_by(Document.holding_id)
        ).all()
    )
    position_counts = dict(
        db.execute(
            select(PortfolioPosition.holding_id, func.count())
            .where(PortfolioPosition.holding_id.in_(ids))
            .group_by(PortfolioPosition.holding_id)
        ).all()
    )

    return [
        HoldingOut(
            id=h.id,
            ticker=h.ticker,
            name=h.name,
            sector=h.sector,
            trading_currency=h.trading_currency,
            institution=h.institution,
            custody_type=h.custody_type,
            asset_class_raw=h.asset_class_raw,
            created_at=h.created_at,
            updated_at=h.updated_at,
            document_count=document_counts.get(h.id, 0),
            position_count=position_counts.get(h.id, 0),
        )
        for h in holdings
    ]


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
    return _to_out_many(db, list(holdings))


@router.get("/field-options", response_model=HoldingFieldOptions)
def get_field_options() -> HoldingFieldOptions:
    """Backs the frontend's Sector / Instrument Type dropdowns in the
    manual-edit UI (Faiz's request, 2026-09-21) — single source of truth
    so those dropdowns can never offer a value `update_holding` would then
    reject. Must stay registered before `GET /{holding_id}` below, or
    FastAPI will try to parse "field-options" as a holding UUID.
    """
    return HoldingFieldOptions(sectors=list(SECTORS), instrument_types=list(INSTRUMENT_TYPES))


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

    # ticker is now editable (see HoldingUpdate's docstring) but the column
    # is still UNIQUE NOT NULL — check-then-set here, same shape as
    # create_holding's own check, rather than letting a collision fall
    # through to a raw IntegrityError 500.
    if "ticker" in updates and updates["ticker"] != holding.ticker:
        new_ticker = updates["ticker"]
        collision = db.scalar(
            select(Holding).where(Holding.ticker == new_ticker, Holding.id != holding_id)
        )
        if collision is not None:
            raise HTTPException(
                status_code=409, detail=f"a holding with ticker '{new_ticker}' already exists"
            )

    for field, value in updates.items():
        setattr(holding, field, value)

    try:
        db.commit()
    except IntegrityError as exc:  # belt-and-braces — the check above should catch this first
        db.rollback()
        raise HTTPException(
            status_code=409, detail="cannot update holding: ticker already in use"
        ) from exc
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


@router.get("/{holding_id}/periods", response_model=list[str])
def list_holding_periods(holding_id: UUID, db: Session = Depends(get_db)) -> list[str]:
    holding = db.get(Holding, holding_id)
    if holding is None:
        raise HTTPException(status_code=404, detail="holding not found")

    periods = db.scalars(
        select(FinancialLineItem.period)
        .where(FinancialLineItem.holding_id == holding_id)
        .distinct()
        .order_by(FinancialLineItem.period)
    ).all()
    return list(periods)


@router.get("/{holding_id}/metrics", response_model=HoldingMetricsOut)
def get_holding_metrics(
    holding_id: UUID, period: str, db: Session = Depends(get_db)
) -> HoldingMetricsOut:
    """Deterministic ratios computed from this holding's extracted filing
    facts for one period — CLAUDE.md Rule 1, never LLM arithmetic. See
    app/services/metrics.py for which ratios are computable from facts
    alone and why the rest (ROIC/ROE, every valuation multiple) are
    reported as skipped rather than guessed at.
    """
    holding = db.get(Holding, holding_id)
    if holding is None:
        raise HTTPException(status_code=404, detail="holding not found")

    line_items = db.scalars(
        select(FinancialLineItem).where(
            FinancialLineItem.holding_id == holding_id, FinancialLineItem.period == period
        )
    ).all()
    if not line_items:
        raise HTTPException(
            status_code=404,
            detail=f"no extracted facts for holding '{holding.ticker}' in period '{period}'",
        )

    facts = {item.metric: item.value for item in line_items}
    result = compute_holding_metrics(facts)

    return HoldingMetricsOut(
        holding_id=holding_id,
        period=period,
        facts=facts,
        computed=result.computed,
        skipped=result.skipped,
    )
