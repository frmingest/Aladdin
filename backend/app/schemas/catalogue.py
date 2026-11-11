"""Pydantic schemas for the ticker catalogue API (Sal's shop, app/api/catalogue.py)."""
from __future__ import annotations

from datetime import datetime
from decimal import Decimal
from typing import Literal

from pydantic import BaseModel


class CatalogueItemOut(BaseModel):
    ticker: str
    name: str
    currency: str
    sector: str | None
    """The app's sector (app/domain/sectors.py); None = not classified (Yahoo gave none, or one we do not map)."""
    size_band: Literal["giant", "big", "small", "tiny", "unknown"]
    market_cap: Decimal | None
    """Market value at the last refresh, in `currency`. None = unknown."""


class CatalogueOut(BaseModel):
    status: Literal["ready", "empty"]
    """`empty` until the PC worker has stocked the shelves for the first time."""
    as_of: datetime | None
    total: int
    rules_version: str
    items: list[CatalogueItemOut]
