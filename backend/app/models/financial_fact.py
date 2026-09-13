"""Deterministic structured financial facts extracted from documents (§20).

These are source facts / derived-from-source facts (§5.1 evidence hierarchy
tiers 1-2) — never LLM output. Phase 1 populates this table only from exact
label matches in spreadsheet extraction (app.domain.financial_metrics); PDF/
PPT structured extraction is deferred (page/chunk text is still captured, see
models/document.py).
"""

import uuid
from datetime import datetime, timezone
from decimal import Decimal

from sqlalchemy import DateTime, Float, ForeignKey, Integer, Numeric, String
from sqlalchemy.orm import Mapped, mapped_column

from app.config.database import Base
from app.models.types import GUID, new_uuid


class FinancialLineItem(Base):
    __tablename__ = "financial_line_items"

    id: Mapped["uuid.UUID"] = mapped_column(GUID, primary_key=True, default=new_uuid)
    document_id: Mapped["uuid.UUID"] = mapped_column(
        GUID, ForeignKey("documents.id"), nullable=False, index=True
    )
    holding_id: Mapped["uuid.UUID"] = mapped_column(
        GUID, ForeignKey("holdings.id"), nullable=False, index=True
    )

    metric: Mapped[str] = mapped_column(String(64), nullable=False)  # app.domain.financial_metrics
    value: Mapped[Decimal] = mapped_column(Numeric(24, 6), nullable=False)
    unit: Mapped[str] = mapped_column(String(32), nullable=False, default="unit")
    currency: Mapped[str | None] = mapped_column(String(3), nullable=True)
    period: Mapped[str] = mapped_column(String(32), nullable=False)
    source_page: Mapped[int | None] = mapped_column(Integer, nullable=True)

    # Deterministic extraction confidence (§13.3 — never present estimates as
    # precise facts): 1.0 for an exact label + clean numeric parse.
    confidence: Mapped[float] = mapped_column(Float, nullable=False, default=1.0)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )
