/**
 * Epic F22 (analyst modes) response types — mirrors backend/app/schemas/
 * analysis.py (side-by-side, auto-queue, synthesis), app/api/settings.py
 * (analyst mode) and app/schemas/dalio.py. Kept out of types.ts, which is
 * already long.
 */
import type { AnalysisRun, AnalystMode, Environment, PortfolioRole, VerdictRating } from "./types";

export const DEFAULT_BASIS =
  "Basis: where we are in the debt, liquidity and geopolitical cycles, currency and country risk, and the job this holding does in the portfolio. Not business quality.";

export interface AnalystModeState {
  mode: AnalystMode;
  label: string;
  synthesis_enabled: boolean;
  dalio_verdict_basis: string;
}

export type Agreement = "agree" | "partly_agree" | "disagree" | "incomplete";

export interface Comparison {
  agreement: Agreement;
  headline: string;
  buffett_verdict: VerdictRating | null;
  dalio_verdict: VerdictRating | null;
  dalio_role: PortfolioRole | null;
  buffett_moat: string | null;
  verdict_gap: number | null;
  points: string[];
  buffett_analyzed_at: string | null;
  dalio_analyzed_at: string | null;
}

export interface SynthesisPoint {
  text: string;
  evidence_ids: string[];
}

export interface Synthesis {
  id: string;
  holding_id: string;
  buffett_run_id: string;
  dalio_run_id: string;
  status: "COMPLETED" | "FAILED";
  schema_version: string;
  prompt_version: string;
  provider: string | null;
  model_name: string | null;
  output: {
    agreements: SynthesisPoint[];
    disagreements: SynthesisPoint[];
    where_they_would_argue: string;
    what_would_settle_it: SynthesisPoint[];
  } | null;
  citation_warnings: string[];
  error_message: string | null;
  created_at: string;
}

export interface SideBySide {
  holding_id: string;
  buffett: AnalysisRun | null;
  dalio: AnalysisRun | null;
  comparison: Comparison;
  synthesis: Synthesis | null;
  synthesis_enabled: boolean;
  dalio_verdict_basis: string;
}

export interface AutoQueueAction {
  holding_id: string;
  ticker: string;
  persona: string;
  action: "queued" | "already_pending" | "up_to_date" | "blocked" | "cap_reached" | "not_applicable";
  detail: string;
  run_id: string | null;
}

export interface AutoQueueResult {
  mode: AnalystMode;
  cap: number;
  auto_queued_last_24h: number;
  queued_count: number;
  actions: AutoQueueAction[];
}

export interface Beta {
  beta: string | null;
  t_stat: string | null;
  significant: boolean;
  n_months: number;
  reason: string | null;
}

export interface AllWeatherPosition {
  holding_id: string;
  ticker: string;
  name: string;
  instrument_type: string;
  trading_currency: string;
  weight_pct: string | null;
  value_nok: string | null;
  portfolio_role: PortfolioRole | null;
  dalio_verdict: VerdictRating | null;
  dalio_analyzed_at: string | null;
  favoured_environments: Environment[];
  inflation: Beta;
  growth: Beta;
  rates_us: Beta;
  rates_no: Beta;
  tilt: string;
}

export interface WeightSlice {
  key: string;
  label: string;
  weight_pct: string;
  count: number;
}

export interface CountrySlice {
  country: string;
  name: string;
  weight_pct: string;
  ssi_score: string | null;
  ssi_band: string | null;
  data_quality: string;
  wgi_estimate: string | null;
}

export interface AllWeather {
  as_of: string | null;
  total_value_nok: string;
  regime: string;
  positions: AllWeatherPosition[];
  by_role: WeightSlice[];
  by_judged_environment: WeightSlice[];
  by_measured_environment: WeightSlice[];
  by_currency: WeightSlice[];
  by_country: CountrySlice[];
  country_coverage_pct: string;
  rate_sensitivity: { key: string; label: string; weighted_beta: string | null; coverage_pct: string; note: string }[];
  clusters: { tickers: string[]; names: string[]; correlation: string; combined_weight_pct: string }[];
  notes: string[];
}

export interface CycleFitRow {
  holding_id: string;
  ticker: string;
  name: string;
  instrument_type: string;
  weight_pct: string | null;
  dalio_verdict: VerdictRating | null;
  portfolio_role: PortfolioRole | null;
  dalio_analyzed_at: string | null;
  dalio_stale: boolean;
  buffett_verdict: VerdictRating | null;
  buffett_moat: string | null;
  buffett_analyzed_at: string | null;
  agreement: Agreement;
}

export interface CycleFitBoard {
  as_of: string | null;
  rows: CycleFitRow[];
  dalio_analyzed_count: number;
  agreement_counts: Partial<Record<Agreement, number>>;
}

export interface DalioSeries {
  key: string;
  label: string;
  group: string;
  display_unit: string;
  frequency: string;
  value: string | null;
  observed_on: string | null;
  change_12m: string | null;
  stale: boolean;
  description: string;
  source_series_id: string;
  source_url: string;
  last_error: string | null;
}

export interface DalioDerived {
  key: string;
  label: string;
  unit: string;
  value: string | null;
  observed_on: string | null;
  value_12m_ago: string | null;
  change_12m: string | null;
  formula: string | null;
  reason: string | null;
  description: string;
}

export interface CountryRisk {
  country: string;
  name: string;
  currency: string | null;
  sdr_basket_currency: boolean;
  ssi_score: string | null;
  ssi_band: string | null;
  ssi_components: Record<string, string>;
  ssi_missing: string[];
  data_quality: string;
  figures: { label: string; value: string | null; data_year: number | null; note: string }[];
  fetched_at: string | null;
}

export interface DalioMacro {
  series_version: string;
  series: DalioSeries[];
  derived: DalioDerived[];
  countries: CountryRisk[];
  gold_demand: {
    as_of: string;
    quarters_behind: number;
    last_four_quarters: [string, string][];
    last_four_total: string;
    avg_2015_2021: string;
    avg_2022_2024: string;
    source: string;
  };
}

export interface DalioRefreshResult {
  macro: { key: string; label: string; status: string; inserted: number; error: string | null }[];
  countries: { country: string; status: string; inserted: number; errors: string[] }[];
}

export const ROLE_LABELS: Record<PortfolioRole, string> = {
  growth_engine: "Growth engine",
  inflation_hedge: "Inflation hedge",
  deflation_hedge: "Deflation hedge",
  currency_debasement_hedge: "Currency-debasement hedge",
  diversifier: "Diversifier",
  redundant: "Redundant",
};

export const ENVIRONMENT_LABELS: Record<Environment, string> = {
  rising_growth: "Rising growth",
  falling_growth: "Falling growth",
  rising_inflation: "Rising inflation",
  falling_inflation: "Falling inflation",
};

export const AGREEMENT_LABELS: Record<Agreement, string> = {
  agree: "Agree",
  partly_agree: "Partly agree",
  disagree: "Disagree",
  incomplete: "Incomplete",
};

export const MODE_OPTIONS: { value: AnalystMode; label: string; short: string; hint: string }[] = [
  {
    value: "buffett_munger",
    label: "Buffett/Munger",
    short: "Buffett",
    hint: "Is this a wonderful business at a sensible price?",
  },
  {
    value: "dalio",
    label: "Ray Dalio",
    short: "Dalio",
    hint: "Does it fit the debt, liquidity and geopolitical cycles, and what job does it do in the portfolio?",
  },
  {
    value: "side_by_side",
    label: "Side-by-side",
    short: "Both",
    hint: "Both independent analyses next to each other, with where they agree and disagree.",
  },
];
