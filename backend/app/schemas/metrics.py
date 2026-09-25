"""Pydantic schemas for the read-only computed-metrics endpoints
(app/api/holdings.py, backed by app/services/metrics.py)."""
from __future__ import annotations

from datetime import datetime
from decimal import Decimal
from uuid import UUID

from pydantic import BaseModel


class MetricFactOut(BaseModel):
    """One extracted input behind the ratios — where it came from, so every
    number on the metrics panel can be traced to a file, page and tag."""

    metric: str
    value: Decimal
    currency: str | None
    document_id: UUID
    original_filename: str
    source_page: int | None
    confidence: float
    # e.g. "ifrs-full:CostOfSales", "derived: A + B", "proxy: ..." — only
    # known for iXBRL uploads; None for sources that don't record it.
    source: str | None = None


class ShareCountOut(BaseModel):
    """The share count in use and where it came from
    (app/services/market_data/shares.py)."""

    shares: Decimal | None = None
    source: str | None = None  # manual | sec_edgar | yfinance | filing
    source_label: str | None = None
    as_of: datetime | None = None
    reference: str | None = None
    note: str | None = None
    override_id: UUID | None = None
    eps_implied_low: Decimal | None = None
    eps_implied_high: Decimal | None = None
    warnings: list[str] = []
    unavailable_reason: str | None = None


class MarketContextOut(BaseModel):
    """Price and share count behind the market multiples."""

    price: Decimal | None = None
    price_currency: str | None = None
    price_as_of: datetime | None = None
    fx_rate: Decimal | None = None
    price_in_reporting_currency: Decimal | None = None
    reporting_currency: str | None = None
    shares: ShareCountOut = ShareCountOut()
    # Why the multiples are missing, when they are.
    unavailable_reason: str | None = None
    # True when the period shown is not the latest one on file: the
    # multiples then pair today's price with that older year's figures.
    stale_period: bool = False


class ShareCountIn(BaseModel):
    shares: Decimal
    as_of: datetime
    reference: str | None = None
    note: str | None = None


class HoldingMetricsOut(BaseModel):
    holding_id: UUID
    period: str
    facts: dict[str, Decimal]
    computed: dict[str, Decimal]
    skipped: dict[str, str]
    # Currency every monetary figure above is in (None if unknown/mixed).
    currency: str | None = None
    notes: dict[str, str] = {}
    warnings: list[str] = []
    fact_details: list[MetricFactOut] = []
    # Previous fiscal year used for averages (ROE / ROIC / ROCE), if on file.
    prior_period: str | None = None
    market: MarketContextOut | None = None
