"""Portfolio risk (Sprint 12, 2026-09-26): correlation, stress scenarios
and macro regime. See app/services/risk/.

`PriceHistoryObservation` is this sprint's one new table: a daily-close
cache per ticker, append-only like app/models/market.py's observation
tables. It exists purely so the correlation matrix and volatility-based
stress sizing (app/services/risk/price_history.py) don't re-fetch a full
year of daily history from yfinance on every request — the portfolio risk
page can have 20+ holdings, and yfinance has no SLA (see
app/providers/yfinance_provider.py's docstring). Regime classification
(app/services/risk/regime.py) needs no new table: it's computed on demand
from macro_observations, which already stores the history it smooths over.
"""
from __future__ import annotations

import uuid
from datetime import date, datetime, timezone
from decimal import Decimal

from sqlalchemy import Date, DateTime, Index, Numeric, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base
from app.models.types import GUID


class PriceHistoryObservation(Base):
    """One daily close for one ticker, from a market data provider
    (app/providers/base.py's MarketDataProvider.get_daily_price_history).

    Unique on (ticker, observed_on): a refresh that re-fetches an already
    -stored day updates that row's `close`/`fetched_at` in place (a
    corrected close from the vendor) rather than inserting a duplicate —
    the one place this table departs from the pure-insert-only convention
    of app/models/market.py's observation tables, because a whole year of
    history is refreshed as one batch, not appended to one point at a time.
    """

    __tablename__ = "price_history_observations"
    __table_args__ = (
        UniqueConstraint("ticker", "observed_on", name="uq_price_history_ticker_observed"),
        Index("ix_price_history_ticker_observed", "ticker", "observed_on"),
    )

    id: Mapped[uuid.UUID] = mapped_column(GUID(), primary_key=True, default=uuid.uuid4)
    ticker: Mapped[str] = mapped_column(String(32), nullable=False)
    observed_on: Mapped[date] = mapped_column(Date, nullable=False)
    close: Mapped[Decimal] = mapped_column(Numeric(20, 6), nullable=False)
    currency: Mapped[str] = mapped_column(String(3), nullable=False)
    provider: Mapped[str] = mapped_column(String(32), nullable=False)
    fetched_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc)
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc)
    )

    def __repr__(self) -> str:  # pragma: no cover
        return f"<PriceHistoryObservation {self.ticker} {self.observed_on} close={self.close}>"
