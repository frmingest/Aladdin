"""Pydantic schemas for the read-only computed-metrics endpoints
(app/api/holdings.py, backed by app/services/metrics.py)."""
from __future__ import annotations

from decimal import Decimal
from uuid import UUID

from pydantic import BaseModel


class HoldingMetricsOut(BaseModel):
    holding_id: UUID
    period: str
    facts: dict[str, Decimal]
    computed: dict[str, Decimal]
    skipped: dict[str, str]
