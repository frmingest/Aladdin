"""Physical gold/silver coin holdings: CRUD + a spot-valued overview
(2026-09-26). See this package's __init__.py and pricing.py.

Valuation is spot-only (CLAUDE.md Rule 1: deterministic, no invented
numbers) — quantity x current metal spot price in NOK, converted via the
same live USD/NOK rate the rest of the app uses. No numismatic/dealer
premium is modeled (no free feed for that exists); `purchase_price_nok`,
when the person supplies it, is compared against spot only as an
unrealized P&L for their own reference, never used to derive a value.
"""
from __future__ import annotations

import uuid
from dataclasses import dataclass, field
from datetime import date, datetime
from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.domain.precious_metals import GOLD, METALS, SILVER, get_series, is_valid_series
from app.models.precious_metal import PreciousMetalHolding
from app.providers.base import MarketDataProvider
from app.services.precious_metals.pricing import (
    get_metal_spot_history_usd,
    get_usd_nok_history,
)

ZERO = Decimal(0)


class InvalidCoinSeriesError(ValueError):
    pass


def list_holdings(db: Session) -> list[PreciousMetalHolding]:
    stmt = select(PreciousMetalHolding).order_by(PreciousMetalHolding.created_at.asc())
    return list(db.scalars(stmt))


def get_holding(db: Session, holding_id: uuid.UUID) -> PreciousMetalHolding | None:
    return db.get(PreciousMetalHolding, holding_id)


def create_holding(
    db: Session,
    *,
    coin_series: str,
    quantity: Decimal,
    purchase_date: date | None = None,
    purchase_price_nok: Decimal | None = None,
    storage_location: str | None = None,
    notes: str | None = None,
) -> PreciousMetalHolding:
    if not is_valid_series(coin_series):
        raise InvalidCoinSeriesError(f"Unknown coin series: {coin_series!r}")
    if quantity <= ZERO:
        raise ValueError("quantity must be positive")
    series = get_series(coin_series)
    holding = PreciousMetalHolding(
        coin_series=coin_series,
        metal=series.metal,
        quantity=quantity,
        purchase_date=purchase_date,
        purchase_price_nok=purchase_price_nok,
        storage_location=storage_location,
        notes=notes,
    )
    db.add(holding)
    db.commit()
    db.refresh(holding)
    return holding


def update_holding(
    db: Session,
    holding_id: uuid.UUID,
    *,
    quantity: Decimal | None = None,
    purchase_date: date | None = None,
    purchase_price_nok: Decimal | None = None,
    storage_location: str | None = None,
    notes: str | None = None,
    clear_purchase_price: bool = False,
    clear_storage_location: bool = False,
    clear_notes: bool = False,
) -> PreciousMetalHolding | None:
    holding = get_holding(db, holding_id)
    if holding is None:
        return None
    if quantity is not None:
        if quantity <= ZERO:
            raise ValueError("quantity must be positive")
        holding.quantity = quantity
    if purchase_date is not None:
        holding.purchase_date = purchase_date
    if clear_purchase_price:
        holding.purchase_price_nok = None
    elif purchase_price_nok is not None:
        holding.purchase_price_nok = purchase_price_nok
    if clear_storage_location:
        holding.storage_location = None
    elif storage_location is not None:
        holding.storage_location = storage_location
    if clear_notes:
        holding.notes = None
    elif notes is not None:
        holding.notes = notes
    db.commit()
    db.refresh(holding)
    return holding


def delete_holding(db: Session, holding_id: uuid.UUID) -> bool:
    holding = get_holding(db, holding_id)
    if holding is None:
        return False
    db.delete(holding)
    db.commit()
    return True


@dataclass
class MetalSpotNok:
    metal: str
    available: bool
    price_nok_per_oz: Decimal | None = None
    price_usd_per_oz: Decimal | None = None
    usd_nok_rate: Decimal | None = None
    as_of: datetime | None = None
    reason: str | None = None


@dataclass
class HoldingRow:
    id: uuid.UUID
    coin_series: str
    metal: str
    quantity: Decimal
    purchase_date: date | None
    purchase_price_nok: Decimal | None
    storage_location: str | None
    notes: str | None
    value_nok: Decimal | None
    unrealized_pnl_nok: Decimal | None


@dataclass
class MetalsOverview:
    as_of: datetime
    spots: dict[str, MetalSpotNok] = field(default_factory=dict)
    holdings: list[HoldingRow] = field(default_factory=list)
    total_value_nok: Decimal = ZERO
    total_oz_by_metal: dict[str, Decimal] = field(default_factory=dict)


def _spot_nok(db: Session, metal_provider: MarketDataProvider, fx_provider: MarketDataProvider, metal: str, force: bool) -> MetalSpotNok:
    spot_hist = get_metal_spot_history_usd(db, metal_provider, metal=metal, force=force)
    if not spot_hist.available or not spot_hist.points:
        return MetalSpotNok(metal=metal, available=False, reason=spot_hist.reason or f"no {metal} spot price available")
    fx_hist = get_usd_nok_history(db, fx_provider, force=force)
    if not fx_hist.available or not fx_hist.points:
        return MetalSpotNok(
            metal=metal, available=False, price_usd_per_oz=spot_hist.points[-1][1],
            reason=fx_hist.reason or "no USD/NOK rate available",
        )
    price_usd = spot_hist.points[-1][1]
    rate = fx_hist.points[-1][1]
    return MetalSpotNok(
        metal=metal, available=True, price_usd_per_oz=price_usd, usd_nok_rate=rate,
        price_nok_per_oz=price_usd * rate, as_of=spot_hist.as_of,
    )


def compute_overview(
    db: Session, metal_provider: MarketDataProvider, fx_provider: MarketDataProvider, *, force: bool = False
) -> MetalsOverview:
    spots = {metal: _spot_nok(db, metal_provider, fx_provider, metal, force) for metal in METALS}
    holdings = list_holdings(db)

    total_oz_by_metal: dict[str, Decimal] = {GOLD: ZERO, SILVER: ZERO}
    rows: list[HoldingRow] = []
    total_value = ZERO
    for h in holdings:
        total_oz_by_metal[h.metal] = total_oz_by_metal.get(h.metal, ZERO) + h.quantity
        spot = spots.get(h.metal)
        value_nok = h.quantity * spot.price_nok_per_oz if spot and spot.available and spot.price_nok_per_oz else None
        pnl = value_nok - h.purchase_price_nok if value_nok is not None and h.purchase_price_nok is not None else None
        if value_nok is not None:
            total_value += value_nok
        rows.append(
            HoldingRow(
                id=h.id, coin_series=h.coin_series, metal=h.metal, quantity=h.quantity,
                purchase_date=h.purchase_date, purchase_price_nok=h.purchase_price_nok,
                storage_location=h.storage_location, notes=h.notes,
                value_nok=value_nok, unrealized_pnl_nok=pnl,
            )
        )

    return MetalsOverview(
        as_of=datetime.now().astimezone(),
        spots=spots,
        holdings=rows,
        total_value_nok=total_value,
        total_oz_by_metal=total_oz_by_metal,
    )
