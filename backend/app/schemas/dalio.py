"""Response models for the Dalio-mode endpoints (Epic F22) — app/api/dalio.py."""
from __future__ import annotations

from datetime import date, datetime
from decimal import Decimal
from uuid import UUID

from pydantic import BaseModel


class BetaOut(BaseModel):
    beta: Decimal | None
    t_stat: Decimal | None
    significant: bool
    n_months: int
    reason: str | None


class AllWeatherPositionOut(BaseModel):
    holding_id: UUID
    ticker: str
    name: str
    instrument_type: str
    trading_currency: str
    weight_pct: Decimal | None
    value_nok: Decimal | None
    portfolio_role: str | None
    dalio_verdict: str | None
    dalio_analyzed_at: datetime | None
    favoured_environments: list[str]
    inflation: BetaOut
    growth: BetaOut
    rates_us: BetaOut
    rates_no: BetaOut
    tilt: str


class WeightSliceOut(BaseModel):
    key: str
    label: str
    weight_pct: Decimal
    count: int


class CountrySliceOut(BaseModel):
    country: str
    name: str
    weight_pct: Decimal
    ssi_score: Decimal | None
    ssi_band: str | None
    data_quality: str
    wgi_estimate: Decimal | None


class RateSensitivityOut(BaseModel):
    key: str
    label: str
    weighted_beta: Decimal | None
    coverage_pct: Decimal
    note: str


class ClusterOut(BaseModel):
    tickers: list[str]
    names: list[str]
    correlation: Decimal
    combined_weight_pct: Decimal


class AllWeatherOut(BaseModel):
    as_of: datetime | None
    total_value_nok: Decimal
    regime: str
    positions: list[AllWeatherPositionOut]
    by_role: list[WeightSliceOut]
    by_judged_environment: list[WeightSliceOut]
    by_measured_environment: list[WeightSliceOut]
    by_currency: list[WeightSliceOut]
    by_country: list[CountrySliceOut]
    country_coverage_pct: Decimal
    rate_sensitivity: list[RateSensitivityOut]
    clusters: list[ClusterOut]
    notes: list[str]


class CycleFitRowOut(BaseModel):
    holding_id: UUID
    ticker: str
    name: str
    instrument_type: str
    weight_pct: Decimal | None
    dalio_verdict: str | None
    portfolio_role: str | None
    dalio_analyzed_at: datetime | None
    dalio_stale: bool
    buffett_verdict: str | None
    buffett_moat: str | None
    buffett_analyzed_at: datetime | None
    agreement: str


class CycleFitBoardOut(BaseModel):
    as_of: datetime | None
    rows: list[CycleFitRowOut]
    dalio_analyzed_count: int
    agreement_counts: dict[str, int]


class DalioSeriesOut(BaseModel):
    key: str
    label: str
    group: str
    display_unit: str
    frequency: str
    value: Decimal | None
    observed_on: date | None
    change_12m: Decimal | None
    stale: bool
    description: str
    source_series_id: str
    source_url: str
    last_error: str | None


class DalioDerivedOut(BaseModel):
    key: str
    label: str
    unit: str
    value: Decimal | None
    observed_on: date | None
    value_12m_ago: Decimal | None
    change_12m: Decimal | None
    formula: str | None
    reason: str | None
    description: str


class CountryFigureOut(BaseModel):
    label: str
    value: Decimal | None
    data_year: int | None
    note: str


class CountryRiskOut(BaseModel):
    country: str
    name: str
    currency: str | None
    sdr_basket_currency: bool
    ssi_score: Decimal | None
    ssi_band: str | None
    ssi_components: dict[str, Decimal]
    ssi_missing: list[str]
    data_quality: str
    figures: list[CountryFigureOut]
    fetched_at: datetime | None


class GoldDemandOut(BaseModel):
    as_of: str
    quarters_behind: int
    last_four_quarters: list[tuple[str, Decimal]]
    last_four_total: Decimal
    avg_2015_2021: Decimal
    avg_2022_2024: Decimal
    source: str


class DalioMacroOut(BaseModel):
    series_version: str
    series: list[DalioSeriesOut]
    derived: list[DalioDerivedOut]
    countries: list[CountryRiskOut]
    gold_demand: GoldDemandOut


class CountryRefreshOut(BaseModel):
    country: str
    status: str
    inserted: int
    errors: list[str]


class DalioRefreshOut(BaseModel):
    macro: list[dict]
    countries: list[CountryRefreshOut]
