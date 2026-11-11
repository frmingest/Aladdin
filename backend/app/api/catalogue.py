"""Ticker catalogue endpoint for Sal's shop (2026-11-11).

Read only and database only: it never calls Yahoo. The PC worker fills the table
(app/services/ticker_catalogue.py). The list is public market data about what exists on Oslo, not the
user's data, so demo mode serves it unchanged. About 300 rows: the page filters and searches it locally.
"""
from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.config.database import get_db
from app.domain.ticker_catalogue import CATALOGUE_RULES_VERSION, size_band
from app.schemas.catalogue import CatalogueItemOut, CatalogueOut
from app.services import ticker_catalogue

router = APIRouter(prefix="/catalogue", tags=["catalogue"])


@router.get("", response_model=CatalogueOut)
def get_catalogue(db: Session = Depends(get_db)) -> CatalogueOut:
    entries = ticker_catalogue.active_entries(db)
    items = [
        CatalogueItemOut(
            ticker=e.ticker,
            name=e.name,
            currency=e.currency,
            sector=e.sector,
            size_band=size_band(e.market_cap, e.market_cap_currency),
            market_cap=e.market_cap,
        )
        for e in entries
    ]
    return CatalogueOut(
        status="ready" if items else "empty",
        as_of=ticker_catalogue.as_of(db) if items else None,
        total=len(items),
        rules_version=CATALOGUE_RULES_VERSION,
        items=items,
    )
