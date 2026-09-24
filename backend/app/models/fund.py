"""Fund / ETF facts (Sprint 8, F9): the numbers a fund analysis needs that
no financial statement carries — cost, track record against a benchmark,
and what the fund owns.

Decision 23 (2026-09-24): these figures are **never read out of a PDF by
an LLM** (the same line as the 2026-09-23 revert of LLM PDF extraction).
They arrive two ways, both deterministic:

- typed in by Faiz on the holding page, each row citing the uploaded
  document (and page) it was read from, and
- imported from a provider holdings file (CSV/XLSX) by
  app/services/funds/holdings_import.py.

Either way `source_document_id` is NOT NULL: every fund figure stays
traceable to a real uploaded document belonging to the same fund holding
(the same rule portfolio positions follow). Deleting that document deletes
the rows that cite it (app/services/deletion.py).

All tables are additive (alembic/versions/f8a9b0c1d2e3_fund_facts.py); no
existing table or column is touched.
"""
from __future__ import annotations

import uuid
from datetime import date, datetime, timezone
from decimal import Decimal

from sqlalchemy import (
    Boolean,
    Date,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    Numeric,
    String,
    Text,
)
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base
from app.models.types import GUID


def _now() -> datetime:
    return datetime.now(timezone.utc)


class FundProfile(Base):
    """One row per fund/ETF holding: what kind of fund it is and what it
    costs. Edited in place (the current facts, not a history)."""

    __tablename__ = "fund_profiles"

    id: Mapped[uuid.UUID] = mapped_column(GUID(), primary_key=True, default=uuid.uuid4)
    holding_id: Mapped[uuid.UUID] = mapped_column(
        GUID(), ForeignKey("holdings.id"), nullable=False, unique=True
    )
    management_style: Mapped[str] = mapped_column(String(16), nullable=False)
    """"active" | "index" — decides whether the benchmark gap is read as the
    manager's excess return or as the tracking difference."""
    benchmark_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    ongoing_charge_pct: Mapped[Decimal | None] = mapped_column(Numeric(7, 4), nullable=True)
    """Yearly ongoing charge / management fee in percent (1.25 = 1.25 %)."""
    performance_fee: Mapped[str | None] = mapped_column(String(255), nullable=True)
    domicile: Mapped[str | None] = mapped_column(String(64), nullable=True)
    base_currency: Mapped[str | None] = mapped_column(String(3), nullable=True)
    replication: Mapped[str | None] = mapped_column(String(32), nullable=True)
    """"physical" | "synthetic" | "sampling" | None (not an index fund)."""
    distribution: Mapped[str | None] = mapped_column(String(16), nullable=True)
    """"accumulating" | "distributing"."""
    fund_size: Mapped[Decimal | None] = mapped_column(Numeric(20, 2), nullable=True)
    fund_size_currency: Mapped[str | None] = mapped_column(String(3), nullable=True)
    inception_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    risk_class: Mapped[int | None] = mapped_column(Integer, nullable=True)
    """The KID summary risk indicator, 1-7."""
    holdings_count: Mapped[int | None] = mapped_column(Integer, nullable=True)
    """Number of holdings the fund itself states (used for coverage)."""
    strategy_summary: Mapped[str | None] = mapped_column(Text, nullable=True)
    """The fund's stated objective, copied from its documents."""
    report_name_filter: Mapped[str | None] = mapped_column(String(255), nullable=True)
    """Text that identifies this fund inside an umbrella report covering
    many sub-funds (e.g. "Gold Mining"). Only passages mentioning it are
    used as document excerpts."""
    as_of_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    source_document_id: Mapped[uuid.UUID] = mapped_column(
        GUID(), ForeignKey("documents.id"), nullable=False
    )
    source_page: Mapped[int | None] = mapped_column(Integer, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=_now)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=_now, onupdate=_now
    )


class FundReturnPeriod(Base):
    """One reported return figure: the fund's, and the benchmark's for the
    same period when the document gives it."""

    __tablename__ = "fund_return_periods"
    __table_args__ = (Index("ix_fund_return_periods_holding", "holding_id"),)

    id: Mapped[uuid.UUID] = mapped_column(GUID(), primary_key=True, default=uuid.uuid4)
    holding_id: Mapped[uuid.UUID] = mapped_column(GUID(), ForeignKey("holdings.id"), nullable=False)
    period_kind: Mapped[str] = mapped_column(String(24), nullable=False)
    """"calendar_year" | "rolling_12m" | "trailing" | "since_inception"."""
    period_label: Mapped[str] = mapped_column(String(64), nullable=False)
    """E.g. "2025", "12m to 2026-06-30", "5 years", "since 2022-12-05"."""
    years: Mapped[Decimal | None] = mapped_column(Numeric(7, 3), nullable=True)
    """Length of a trailing/since-inception period in years (for annualising)."""
    annualised: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    """True when the document reports the figure per year already."""
    fund_return_pct: Mapped[Decimal] = mapped_column(Numeric(9, 4), nullable=False)
    benchmark_return_pct: Mapped[Decimal | None] = mapped_column(Numeric(9, 4), nullable=True)
    benchmark_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    """Only when this period's comparison differs from the profile's benchmark."""
    end_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    source_document_id: Mapped[uuid.UUID] = mapped_column(
        GUID(), ForeignKey("documents.id"), nullable=False
    )
    source_page: Mapped[int | None] = mapped_column(Integer, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=_now)


class FundExposure(Base):
    """One line of what the fund owns, as of a date: a holding with its
    weight, or a sector / country / currency slice.

    For dimension "holding", `linked_holding_id` points at the app's own
    Holding row for that company when there is one (matched by ticker or
    name, or set by hand) — that is what lets the look-through reuse the
    company's financial facts and analysis, and find overlap with stocks
    owned directly."""

    __tablename__ = "fund_exposures"
    __table_args__ = (Index("ix_fund_exposures_holding_dimension", "holding_id", "dimension", "as_of_date"),)

    id: Mapped[uuid.UUID] = mapped_column(GUID(), primary_key=True, default=uuid.uuid4)
    holding_id: Mapped[uuid.UUID] = mapped_column(GUID(), ForeignKey("holdings.id"), nullable=False)
    dimension: Mapped[str] = mapped_column(String(16), nullable=False)
    """"holding" | "sector" | "country" | "currency"."""
    label: Mapped[str] = mapped_column(String(255), nullable=False)
    weight_pct: Mapped[Decimal] = mapped_column(Numeric(9, 4), nullable=False)
    ticker: Mapped[str | None] = mapped_column(String(64), nullable=True)
    isin: Mapped[str | None] = mapped_column(String(12), nullable=True)
    linked_holding_id: Mapped[uuid.UUID | None] = mapped_column(
        GUID(), ForeignKey("holdings.id"), nullable=True
    )
    link_method: Mapped[str | None] = mapped_column(String(16), nullable=True)
    """"ticker" | "name" | "manual" — how linked_holding_id was set."""
    as_of_date: Mapped[date] = mapped_column(Date, nullable=False)
    source_document_id: Mapped[uuid.UUID] = mapped_column(
        GUID(), ForeignKey("documents.id"), nullable=False
    )
    source_page: Mapped[int | None] = mapped_column(Integer, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=_now)
