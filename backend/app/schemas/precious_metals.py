"""Pydantic schemas for physical gold/silver coin tracking
(app/api/precious_metals.py, 2026-09-26)."""
from __future__ import annotations

from datetime import date, datetime
from decimal import Decimal

from pydantic import BaseModel


class CoinSeriesOut(BaseModel):
    code: str
    name: str
    metal: str
    country: str
    weight_oz: Decimal


class PreciousMetalHoldingCreate(BaseModel):
    coin_series: str
    quantity: Decimal
    purchase_date: date | None = None
    purchase_price_nok: Decimal | None = None
    storage_location: str | None = None
    notes: str | None = None


class PreciousMetalHoldingUpdate(BaseModel):
    quantity: Decimal | None = None
    purchase_date: date | None = None
    purchase_price_nok: Decimal | None = None
    clear_purchase_price: bool = False
    storage_location: str | None = None
    clear_storage_location: bool = False
    notes: str | None = None
    clear_notes: bool = False


class HoldingRowOut(BaseModel):
    id: str
    coin_series: str
    coin_series_label: str
    metal: str
    quantity: Decimal
    purchase_date: date | None
    purchase_price_nok: Decimal | None
    storage_location: str | None
    notes: str | None
    value_nok: Decimal | None
    unrealized_pnl_nok: Decimal | None


class MetalSpotOut(BaseModel):
    metal: str
    available: bool
    price_nok_per_oz: Decimal | None
    price_usd_per_oz: Decimal | None
    usd_nok_rate: Decimal | None
    as_of: datetime | None
    reason: str | None


class PreciousMetalsOverviewOut(BaseModel):
    as_of: datetime
    spots: list[MetalSpotOut]
    holdings: list[HoldingRowOut]
    total_value_nok: Decimal
    total_oz_by_metal: dict[str, Decimal]


class PricePointOut(BaseModel):
    on: date
    price_nok: Decimal


class MetalPriceHistoryOut(BaseModel):
    metal: str
    points: list[PricePointOut]
    method_note: str
