"""FinancialLineItem — one deterministic, sourced numeric fact extracted
from a filing (e.g. "revenue", "total_debt" for a given period).

Matches alembic/versions/a0f4172c5989_phase1_portfolio_and_document_ingestion.py.
This is the raw material app/services/calculations.py computes ratios from —
CLAUDE.md Rule 1: the arithmetic over these rows is always deterministic
application code, never the LLM.
"""
from __future__ import annotations

import uuid
from datetime import datetime, timezone
from decimal import Decimal
from typing import TYPE_CHECKING

from sqlalchemy import DateTime, Float, ForeignKey, Integer, Numeric, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base
from app.models.types import GUID

if TYPE_CHECKING:
    from app.models.document import Document
    from app.models.holding import Holding


class FinancialLineItem(Base):
    __tablename__ = "financial_line_items"

    id: Mapped[uuid.UUID] = mapped_column(GUID(), primary_key=True, default=uuid.uuid4)
    document_id: Mapped[uuid.UUID] = mapped_column(
        GUID(), ForeignKey("documents.id"), nullable=False
    )
    holding_id: Mapped[uuid.UUID] = mapped_column(
        GUID(), ForeignKey("holdings.id"), nullable=False
    )
    metric: Mapped[str] = mapped_column(String(64), nullable=False)
    value: Mapped[Decimal] = mapped_column(Numeric(24, 6), nullable=False)
    unit: Mapped[str] = mapped_column(String(32), nullable=False)
    currency: Mapped[str | None] = mapped_column(String(3), nullable=True)
    period: Mapped[str] = mapped_column(String(32), nullable=False)
    source_page: Mapped[int | None] = mapped_column(Integer, nullable=True)
    confidence: Mapped[float] = mapped_column(Float, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc)
    )

    document: Mapped[Document] = relationship(back_populates="financial_line_items")
    holding: Mapped[Holding] = relationship(back_populates="financial_line_items")
