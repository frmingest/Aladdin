"""Pydantic schemas for the watchlist API (feature F7, app/api/watchlist.py)."""
from __future__ import annotations

from datetime import datetime
from decimal import Decimal
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, Field, field_validator, model_validator

from app.domain.sectors import SECTORS, is_valid_sector


class WatchlistCreate(BaseModel):
    """Either `holding_id` (an existing holding) or `ticker`. A ticker that
    isn't a holding yet also needs `name` and `trading_currency`, and a new
    holding is created for it."""

    holding_id: UUID | None = None
    ticker: str | None = Field(default=None, min_length=1, max_length=255)
    name: str | None = Field(default=None, min_length=1, max_length=255)
    trading_currency: str | None = Field(default=None, min_length=3, max_length=3)
    sector: str | None = None
    buy_below_price: Decimal | None = Field(default=None, gt=0)
    notes: str | None = None

    @field_validator("sector")
    @classmethod
    def _validate_sector(cls, value: str | None) -> str | None:
        if value is not None and not is_valid_sector(value):
            raise ValueError(f"sector must be one of {sorted(SECTORS)} (or null)")
        return value

    @model_validator(mode="after")
    def _one_reference(self) -> WatchlistCreate:
        if self.holding_id is None and not self.ticker:
            raise ValueError("give holding_id or ticker")
        return self


class WatchlistUpdate(BaseModel):
    buy_below_price: Decimal | None = Field(default=None, gt=0)
    notes: str | None = None


class WatchlistRowOut(BaseModel):
    id: UUID
    holding_id: UUID
    ticker: str
    name: str
    sector: str | None
    instrument_type: str
    owned: bool
    buy_below_price: Decimal | None
    buy_below_currency: str | None
    notes: str | None
    added_at: datetime
    price: Decimal | None
    price_currency: str | None
    price_as_of: datetime | None
    distance_to_buy_pct: Decimal | None
    status: Literal["buy_zone", "near", "above", "no_target", "no_price", "currency_mismatch"]
    dcf_base: Decimal | None
    margin_of_safety_base: Decimal | None
    verdict_rating: str | None
    moat_rating: str | None
    analyzed_at: datetime | None
    unavailable_reason: str | None


class WatchlistOut(BaseModel):
    rows: list[WatchlistRowOut]
    buy_zone_count: int
