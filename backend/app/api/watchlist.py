"""Watchlist endpoints (feature F7) — see app/services/watchlist.py.

GET values each watched company exactly like the margin-of-safety board
(cached prices, refreshed when stale); no LLM call is ever made here.
Removing an entry requires confirm=true and never deletes the holding or
its data.
"""
from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config.database import get_db
from app.domain.instrument_types import classify_instrument
from app.models.holding import Holding
from app.models.watchlist import WatchlistItem
from app.providers.base import MarketDataProvider, RiskFreeRateProvider
from app.providers.factory import get_market_data_provider, get_risk_free_rate_provider
from app.schemas.watchlist import (
    WatchlistCreate,
    WatchlistOut,
    WatchlistRowOut,
    WatchlistUpdate,
)
from app.services.valuation.board import current_positions
from app.services.watchlist import BUY_ZONE, build_row, build_watchlist

router = APIRouter(prefix="/watchlist", tags=["watchlist"])


def _row_out(db: Session, item: WatchlistItem) -> WatchlistRowOut:
    holding = db.get(Holding, item.holding_id)
    owned = holding.id in {p.holding_id for p in current_positions(db)}
    return WatchlistRowOut.model_validate(build_row(item, holding, owned=owned), from_attributes=True)


@router.get("", response_model=WatchlistOut)
def get_watchlist(
    db: Session = Depends(get_db),
    market_data_provider: MarketDataProvider = Depends(get_market_data_provider),
    risk_free_rate_provider: RiskFreeRateProvider = Depends(get_risk_free_rate_provider),
) -> WatchlistOut:
    rows = build_watchlist(
        db, market_data_provider=market_data_provider, risk_free_rate_provider=risk_free_rate_provider
    )
    return WatchlistOut(
        rows=[WatchlistRowOut.model_validate(r, from_attributes=True) for r in rows],
        buy_zone_count=sum(1 for r in rows if r.status == BUY_ZONE),
    )


@router.get("/holdings/{holding_id}", response_model=WatchlistRowOut | None)
def get_watchlist_entry_for_holding(holding_id: UUID, db: Session = Depends(get_db)) -> WatchlistRowOut | None:
    """The watchlist entry for one holding, or null (used by the holding page)."""
    item = db.scalar(select(WatchlistItem).where(WatchlistItem.holding_id == holding_id))
    return _row_out(db, item) if item else None


@router.post("", response_model=WatchlistRowOut, status_code=201)
def add_to_watchlist(payload: WatchlistCreate, db: Session = Depends(get_db)) -> WatchlistRowOut:
    if payload.holding_id is not None:
        holding = db.get(Holding, payload.holding_id)
        if holding is None:
            raise HTTPException(status_code=404, detail="holding not found")
    else:
        ticker = payload.ticker.strip().upper()
        holding = db.scalar(select(Holding).where(Holding.ticker == ticker))
        if holding is None:
            if not payload.name or not payload.trading_currency:
                raise HTTPException(
                    status_code=422,
                    detail=f"'{ticker}' is not a holding yet: give its name and trading currency to add it",
                )
            holding = Holding(
                ticker=ticker,
                name=payload.name.strip(),
                trading_currency=payload.trading_currency.upper(),
                sector=payload.sector,
                asset_class_raw=classify_instrument(payload.name),
            )
            db.add(holding)
            db.flush()

    if db.scalar(select(WatchlistItem.id).where(WatchlistItem.holding_id == holding.id)) is not None:
        raise HTTPException(status_code=409, detail=f"'{holding.ticker}' is already on the watchlist")

    item = WatchlistItem(
        holding_id=holding.id,
        buy_below_price=payload.buy_below_price,
        buy_below_currency=holding.trading_currency if payload.buy_below_price is not None else None,
        notes=payload.notes,
    )
    db.add(item)
    db.commit()
    db.refresh(item)
    return _row_out(db, item)


@router.patch("/{item_id}", response_model=WatchlistRowOut)
def update_watchlist_entry(item_id: UUID, payload: WatchlistUpdate, db: Session = Depends(get_db)) -> WatchlistRowOut:
    item = db.get(WatchlistItem, item_id)
    if item is None:
        raise HTTPException(status_code=404, detail="watchlist entry not found")
    fields = payload.model_fields_set
    if "buy_below_price" in fields:
        item.buy_below_price = payload.buy_below_price
        item.buy_below_currency = item.holding.trading_currency if payload.buy_below_price is not None else None
    if "notes" in fields:
        item.notes = payload.notes
    db.commit()
    db.refresh(item)
    return _row_out(db, item)


@router.delete("/{item_id}", status_code=204, response_model=None)
def remove_from_watchlist(item_id: UUID, confirm: bool = False, db: Session = Depends(get_db)) -> None:
    if not confirm:
        raise HTTPException(status_code=400, detail="pass confirm=true to remove a watchlist entry")
    item = db.get(WatchlistItem, item_id)
    if item is None:
        raise HTTPException(status_code=404, detail="watchlist entry not found")
    db.delete(item)
    db.commit()
