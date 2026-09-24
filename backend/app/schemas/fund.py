"""Pydantic schemas for the fund facts API (app/api/funds.py, Sprint 8)."""
from __future__ import annotations

from datetime import date, datetime
from decimal import Decimal
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, Field

from app.services.funds.metrics import FundMetrics

ManagementStyle = Literal["active", "index"]
PeriodKind = Literal["calendar_year", "rolling_12m", "trailing", "since_inception"]
Dimension = Literal["holding", "sector", "country", "currency"]


class FundProfileIn(BaseModel):
    management_style: ManagementStyle
    benchmark_name: str | None = Field(default=None, max_length=255)
    ongoing_charge_pct: Decimal | None = None
    performance_fee: str | None = Field(default=None, max_length=255)
    domicile: str | None = Field(default=None, max_length=64)
    base_currency: str | None = Field(default=None, min_length=3, max_length=3)
    replication: Literal["physical", "synthetic", "sampling"] | None = None
    distribution: Literal["accumulating", "distributing"] | None = None
    fund_size: Decimal | None = None
    fund_size_currency: str | None = Field(default=None, min_length=3, max_length=3)
    inception_date: date | None = None
    risk_class: int | None = None
    holdings_count: int | None = Field(default=None, ge=1)
    strategy_summary: str | None = Field(default=None, max_length=4000)
    report_name_filter: str | None = Field(default=None, max_length=255)
    as_of_date: date | None = None
    source_document_id: UUID
    source_page: int | None = Field(default=None, ge=1)


class FundProfileOut(FundProfileIn):
    model_config = {"from_attributes": True}

    id: UUID
    holding_id: UUID
    updated_at: datetime


class FundReturnIn(BaseModel):
    period_kind: PeriodKind
    period_label: str = Field(min_length=1, max_length=64)
    years: Decimal | None = None
    annualised: bool = False
    fund_return_pct: Decimal
    benchmark_return_pct: Decimal | None = None
    benchmark_name: str | None = Field(default=None, max_length=255)
    end_date: date | None = None
    source_document_id: UUID
    source_page: int | None = Field(default=None, ge=1)


class FundReturnOut(FundReturnIn):
    model_config = {"from_attributes": True}

    id: UUID


class FundExposureRowIn(BaseModel):
    label: str = Field(min_length=1, max_length=255)
    weight_pct: Decimal
    ticker: str | None = Field(default=None, max_length=64)
    isin: str | None = Field(default=None, max_length=12)
    source_page: int | None = Field(default=None, ge=1)


class FundExposuresIn(BaseModel):
    as_of_date: date
    source_document_id: UUID
    rows: list[FundExposureRowIn] = Field(max_length=5000)


class FundExposureOut(BaseModel):
    model_config = {"from_attributes": True}

    id: UUID
    dimension: str
    label: str
    weight_pct: Decimal
    ticker: str | None
    isin: str | None
    linked_holding_id: UUID | None
    link_method: str | None
    as_of_date: date
    source_document_id: UUID
    source_page: int | None


class FundDocumentOut(BaseModel):
    id: UUID
    original_filename: str
    type: str
    reporting_period: str | None


class FundFactsOut(BaseModel):
    holding_id: UUID
    instrument_type: str
    profile: FundProfileOut | None
    returns: list[FundReturnOut]
    exposures: dict[str, list[FundExposureOut]]
    """Latest as-of snapshot per dimension."""
    documents: list[FundDocumentOut]
    """This fund's uploaded documents — what a figure can cite."""
    metrics: FundMetrics


class HoldingsImportOut(BaseModel):
    document_id: UUID
    was_duplicate_file: bool
    as_of_date: date
    rows_imported: int
    weight_sum_pct: Decimal
    linked: int
    derived_dimensions: list[str]
    sheet: str
    header_row: int
    columns: dict[str, str]
    weights_were_fractions: bool
    warnings: list[str]


class ManualLinkIn(BaseModel):
    linked_holding_id: UUID | None
