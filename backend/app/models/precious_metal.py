"""PreciousMetalHolding — one manually-entered lot of physical 1oz gold or
silver coins (2026-09-26, at Faiz's request: "part of my investments").

Deliberately its own table, not folded into Holding/PortfolioPosition:
those model brokerage-imported equity positions tied to an account
snapshot (see app/models/holding.py, app/models/portfolio.py's docstrings)
— a physical coin has no ticker, no broker export, and isn't tied to an
account snapshot's "latest wins" rule. It's a standing lot the person adds
and removes by hand, like a decision-journal entry (app/models/journal.py)
rather than an imported position.

`coin_series` stores app/domain/precious_metals.py's catalogue `code`
(validated at the API layer, not by a DB constraint, mirroring how
`Holding.sector` validates against app/domain/sectors.py). `metal` is
stored redundantly (derivable from `coin_series`) so a query can filter/
sum by metal without a Python-side catalogue lookup — same reasoning as
`Holding.asset_class_raw` duplicating what a ticker implies.

Valuation is spot-price-only (quantity x current XAU/XAG price, see
app/services/precious_metals/): no numismatic/dealer premium is tracked,
because no free live premium feed exists (CLAUDE.md: fail visibly, don't
invent a number). `purchase_price_nok` is optional and only used for a
cost-basis/unrealized-P&L comparison the person supplies themselves —
never for valuation.
"""
from __future__ import annotations

import uuid
from datetime import date, datetime, timezone
from decimal import Decimal

from sqlalchemy import Date, DateTime, Numeric, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base
from app.models.types import GUID


class PreciousMetalHolding(Base):
    __tablename__ = "precious_metal_holdings"

    id: Mapped[uuid.UUID] = mapped_column(GUID(), primary_key=True, default=uuid.uuid4)
    coin_series: Mapped[str] = mapped_column(String(64), nullable=False)
    metal: Mapped[str] = mapped_column(String(8), nullable=False)  # "gold" | "silver"
    quantity: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False)
    """Number of 1oz coins in this lot. Numeric, not Integer, only so a
    half-coin fraction isn't structurally impossible if it's ever needed —
    every catalogue entry today is a whole 1oz coin."""
    purchase_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    purchase_price_nok: Mapped[Decimal | None] = mapped_column(Numeric(20, 2), nullable=True)
    """Total price paid for this lot, in NOK — for the person's own cost-
    basis/P&L view only (see this module's docstring). Never used to value
    the lot."""
    storage_location: Mapped[str | None] = mapped_column(String(128), nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc)
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )

    def __repr__(self) -> str:  # pragma: no cover
        return f"<PreciousMetalHolding {self.coin_series} qty={self.quantity}>"
