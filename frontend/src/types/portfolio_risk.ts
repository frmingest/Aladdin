// Mirrors backend/app/schemas/portfolio_risk.py and the JSON shapes produced
// by backend/app/services/portfolio_risk/builder.py (architecture §15, §15.1,
// §18, §26 Phase 5). The per-dimension JSON columns are genuinely flexible
// (documented on the dataclasses that produce them, not a second pydantic
// schema — see that file's module docstring).
//
// Every numeric leaf inside these five JSON columns (concentration,
// correlation, exposure, scenario, systemic_state_risk) is a STRING, not a
// JSON number: builder.py's `_json_safe` stringifies every Decimal before
// the dict is persisted to a JSON column, since JSON columns can't hold
// Decimal directly. `composite_risk_score` below is a STRING too, for a
// different reason confirmed against a live response: pydantic v2's
// default Decimal->JSON encoding is a string everywhere in this API, not
// just these JSON-column dicts — see market_valuation.ts's note, which
// carries the same correction for the Phase 2 valuation endpoint. Use
// `num()` from ../lib/num to parse any of these back to JS numbers before
// charting or arithmetic.

export type CorrelationResult = {
  pairs: Record<string, string>; // "TICKER_A|TICKER_B" -> r (decimal-as-string)
  average_pairwise_correlation: string | null;
  insufficient_data_pairs: string[];
};

export type ExposureJson = {
  currency_exposure_pct: string | null;
  commodity_exposure_pct: string | null;
  currency_weights_pct: Record<string, string>;
  asset_class_weights_pct: Record<string, string>;
};

export type DepositExposure = {
  institution: string;
  value_reporting_ccy: string;
  guarantee_limit: string;
  excess_over_guarantee: string;
};

export type WealthTaxEstimate = {
  jurisdiction: string;
  taxable_base: string;
  bunnfradrag: string;
  rate_pct: string;
  estimated_tax: string;
};

export type SystemicStateRiskJson = {
  deposit_exposures: DepositExposure[];
  deposits_over_guarantee_limit_pct: string | null;
  custody_weights_pct: Record<string, string>;
  jurisdictional_weights_pct: Record<string, string>;
  jurisdictional_concentration_hhi: string | null;
  wealth_tax_estimate: WealthTaxEstimate | null;
  warnings: string[];
};

export type ScenarioImpactJson = {
  scenario_key: string;
  label: string;
  context: Record<string, string>;
  estimated_portfolio_impact_pct: string | null;
  contributions: Record<string, string>;
  unmatched_sector_weight_pct: string;
};

/** Same fields as market_valuation.ts's ConcentrationProfileOut, but every
 * numeric leaf is a decimal-as-string (see module docstring above) since
 * this copy travels through the risk snapshot's generic JSON column rather
 * than a Pydantic Decimal field. */
export type ConcentrationProfileJson = {
  single_name_hhi: string | null;
  largest_single_name_pct: string | null;
  single_name_weights: Record<string, string>;
  sector_hhi: string | null;
  sector_weights: Record<string, string>;
  currency_weights: Record<string, string>;
  asset_class_weights: Record<string, string>;
  holdings_excluded_from_concentration: string[];
};

export type PortfolioRiskSnapshotOut = {
  id: string;
  portfolio_snapshot_id: string;
  analysis_run_id: string | null;
  concentration: ConcentrationProfileJson;
  correlation: CorrelationResult;
  exposure: ExposureJson;
  scenario: Record<string, ScenarioImpactJson>;
  systemic_state_risk: SystemicStateRiskJson;
  risk_band: string;
  composite_risk_score: string | null; // Decimal -> JSON string; see module docstring
  narrative: string;
  risk_scoring_version: string;
  scenario_version: string;
  created_at: string;
};
