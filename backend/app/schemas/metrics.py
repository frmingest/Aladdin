"""Pydantic schemas for the read-only computed-metrics endpoints
(app/api/holdings.py, backed by app/services/metrics.py)."""
from __future__ import annotations

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
