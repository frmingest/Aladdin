"""Pydantic schemas for the valuation API (app/api/valuation.py, Sprint 3)."""
from __future__ import annotations

import dataclasses
from datetime import datetime
from decimal import Decimal
from uuid import UUID

from pydantic import BaseModel, field_validator


class PriceAssumesOut(BaseModel):
    """What today's price assumes for a company with no DCF (2026-10-14).
    Information only: never a score, a zone or a margin of safety."""

    price_per_share: Decimal
    shares_outstanding: Decimal
    market_cap: Decimal
    discount_rate: Decimal
    terminal_growth_rate: Decimal
    # Yearly owner earnings (valuation currency) the price needs, in total and per share.
    required_owner_earnings: Decimal
    required_per_share: Decimal
    # The company's own latest owner earnings (negative when loss-making).
    latest_owner_earnings: Decimal | None = None
    latest_period: str | None = None


def _price_assumes_from_domain(value):
    """Accept the service's dataclass as well as a dict or the model itself."""
    if dataclasses.is_dataclass(value) and not isinstance(value, type):
        return dataclasses.asdict(value)
    return value


class DCFScenarioOut(BaseModel):
    label: str
    growth_rate: Decimal
    intrinsic_value_per_share: Decimal
    margin_of_safety: Decimal | None = None


class DCFOut(BaseModel):
    discount_rate: Decimal
    terminal_growth_rate: Decimal
    scenarios: list[DCFScenarioOut]


class FinancialsScenarioOut(BaseModel):
    label: str
    roe: Decimal
    justified_price_to_book: Decimal
    value_per_share: Decimal
    margin_of_safety: Decimal | None = None


class FinancialsValuationOut(BaseModel):
    """Justified price-to-book valuation for banks/insurers (2026-09-29)."""

    cost_of_equity: Decimal
    growth_rate: Decimal
    book_value_per_share: Decimal
    roe_periods_used: int
    roe_was_capped: bool
    scenarios: list[FinancialsScenarioOut]


class LookThroughScenarioOut(BaseModel):
    label: str
    growth_rate: Decimal
    fair_pe: Decimal
    value_per_unit: Decimal
    margin_of_safety: Decimal | None = None


class FundLookThroughOut(BaseModel):
    """The fund look-through earnings-yield screen (2026-09-29)."""

    scenarios: list[LookThroughScenarioOut]
    fund_earnings_yield: Decimal
    fund_pe: Decimal
    coverage_pct: Decimal
    constituents_used: int
    constituents_total: int
    cost_of_equity: Decimal
    terminal_growth_rate: Decimal
    oldest_observation: datetime | None = None
    notes: list[str] = []
    method_note: str


class PeriodMultiplesOut(BaseModel):
    period: str
    matched_price_observed_at: datetime | None
    computed: dict[str, Decimal]
    skipped: dict[str, str]
    notes: list[str] = []


class HoldingValuationOut(BaseModel):
    holding_id: UUID
    ticker: str
    valuation_currency: str | None
    as_of: datetime | None
    base_growth_rate: Decimal | None
    discount_rate: Decimal | None
    risk_free_rate_pct: Decimal | None
    beta: Decimal | None
    equity_risk_premium: Decimal | None
    current_price_per_share: Decimal | None
    dcf: DCFOut | None
    reverse_dcf_implied_growth: Decimal | None
    multiples: list[PeriodMultiplesOut]
    shares_outstanding: Decimal | None = None
    shares_source: str | None = None
    assumptions_version: str
    unavailable_reasons: list[str]
    # Sprint 14 (2026-09-26): set only when settings.regime_adjusted_dcf_enabled
    # is True. base_discount_rate is the plain CAPM rate before any widening;
    # discount_rate above is what the DCF actually used.
    base_discount_rate: Decimal | None = None
    regime: str | None = None
    regime_discount_rate_addon: Decimal | None = None
    regime_adjustments_version: str | None = None
    # --- v2 guardrails (2026-09-29) ---
    # "owner_earnings_dcf" | "financials_price_to_book" | "fund_look_through_pe"
    valuation_method: str = "owner_earnings_dcf"
    # "ok" | "implausible" (computed, then withheld) | "unavailable"
    valuation_status: str = "unavailable"
    valuation_status_reason: str | None = None
    raw_base_growth_rate: Decimal | None = None
    growth_capped: bool = False
    fades_to_terminal: bool = False
    capm_cost_of_equity: Decimal | None = None
    financials: FinancialsValuationOut | None = None
    fund_look_through: FundLookThroughOut | None = None
    # bear/base/bull value per share the model produced before it was
    # withheld as implausible. For display as "rejected" only — never a
    # valuation, never a margin of safety.
    rejected_values: dict[str, Decimal] | None = None
    # 2026-10-07: the holding's own (trading) currency and the stored FX rate
    # valuation_currency -> trading_currency, so the UI can show a NOK
    # equivalent next to a figure in the filing's reporting currency (e.g.
    # Equinor reports in USD). Display only: the valuation itself stays in
    # valuation_currency. Both are None when the two currencies are the same;
    # the rate alone is None when none is stored yet.
    trading_currency: str | None = None
    trading_currency_fx_rate: Decimal | None = None
    # 2026-10-14: loss-making companies only (no DCF). Information, never a value.
    price_assumes: PriceAssumesOut | None = None

    @field_validator("price_assumes", mode="before")
    @classmethod
    def _accept_dataclass(cls, value):
        return _price_assumes_from_domain(value)


class BoardRowOut(BaseModel):
    holding_id: UUID
    ticker: str
    name: str
    sector: str | None
    market_value_nok: Decimal | None
    weight_pct: Decimal | None
    valuation_currency: str | None
    price: Decimal | None
    price_as_of: datetime | None
    bear: Decimal | None
    base: Decimal | None
    bull: Decimal | None
    margin_of_safety_base: Decimal | None
    margin_of_safety_bear: Decimal | None
    zone: str
    unavailable_reason: str | None
    verdict_rating: str | None
    moat_rating: str | None
    analyzed_at: datetime | None
    # v2 (2026-09-29): which model produced bear/base/bull and whether it
    # was withheld as implausible (same meaning as HoldingValuationOut).
    valuation_method: str = "owner_earnings_dcf"
    valuation_status: str = "unavailable"
    # Sprint 14 (2026-09-26): same meaning as HoldingValuationOut's fields.
    regime: str | None = None
    regime_discount_rate_addon: Decimal | None = None
    # 2026-09-30: watchlist rows only.
    buy_below_price: Decimal | None = None
    buy_below_currency: str | None = None
    # 2026-10-14: loss-making companies only (no DCF, not ranked).
    price_assumes: PriceAssumesOut | None = None

    @field_validator("price_assumes", mode="before")
    @classmethod
    def _accept_dataclass(cls, value):
        return _price_assumes_from_domain(value)


class MarginOfSafetyBoardOut(BaseModel):
    """GET /valuation/board — feature F3. Rows are ranked by base-case
    margin of safety, highest first; holdings without a DCF come last."""

    rows: list[BoardRowOut]
    total_equity_value_nok: Decimal
    zone_counts: dict[str, int]
    # 2026-09-30: watchlist companies you don't own, ranked the same way but
    # shown in their own card on the page.
    watchlist_rows: list[BoardRowOut] = []
    # When this payload was stored (page-load snapshots, 2026-09-30).
    snapshot_at: datetime | None = None
