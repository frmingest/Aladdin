"""The Norwegian ticker catalogue behind Sal's shop (2026-11-11).

One row per company quoted on Oslo (`.OL`), filled by the PC worker's `ticker_catalogue` job from Yahoo's
screener (app/providers/yfinance_catalogue.py, app/services/ticker_catalogue.py). It is reference data
about what exists, not anything the user owns or follows: no FK to holdings, and a company only becomes a
holding when the user opens its stall. Rows are never deleted: a company Yahoo stops listing is marked
`active = false`, so a stall already on the street keeps its history.
"""
from __future__ import annotations

import uuid
from datetime import datetime, timezone
from decimal import Decimal

from sqlalchemy import Boolean, DateTime, Index, Numeric, String
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base
from app.models.types import GUID


def _now() -> datetime:
    return datetime.now(timezone.utc)


class TickerCatalogueEntry(Base):
    __tablename__ = "ticker_catalogue"
    __table_args__ = (Index("ix_ticker_catalogue_active_cap", "active", "market_cap"),)

    id: Mapped[uuid.UUID] = mapped_column(GUID(), primary_key=True, default=uuid.uuid4)
    ticker: Mapped[str] = mapped_column(String(32), nullable=False, unique=True, index=True)
    """Yahoo symbol, upper case, e.g. EQNR.OL."""
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    exchange: Mapped[str] = mapped_column(String(16), nullable=False, default="OSL")
    currency: Mapped[str] = mapped_column(String(3), nullable=False, default="NOK")
    yahoo_sector: Mapped[str | None] = mapped_column(String(64), nullable=True)
    """Yahoo's own sector name, kept as received."""
    sector: Mapped[str | None] = mapped_column(String(64), nullable=True)
    """The app's sector (app/domain/sectors.py), mapped from `yahoo_sector`; None when unmapped."""
    market_cap: Mapped[Decimal | None] = mapped_column(Numeric(24, 2), nullable=True)
    """Market value at the last refresh, in `market_cap_currency`. Yahoo's figure, never computed here."""
    market_cap_currency: Mapped[str | None] = mapped_column(String(3), nullable=True)
    active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    first_seen_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=_now)
    last_seen_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=_now)

    def __repr__(self) -> str:  # pragma: no cover
        return f"<TickerCatalogueEntry {self.ticker} active={self.active}>"
