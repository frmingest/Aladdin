"""Executive summary API schema (architecture §19 — a portfolio-wide,
at-a-glance rollup of what Composition, Portfolio risk, Factor profile, and
the Macro dashboard each already compute, plus a consolidated "needs
attention" list).

Entirely a read-time aggregation over data those sections already persisted
(the latest cached valuation, the latest risk snapshot for this account
scope, the latest holding analyses, the latest macro snapshot) — no new live
provider call of its own and nothing new persisted, same "compute once
elsewhere, read for free here" convention as `GET .../valuation` (§2.7). See
app.services.executive_summary.builder for how each section below is built.
"""

from datetime import datetime
from decimal import Decimal
from uuid import UUID

from pydantic import BaseModel


class HeadlineOut(BaseModel):
    total_market_value: Decimal
    reporting_currency: str
    total_unrealized_pnl: Decimal | None
    total_unrealized_pnl_pct: Decimal | None
    largest_single_name_pct: Decimal | None
    # None = this portfolio (or account scope) has never been priced yet —
    # mirrors PortfolioValuationOut.as_of (app.schemas.market_data).
    valuation_as_of: datetime | None


class RiskDimensionOut(BaseModel):
    dimension: str
    label: str
    band: str


class WorstScenarioOut(BaseModel):
    label: str
    estimated_portfolio_impact_pct: Decimal


class RiskHeadlineOut(BaseModel):
    # False = no risk snapshot has ever been computed for this exact account
    # scope — every field below is then None/empty, not fabricated.
    available: bool
    risk_band: str | None
    composite_risk_score: Decimal | None
    as_of: datetime | None
    # Up to 3 highest-severity dimensions, worst first — same ranking
    # app.services.portfolio_risk.builder's narrative sentence already uses,
    # recomputed here from the persisted risk snapshot's raw JSON so a
    # historical snapshot's own risk_scoring_version keeps driving its bands.
    worst_dimensions: list[RiskDimensionOut]
    worst_scenario: WorstScenarioOut | None
    wealth_tax_estimated_tax: Decimal | None


class FactorProfileHeadlineOut(BaseModel):
    holdings_total: int
    holdings_analyzed: int
    coverage_pct: Decimal | None
    avg_business_quality: Decimal | None
    avg_financial_strength: Decimal | None
    avg_valuation: Decimal | None
    avg_overall_score: Decimal | None


class CollectionSliceOut(BaseModel):
    collection: str  # "Securities" | "Coin collection" | "Whisky collection"
    value_reporting_ccy: Decimal
    pct_of_total: Decimal


class CompositionHeadlineOut(BaseModel):
    by_collection: list[CollectionSliceOut]
    # % of market value held outside the portfolio's reporting currency —
    # same figure app.services.portfolio_risk.builder's currency_exposure_pct
    # computes for the risk snapshot, surfaced here even when no risk
    # snapshot has been computed yet (it only needs the cached valuation).
    currency_exposure_pct: Decimal | None


class MacroHeadlineOut(BaseModel):
    available: bool
    as_of: datetime | None
    # "baseline" | "stagflation" | "crisis" | ... — app.domain.scoring's
    # deterministic regime classification, the same one an analysis run
    # records as macro_regime (ECON-002 fix, docs/decisions/0014).
    regime: str
    reason: str | None = None


class WatchItemOut(BaseModel):
    severity: str  # "warning" | "info"
    message: str


class ExecutiveSummaryOut(BaseModel):
    snapshot_id: UUID
    generated_at: datetime
    # None = every account (no filter applied) — same convention as
    # PortfolioValuationOut.account_ids / PortfolioRiskSnapshotOut.account_ids.
    account_ids: list[str] | None
    headline: HeadlineOut
    risk: RiskHeadlineOut
    factor_profile: FactorProfileHeadlineOut
    composition: CompositionHeadlineOut
    macro: MacroHeadlineOut
    watch_items: list[WatchItemOut]
