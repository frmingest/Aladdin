// Mirrors backend/app/schemas/executive_summary.py (architecture §19).
//
// Every Decimal field here serializes as a JSON STRING, not a JSON number —
// same pydantic v2 behavior documented in market_valuation.ts's and
// portfolio_risk.ts's module docstrings. Use `num()` from ../lib/num before
// formatting or charting any of these.

export type HeadlineOut = {
  total_market_value: string;
  reporting_currency: string;
  total_unrealized_pnl: string | null;
  total_unrealized_pnl_pct: string | null;
  largest_single_name_pct: string | null;
  // null = this portfolio (or account scope) has never been priced yet.
  valuation_as_of: string | null;
};

export type RiskDimensionOut = {
  dimension: string;
  label: string;
  band: string;
};

export type WorstScenarioOut = {
  label: string;
  estimated_portfolio_impact_pct: string;
};

export type RiskHeadlineOut = {
  // false = no risk snapshot has ever been computed for this exact account
  // scope — every other field here is then null/empty, not fabricated.
  available: boolean;
  risk_band: string | null;
  composite_risk_score: string | null;
  as_of: string | null;
  worst_dimensions: RiskDimensionOut[];
  worst_scenario: WorstScenarioOut | null;
  wealth_tax_estimated_tax: string | null;
};

export type FactorProfileHeadlineOut = {
  holdings_total: number;
  holdings_analyzed: number;
  coverage_pct: string | null;
  avg_business_quality: string | null;
  avg_financial_strength: string | null;
  avg_valuation: string | null;
  avg_overall_score: string | null;
};

export type CollectionSliceOut = {
  collection: string; // "Securities" | "Coin collection" | "Whisky collection"
  value_reporting_ccy: string;
  pct_of_total: string;
};

export type CompositionHeadlineOut = {
  by_collection: CollectionSliceOut[];
  // % of market value held outside the portfolio's reporting currency.
  currency_exposure_pct: string | null;
};

export type MacroHeadlineOut = {
  available: boolean;
  as_of: string | null;
  // "baseline" | "stagflation" | "crisis" | ... — app.domain.scoring's
  // deterministic regime classification (same one an analysis run records
  // as macro_regime).
  regime: string;
  reason: string | null;
};

export type WatchItemOut = {
  severity: "warning" | "info";
  message: string;
};

export type ExecutiveSummaryOut = {
  snapshot_id: string;
  generated_at: string;
  // null = every account (no filter applied).
  account_ids: string[] | null;
  headline: HeadlineOut;
  risk: RiskHeadlineOut;
  factor_profile: FactorProfileHeadlineOut;
  composition: CompositionHeadlineOut;
  macro: MacroHeadlineOut;
  watch_items: WatchItemOut[];
};
