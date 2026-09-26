"""Stored-data-only price/FX lookups shared by the thesis metric registry,
"what changed" checks and the verdict timeline.

Deliberately never calls a live market-data provider (unlike
app/services/market_data/price.py's `get_or_refresh_price`): GET
/thesis/monitor renders one row per holding with an owned position or a
tripwire, and firing every one of those through a live price/FX refresh
on every dashboard load would be slow and would spend provider quota for
a page that's supposed to be a cheap, always-safe check. Reading a single
holding's thesis (GET /thesis/holdings/{id}) uses the same stored-data
helpers so a tripwire's current value never differs between the two
views. Faiz gets a live price the normal way — opening the holding page,
the margin-of-safety board or the watchlist all refresh it — before
checking the thesis view when he wants the latest number.
"""
from __future__ import annotations

import uuid
from datetime import datetime
from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.market import FxObservation, MarketObservation


def latest_stored_price(db: Session, holding_id: uuid.UUID) -> MarketObservation | None:
    return db.scalar(
        select(MarketObservation)
        .where(MarketObservation.holding_id == holding_id)
        .order_by(MarketObservation.observed_at.desc())
        .limit(1)
    )


def stored_price_at_or_before(
    db: Session, holding_id: uuid.UUID, when: datetime
) -> MarketObservation | None:
    return db.scalar(
        select(MarketObservation)
        .where(MarketObservation.holding_id == holding_id, MarketObservation.observed_at <= when)
        .order_by(MarketObservation.observed_at.desc())
        .limit(1)
    )


def stored_fx_rate(db: Session, from_currency: str, to_currency: str) -> Decimal | None:
    if from_currency == to_currency:
        return Decimal(1)
    return db.scalar(
        select(FxObservation.rate)
        .where(FxObservation.from_currency == from_currency, FxObservation.to_currency == to_currency)
        .order_by(FxObservation.observed_at.desc())
        .limit(1)
    )


def convert_price(db: Session, observation: MarketObservation, to_currency: str) -> Decimal | None:
    """`observation.price` converted into `to_currency` using the latest
    stored FX rate, or None when no such rate is on file (never fetched
    live — see module docstring)."""
    rate = stored_fx_rate(db, observation.currency, to_currency)
    return observation.price * rate if rate is not None else None
