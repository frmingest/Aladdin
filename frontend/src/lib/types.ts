/**
 * Mirrors the backend's Pydantic response/request schemas exactly (see
 * backend/app/schemas/*.py) — field names and shapes must stay in lockstep
 * by hand until a shared schema generator exists (not yet built).
 *
 * Every Decimal field comes across the wire as a JSON *string*, not a
 * number — confirmed by the backend's own tests (e.g.
 * tests/integration/test_holding_metrics_api.py asserts
 * body["facts"]["revenue"] == "1000.000000"). Never assume these are safe
 * to use directly in arithmetic without parsing; see src/lib/format.ts.
 */

export interface Holding {
  id: string;
  ticker: string;
  name: string;
  sector: string | null;
  trading_currency: string;
  institution: string | null;
  custody_type: string | null;
  /** Instrument type tagged on import (app/domain/instrument_types.py) —
   * "stock" | "equity_etf" | "equity_fund" | "bond_fund" |
   * "money_market_fund" | "commodity_etc". "stock" gets the single-company
   * analysis; "equity_etf"/"equity_fund" the fund analysis (Sprint 8); the
   * rest are tracked for portfolio composition only. */
  asset_class_raw: string;
  created_at: string;
  updated_at: string;
  document_count: number;
  position_count: number;
}

export const INSTRUMENT_TYPE_LABELS: Record<string, string> = {
  stock: "Stock",
  equity_etf: "Equity ETF",
  equity_fund: "Equity fund",
  bond_fund: "Bond fund",
  money_market_fund: "Money-market fund",
  commodity_etc: "Commodity ETC",
};

export const EQUITY_ANALYZABLE_TYPES = new Set(["stock", "equity_etf", "equity_fund"]);
/** Analysed as a fund (look-through, cost, track record) — Sprint 8. */
export const FUND_TYPES = new Set(["equity_etf", "equity_fund"]);

/** Mirrors backend/app/schemas/holding.py's `HoldingFieldOptions` — backs
 * the manual-edit dropdowns for Sector and Instrument Type on
 * HoldingsListPage (Faiz's request, 2026-09-21: garbage/duplicate tickers
 * and instrument types from the CSV importer need a manual fix path).
 * Fetched from `GET /holdings/field-options` rather than hardcoded here,
 * so the dropdown can never offer a value the backend would then reject —
 * see app/domain/sectors.py / app/domain/instrument_types.py. */
export interface HoldingFieldOptions {
  sectors: string[];
  instrument_types: string[];
}

/** Legacy pre-2026-09-21 whisky/collectibles holdings weren't reset along
 * with the rest of the DB (CLAUDE.md — "the DB is not being reset"), and
 * `GET /holdings` returns every row in the table, so they still show up
 * here individually — one row per bottle/distillery, each with `sector`
 * set to the distillery name (that old app's own categorization hack).
 * There's no instrument-type tag that marks them (`asset_class_raw` is
 * hardcoded to "equity" for everything this rebuild writes, and these
 * predate that column's real use) — the distillery name in `sector` is
 * the only signal available, so this is the exact, real set of distillery
 * names that show up as "Sector Research" chips today. Used by
 * HoldingsListPage to fold these into one "Whisky" group instead of
 * listing each bottle separately (Faiz's request, 2026-09-21) — gold and
 * silver holdings are left as individual rows, per his explicit choice.
 * If a new distillery name shows up that isn't in this list, it'll just
 * list as its own row rather than being silently miscategorized. */
export const WHISKY_SECTORS = new Set([
  "Aberfeldy",
  "Auchroisk",
  "Berentsens Brygghus",
  "Bowmore",
  "Buffalo Trace Distillery",
  "Caol Ila",
  "Cardhu",
  "Craigellachie",
  "Dumbarton",
  "Glenfarclas",
  "Glenfiddich",
  "Glenlivet",
  "Glenmorangie",
  "Johnnie Walker",
  "Lagavulin",
  "Loch Lomond",
  "Longmorn",
  "Midleton (1975-)",
  "Port Dundas",
  "Pulteney",
  "Tamdhu",
  "Tomatin",
  "Wild Turkey Distillery",
  "Woodford Reserve",
]);

export interface HoldingCreateInput {
  ticker: string;
  name: string;
  trading_currency: string;
  sector?: string | null;
  institution?: string | null;
  custody_type?: string | null;
  /** Optional since 2026-09-22 — the backend classifies it from `name`
   * when omitted (previously defaulted to the non-analyzable "equity"). */
  asset_class_raw?: string | null;
}

export interface HoldingUpdateInput {
  /** Editable as of 2026-09-21 — see HoldingUpdate's docstring in
   * backend/app/schemas/holding.py for why renaming it in place is safe
   * (nothing FKs on it, only on the holding's id). */
  ticker?: string;
  name?: string;
  trading_currency?: string;
  sector?: string | null;
  institution?: string | null;
  custody_type?: string | null;
  /** The dropdown-restricted instrument type — see
   * INSTRUMENT_TYPE_LABELS above and HoldingFieldOptions.instrument_types. */
  asset_class_raw?: string;
}

export interface DocumentSummary {
  id: string;
  holding_id: string | null;
  type: string;
  original_filename: string;
  mime_type: string;
  size_bytes: number;
  uploaded_at: string;
  reporting_period: string | null;
  sha256: string;
  status: string;
  // Booleans plus detail entries (lists/objects), e.g. "fact_conflicts",
  // "facts_differ_from_existing", "ixbrl", SEC EDGAR "provenance".
  quality_flags: Record<string, unknown>;
  page_count: number;
  fact_count: number;
}

/** One extracted input behind the ratios — mirrors
 * backend/app/schemas/metrics.py's MetricFactOut. */
export interface MetricFact {
  metric: string;
  value: string;
  currency: string | null;
  document_id: string;
  original_filename: string;
  source_page: number | null;
  confidence: number;
  /** "ifrs-full:CostOfSales", "derived: A + B", "proxy: …"; null if unknown. */
  source: string | null;
}

export interface HoldingMetrics {
  holding_id: string;
  period: string;
  facts: Record<string, string>;
  computed: Record<string, string>;
  skipped: Record<string, string>;
  /** Currency of every monetary figure (the filing's, not the trading currency). */
  currency: string | null;
  notes: Record<string, string>;
  warnings: string[];
  fact_details: MetricFact[];
  /** Previous fiscal year averaged into ROE / ROIC / ROCE, if on file. */
  prior_period?: string | null;
  market?: MarketContext | null;
}

/** Mirrors backend/app/schemas/metrics.py's ShareCountOut. */
export interface ShareCount {
  shares: string | null;
  /** manual | sec_edgar | yfinance | filing */
  source: string | null;
  source_label: string | null;
  as_of: string | null;
  reference: string | null;
  note: string | null;
  override_id: string | null;
  eps_implied_low: string | null;
  eps_implied_high: string | null;
  warnings: string[];
  unavailable_reason: string | null;
}

/** Mirrors backend/app/schemas/metrics.py's MarketContextOut. */
export interface MarketContext {
  price: string | null;
  price_currency: string | null;
  price_as_of: string | null;
  fx_rate: string | null;
  price_in_reporting_currency: string | null;
  reporting_currency: string | null;
  shares: ShareCount;
  unavailable_reason: string | null;
  stale_period: boolean;
}

/** Mirrors backend/app/schemas/document.py's DeletionResult. */
export interface DeletionResult {
  documents: number;
  pages: number;
  chunks: number;
  facts: number;
  analysis_runs: number;
  notes: number;
  market_observations: number;
  research_runs: number;
  research_items: number;
  legacy_holding_analyses: number;
  holdings: number;
  storage_files_deleted: number;
  storage_files_failed: string[];
}

export const DOCUMENT_TYPES = [
  "annual_report",
  "quarterly_report",
  "presentation",
  "prospectus",
  "transcript",
  "other",
] as const;

/** Order + display label for every ratio app/services/metrics.py can name,
 * computed or skipped — keeps the metrics table in a stable, meaningful
 * order instead of whatever order object keys happen to arrive in. */
export const METRIC_LABELS: Record<string, string> = {
  gross_margin: "Gross margin",
  operating_margin: "Operating margin",
  net_margin: "Net margin",
  free_cash_flow: "Free cash flow",
  owner_earnings: "Owner earnings",
  net_debt: "Net debt",
  net_debt_to_ebitda: "Net debt / EBITDA",
  net_debt_to_fcf: "Net debt / FCF",
  interest_coverage: "Interest coverage",
  debt_to_equity: "Debt / equity",
  materials_margin: "Materials margin",
  roic: "ROIC (after tax)",
  roce: "ROCE (pre-tax)",
  roe: "ROE",
  market_cap: "Market cap",
  enterprise_value: "Enterprise value",
  price_to_earnings: "P/E",
  price_to_book: "P/B",
  price_to_sales: "P/S",
  ev_to_ebitda: "EV / EBITDA",
  fcf_yield: "FCF yield",
};

/** The market multiples: shown in their own card, next to the price and
 * share count they were computed from. */
export const MARKET_METRICS = new Set([
  "market_cap",
  "enterprise_value",
  "price_to_earnings",
  "price_to_book",
  "price_to_sales",
  "ev_to_ebitda",
  "fcf_yield",
]);

export const METRIC_ORDER = Object.keys(METRIC_LABELS);

/** Ratios expressed as a fraction (0.4 = 40%) vs. an absolute figure or a
 * multiple — decides whether the metrics table renders "40.0%" or a plain
 * tabular number. Matches app/services/calculations.py's own doc comments. */
/** Absolute money amounts (rendered "USD 1,787.4m"); every other
 * non-percent metric is a multiple (rendered "2.93×"). */
export const MONEY_METRICS = new Set([
  "free_cash_flow",
  "owner_earnings",
  "net_debt",
  "market_cap",
  "enterprise_value",
]);

/** Labels for the extracted inputs (canonical facts) in the provenance table. */
export const FACT_LABELS: Record<string, string> = {
  revenue: "Revenue",
  cost_of_goods_sold: "Cost of sales",
  operating_income: "Operating income",
  ebit: "EBIT",
  ebitda: "EBITDA",
  net_income: "Net income",
  depreciation_and_amortization: "Depreciation & amortisation",
  total_assets: "Total assets",
  total_equity: "Total equity",
  total_liabilities: "Total liabilities",
  operating_cash_flow: "Operating cash flow",
  capital_expenditures: "Capital expenditure",
  total_debt: "Total debt",
  cash_and_equivalents: "Cash & equivalents",
  interest_expense: "Interest expense",
  shares_outstanding: "Shares outstanding",
  hybrid_capital: "Hybrid capital (in equity)",
  decommissioning_payments: "Decommissioning payments",
  interest_paid_financing: "Interest paid (financing)",
  lease_payments_financing: "Lease payments",
  hybrid_distributions: "Hybrid capital coupons",
  income_before_tax: "Profit before tax",
  income_tax_expense: "Income tax expense",
  lease_liabilities: "Lease liabilities",
  minority_interests: "Minority interests",
  eps_basic: "Basic EPS",
  raw_materials_used: "Raw materials & consumables",
};

export const PERCENT_METRICS = new Set([
  "gross_margin",
  "operating_margin",
  "net_margin",
  "materials_margin",
  "roic",
  "roce",
  "roe",
  "fcf_yield",
]);


/** Mirrors backend/app/schemas/account.py. */
export interface Account {
  id: string;
  name: string;
  account_number: string;
  institution: string | null;
  created_at: string;
  updated_at: string;
  position_count: number;
  snapshot_count: number;
}

/** Mirrors backend/app/schemas/account.py's AccountUpdate — every field
 * optional, only what's supplied is changed. account_number is
 * deliberately excluded (see the backend schema's own docstring). */
export interface AccountUpdateInput {
  name?: string;
  institution?: string | null;
}

/** Mirrors backend/app/schemas/portfolio.py. */
export interface PortfolioPosition {
  id: string;
  holding_id: string;
  ticker: string;
  holding_name: string;
  weight_pct: string | null;
  quantity: string | null;
  cost_basis: string | null;
  cost_basis_currency: string | null;
  /** Added 2026-09-22 (migration a2b4c6d8e0f1) — last traded price at
   * import time, in cost_basis_currency (not necessarily NOK). Can be
   * null: "siste kurs" isn't a required CSV column (see
   * backend/app/services/portfolio_import/csv_parser.py). */
  last_price: string | null;
  /** Added 2026-09-22 (migration a2b4c6d8e0f1) — total market value of
   * this position at import time, always in NOK. */
  market_value_nok: string | null;
  notes: string | null;
  account_id: string | null;
}

export interface PortfolioSnapshot {
  id: string;
  uploaded_at: string;
  source_file_id: string;
  reporting_currency: string;
  status: string;
  account_id: string | null;
  positions: PortfolioPosition[];
}

export interface PortfolioSnapshotSummary {
  id: string;
  uploaded_at: string;
  source_file_id: string;
  reporting_currency: string;
  status: string;
  account_id: string | null;
  position_count: number;
}

export interface PortfolioImportResponse {
  document: DocumentSummary;
  account: Account;
  snapshot: PortfolioSnapshot;
  holdings_created: number;
  holdings_matched: number;
  was_duplicate_file: boolean;
}

export interface LegacyAnalysisPurgeCounts {
  analysis_runs: number;
  holding_analyses: number;
  factor_assessments: number;
  evidence_references: number;
  portfolio_risk_snapshots: number;
}

export interface SnapshotDeleteResult {
  deleted_snapshot_id: string;
  positions_deleted: number;
  legacy_analysis_purged: LegacyAnalysisPurgeCounts;
}

export interface PortfolioWipeResult {
  accounts_deleted: number;
  snapshots_deleted: number;
  positions_deleted: number;
  legacy_analysis_purged: LegacyAnalysisPurgeCounts;
}

/** Mirrors backend/app/schemas/research.py (Sprint 2 — live, evidence-first
 * research: CLAUDE.md Rule 2 requires every item to carry a real, citable
 * source_url/source_name, which is why this shape has no "content" field
 * without one). */
export interface ResearchItem {
  title: string;
  summary: string;
  source_name: string;
  source_url: string;
  /** macro_news | sector_research | company_research (see
   * app/providers/gemini_research_provider.py) — a plain string, not an
   * enforced enum. */
  source_type: string;
  published_at: string | null;
  retrieved_at: string;
}

/** Shared by macro/sector/company research responses. `available: false`
 * with a `reason` covers both "never run yet" and "provider just failed,
 * here's the (possibly stale) cache" — see backend/app/api/research.py's
 * header comment. */
export interface ResearchSnapshotBase {
  available: boolean;
  as_of: string | null;
  items: ResearchItem[];
  reason: string | null;
}

export type MacroResearch = ResearchSnapshotBase;

export interface SectorResearch extends ResearchSnapshotBase {
  sector: string;
}

export interface CompanyResearch extends ResearchSnapshotBase {
  holding_id: string;
  ticker: string;
}

export const RESEARCH_SOURCE_TYPE_LABELS: Record<string, string> = {
  macro_news: "Macro",
  sector_research: "Sector",
  company_research: "Company",
  regulatory_announcement: "Announcement",
};

/** Mirrors backend/app/schemas/sources.py (2026-09-22 — SEC EDGAR + Oslo
 * Børs Newsweb primary sources). */
export interface SourceEligibility {
  holding_id: string;
  ticker: string;
  sec_edgar: boolean;
  sec_edgar_reason: string | null;
  newsweb: boolean;
  newsweb_reason: string | null;
  esef_index: boolean;
  esef_index_reason: string | null;
}

/** Mirrors backend EsefImportOut (Sprint 10 — ESEF history from
 * filings.xbrl.org, by LEI). */
export interface EsefFiling {
  period_end: string;
  fxo_id: string;
  report_url: string;
  viewer_url: string;
  error_count: number;
  years_used: string[];
  integrity_failed: string[];
}

export interface EsefImport {
  holding_id: string;
  imported: boolean;
  suggested_lei: string | null;
  suggested_lei_source: string | null;
  lei: string | null;
  lei_source: string | null;
  imported_at: string | null;
  periods_imported: string[];
  periods_skipped_existing: string[];
  facts_imported: number;
  metrics_by_period: Record<string, string[]>;
  filings: EsefFiling[];
  latest_period_in_index: string | null;
  warnings: string[];
}

export interface EdgarFiling {
  accession_number: string;
  form: string;
  filed: string;
  url: string;
}

export interface EdgarImport {
  holding_id: string;
  imported: boolean;
  cik: string | null;
  entity_name: string | null;
  source_url: string | null;
  document_id: string | null;
  was_duplicate: boolean;
  periods_imported: string[];
  periods_skipped_manual: string[];
  facts_imported: number;
  metrics_by_period: Record<string, string[]>;
  filings: EdgarFiling[];
  retrieved_at: string | null;
  warnings: string[];
}

export interface HoldingAnnouncements extends ResearchSnapshotBase {
  holding_id: string;
  ticker: string;
}

/**
 * Mirrors backend/app/schemas/valuation.py (Sprint 3 — Brain Step 4: DCF,
 * reverse DCF, and multiples-over-time for one holding). Same
 * Decimal-as-string wire format as everywhere else in this file — see the
 * header comment above.
 */
export interface DCFScenario {
  label: string;
  growth_rate: string;
  intrinsic_value_per_share: string;
  /** (intrinsic - price) / intrinsic. null when no live price was
   * available to compare against. Positive = undervalued. */
  margin_of_safety: string | null;
}

export interface DCF {
  discount_rate: string;
  terminal_growth_rate: string;
  scenarios: DCFScenario[];
}

export interface PeriodMultiples {
  period: string;
  matched_price_observed_at: string | null;
  computed: Record<string, string>;
  skipped: Record<string, string>;
  notes?: string[];
}

export interface HoldingValuation {
  holding_id: string;
  ticker: string;
  valuation_currency: string | null;
  as_of: string | null;
  base_growth_rate: string | null;
  discount_rate: string | null;
  risk_free_rate_pct: string | null;
  beta: string | null;
  equity_risk_premium: string | null;
  current_price_per_share: string | null;
  dcf: DCF | null;
  reverse_dcf_implied_growth: string | null;
  multiples: PeriodMultiples[];
  /** "2,496.4m shares (Yahoo Finance, 2026-09-25)" — the count the DCF used. */
  shares_outstanding?: string | null;
  shares_source?: string | null;
  assumptions_version: string;
  unavailable_reasons: string[];
}

/** Order + display label for every multiple
 * app/services/valuation/multiples.py can compute — mirrors this file's
 * own METRIC_LABELS convention above. enterprise_value is deliberately
 * excluded here: it's an intermediate figure (feeds ev_to_ebitda), not a
 * multiple to chart on its own. */
export const MULTIPLE_LABELS: Record<string, string> = {
  price_to_earnings: "P/E",
  price_to_book: "P/B",
  price_to_sales: "P/S",
  ev_to_ebitda: "EV / EBITDA",
};

export const MULTIPLE_ORDER = Object.keys(MULTIPLE_LABELS);

/**
 * Mirrors backend/app/schemas/analysis.py and
 * app/domain/analysis_schema/v1.py (Sprint 4 — the two-pass Buffett/Munger
 * analysis). Every section carries `evidence_ids` that resolve against the
 * run's own `evidence_items` (CLAUDE.md Rule 2).
 */
export type MoatRating = "Wide" | "Narrow" | "None";
export type VerdictRating = "Strong Buy" | "Buy" | "Hold" | "Sell" | "Avoid";

export interface MoatSourceRating {
  source: string;
  rating: MoatRating;
  reasoning: string;
  evidence_ids: string[];
}

export interface MoatAssessment {
  circle_of_competence_summary: string;
  overall_rating: MoatRating;
  sources: MoatSourceRating[];
  evidence_ids: string[];
}

export interface NarrativeAssessment {
  summary: string;
  evidence_ids: string[];
}

export interface VerdictContent {
  rating: VerdictRating;
  thesis_bullets: string[];
  top_risks: string[];
  metrics_to_monitor: string[];
  invalidation_triggers: string[];
  evidence_ids: string[];
}

export interface BlindPassOutput {
  moat: MoatAssessment;
  capital_efficiency: NarrativeAssessment;
  financial_fortress: NarrativeAssessment;
  macro_stress_test: NarrativeAssessment;
  valuation_synthesis: NarrativeAssessment;
  verdict: VerdictContent;
}

/** Sprint 8: the fund / ETF blind pass (backend schema "fund_v1"). */
export interface LookThroughMoat {
  circle_of_competence_summary: string;
  overall_rating: MoatRating;
  coverage_caveat: string;
  evidence_ids: string[];
}

export interface FundBlindPassOutput {
  moat: LookThroughMoat;
  steward_and_costs: NarrativeAssessment;
  portfolio_construction: NarrativeAssessment;
  macro_stress_test: NarrativeAssessment;
  valuation_synthesis: NarrativeAssessment;
  role_in_portfolio: NarrativeAssessment;
  verdict: VerdictContent;
}

export function isFundBlindPass(
  output: BlindPassOutput | FundBlindPassOutput,
): output is FundBlindPassOutput {
  return "role_in_portfolio" in output;
}

export interface ReconciliationOutput {
  verdict: VerdictContent;
  reconciliation_narrative: string;
  changed_from_blind: boolean;
  evidence_ids: string[];
}

export interface EvidenceItem {
  id: string;
  category: string;
  label: string;
  content: string;
  citation: string | null;
}

export type AnalysisRunStatus =
  | "QUEUED"
  | "RUNNING"
  | "BLIND_ONLY"
  | "COMPLETED"
  | "FAILED"
  | "CANCELLED";

/** Where the analysis passes ran: "cloud" = on the server's LLM during the
 * request; "local" = queued and run by the worker on Faiz's PC (Sprint 5B). */
export type AnalysisEngine = "cloud" | "local";

export interface AnalysisRun {
  id: string;
  holding_id: string;
  status: AnalysisRunStatus;
  schema_version: string;
  blind_prompt_version: string;
  reconciliation_prompt_version: string | null;
  evidence_packet_version: string;
  provider: string | null;
  model_name: string | null;
  started_at: string;
  blind_completed_at: string | null;
  completed_at: string | null;
  error_message: string | null;
  evidence_unavailable_reasons: string[];
  /** Shape depends on schema_version: "v1" (a company) or "fund_v1". */
  blind_pass: BlindPassOutput | FundBlindPassOutput | null;
  blind_pass_citation_warnings: string[] | null;
  reconciliation: ReconciliationOutput | null;
  reconciliation_citation_warnings: string[] | null;
  /** Deterministic, from the DCF bear/bull scenarios — never LLM output. */
  price_target_low: string | null;
  price_target_high: string | null;
  price_target_currency: string | null;
  evidence_items: EvidenceItem[];
  user_notes_snapshot: string | null;
  engine: AnalysisEngine;
  queued_at: string | null;
  claimed_by: string | null;
  attempts: number;
}

// --- Sprint 5B: local worker queue (backend/app/api/analysis.py /queue) ---

export interface QueuedRun {
  id: string;
  holding_id: string;
  ticker: string | null;
  holding_name: string | null;
  status: AnalysisRunStatus;
  engine: AnalysisEngine;
  queued_at: string | null;
  claimed_by: string | null;
  claimed_at: string | null;
  started_at: string;
  completed_at: string | null;
  attempts: number;
  error_message: string | null;
  provider: string | null;
  model_name: string | null;
  verdict: VerdictRating | null;
}

export type WorkerState = "idle" | "running" | "waiting_quota" | "llm_unavailable" | "stopped";

export interface AnalysisWorker {
  worker_id: string;
  hostname: string | null;
  llm_provider: string | null;
  model_name: string | null;
  state: WorkerState | string;
  detail: string | null;
  current_run_id: string | null;
  started_at: string;
  last_seen_at: string;
  online: boolean;
}

export interface AnalysisQueue {
  workers: AnalysisWorker[];
  any_worker_online: boolean;
  pending: QueuedRun[];
  recent: QueuedRun[];
}

export interface QueueReadyHoldingsResult {
  queued: QueuedRun[];
  already_queued: QueuedRun[];
  skipped: { holding_id: string; ticker: string | null; holding_name: string | null; reason: string }[];
}

export interface HoldingNote {
  holding_id: string;
  content: string;
  updated_at: string | null;
}

export type ReadinessStatus = "ok" | "warn" | "block";

export interface ReadinessCheck {
  key: string;
  label: string;
  status: ReadinessStatus;
  detail: string;
}

/** GET /analysis/holdings/{id}/readiness — feature F2. Side-effect free. */
export interface AnalysisReadiness {
  holding_id: string;
  ready: boolean;
  blockers: number;
  warnings: number;
  estimated_gemini_calls: number;
  gemini_calls_remaining_today: number | null;
  checks: ReadinessCheck[];
}

/** GET /valuation/board — feature F3 (backend/app/services/valuation/board.py). */
export type BoardZone = "below_bear" | "bear_to_base" | "base_to_bull" | "above_bull" | "unavailable";

export interface BoardRow {
  holding_id: string;
  ticker: string;
  name: string;
  sector: string | null;
  market_value_nok: string | null;
  /** Fraction of total equity value (0..1), not a percentage. */
  weight_pct: string | null;
  valuation_currency: string | null;
  price: string | null;
  price_as_of: string | null;
  bear: string | null;
  base: string | null;
  bull: string | null;
  margin_of_safety_base: string | null;
  margin_of_safety_bear: string | null;
  zone: BoardZone;
  unavailable_reason: string | null;
  verdict_rating: VerdictRating | null;
  moat_rating: MoatRating | null;
  analyzed_at: string | null;
}

export interface MarginOfSafetyBoard {
  rows: BoardRow[];
  total_equity_value_nok: string;
  zone_counts: Record<BoardZone, number>;
}

// --- Portfolio overview (Sprint 5 dashboard) — backend/app/schemas/portfolio.py
// Percentages in this block are 0-100, not fractions.

export interface AllocationSlice {
  key: string;
  label: string;
  value_nok: string;
  weight_pct: string;
  holding_count: number;
}

export interface RatingSlice {
  rating: VerdictRating | MoatRating | "Not analyzed";
  holding_count: number;
  value_nok: string;
  weight_pct: string;
}

export interface OverviewPosition {
  holding_id: string;
  ticker: string;
  name: string;
  instrument_type: string;
  sector: string | null;
  trading_currency: string;
  value_nok: string | null;
  weight_pct: string | null;
  account_count: number;
  verdict_rating: VerdictRating | null;
  moat_rating: MoatRating | null;
  analyzed_at: string | null;
  analysis_stale: boolean;
}

export interface OverviewAccount {
  account_id: string | null;
  name: string;
  value_nok: string;
  position_count: number;
  snapshot_at: string;
  stale: boolean;
}

export interface SummaryPoint {
  tone: "good" | "info" | "warn";
  text: string;
}

export interface PortfolioOverview {
  as_of: string | null;
  total_value_nok: string;
  equity_value_nok: string;
  holding_count: number;
  position_count: number;
  positions_missing_value: number;
  accounts: OverviewAccount[];
  by_instrument_type: AllocationSlice[];
  by_sector: AllocationSlice[];
  by_currency: AllocationSlice[];
  concentration: {
    hhi: string | null;
    effective_holdings: string | null;
    top1_pct: string | null;
    top5_pct: string | null;
    top10_pct: string | null;
  };
  verdicts: RatingSlice[];
  moats: RatingSlice[];
  analyzed_equity_count: number;
  equity_count: number;
  analyzed_equity_value_pct: string | null;
  stale_analysis_count: number;
  positions: OverviewPosition[];
  summary: SummaryPoint[];
}

// --- System status (F4) — backend/app/schemas/system.py

export type StatusLevel = "ok" | "warn" | "error" | "off";

export interface StatusItem {
  key: string;
  label: string;
  status: StatusLevel;
  value: string;
  detail: string;
}

export interface FreshnessItem {
  key: string;
  label: string;
  last_at: string | null;
  status: StatusLevel;
  detail: string;
}

export interface SystemStatus {
  generated_at: string;
  version: string;
  environment: string;
  commit: string | null;
  database_ok: boolean;
  database_dialect: string | null;
  migration_current: string | null;
  migration_head: string | null;
  providers: StatusItem[];
  llm_daily_limit: number;
  llm_calls_remaining_today: number;
  freshness: FreshnessItem[];
  analysis: StatusItem[];
  counts: Record<string, number>;
  issues: string[];
}

// --- Watchlist (F7) — backend/app/schemas/watchlist.py

export type WatchlistStatus = "buy_zone" | "near" | "above" | "no_target" | "no_price" | "currency_mismatch";

export interface WatchlistRow {
  id: string;
  holding_id: string;
  ticker: string;
  name: string;
  sector: string | null;
  instrument_type: string;
  owned: boolean;
  buy_below_price: string | null;
  buy_below_currency: string | null;
  notes: string | null;
  added_at: string;
  price: string | null;
  price_currency: string | null;
  price_as_of: string | null;
  /** 0-100 scale; negative = price is below your buy-below price. */
  distance_to_buy_pct: string | null;
  status: WatchlistStatus;
  dcf_base: string | null;
  /** Fraction (0.25 = 25%), same as the margin-of-safety board. */
  margin_of_safety_base: string | null;
  verdict_rating: VerdictRating | null;
  moat_rating: MoatRating | null;
  analyzed_at: string | null;
  unavailable_reason: string | null;
}

export interface Watchlist {
  rows: WatchlistRow[];
  buy_zone_count: number;
}

export interface WatchlistCreateInput {
  holding_id?: string;
  ticker?: string;
  name?: string;
  trading_currency?: string;
  sector?: string | null;
  buy_below_price?: string | null;
  notes?: string | null;
}

export interface WatchlistUpdateInput {
  buy_below_price?: string | null;
  notes?: string | null;
}

// --- Decision journal (F6) — backend/app/schemas/journal.py

export type JournalAction = "buy" | "add" | "trim" | "sell" | "hold" | "pass";

export interface JournalOutcome {
  days_since: number;
  latest_price: string | null;
  latest_price_at: string | null;
  /** 0-100 scale. */
  return_pct: string | null;
  in_favour: boolean | null;
  price_6m: string | null;
  return_6m_pct: string | null;
  price_12m: string | null;
  return_12m_pct: string | null;
  review_6m_due: boolean;
  review_12m_due: boolean;
  note: string | null;
}

export interface JournalEntry {
  id: string;
  holding_id: string | null;
  ticker: string;
  company_name: string;
  action: JournalAction;
  decided_on: string;
  price: string | null;
  currency: string | null;
  quantity: string | null;
  thesis: string;
  invalidation: string | null;
  confidence: number | null;
  verdict_at_decision: VerdictRating | null;
  review_6m: string | null;
  review_12m: string | null;
  created_at: string;
  updated_at: string;
  outcome: JournalOutcome;
}

export interface Journal {
  entries: JournalEntry[];
  reviews_due: number;
}

export interface JournalEntryInput {
  holding_id: string;
  action: JournalAction;
  decided_on: string;
  price?: string | null;
  currency?: string | null;
  quantity?: string | null;
  thesis: string;
  invalidation?: string | null;
  confidence?: number | null;
}

export type JournalEntryUpdate = Partial<Omit<JournalEntryInput, "holding_id">> & {
  review_6m?: string | null;
  review_12m?: string | null;
};

export const JOURNAL_ACTIONS: { key: JournalAction; label: string }[] = [
  { key: "buy", label: "Buy" },
  { key: "add", label: "Add" },
  { key: "trim", label: "Trim" },
  { key: "sell", label: "Sell" },
  { key: "hold", label: "Hold" },
  { key: "pass", label: "Pass" },
];

// --- Sprint 8: fund / ETF facts (backend/app/api/funds.py) ---

export type FundDimension = "holding" | "sector" | "country" | "currency";

export interface FundProfile {
  id: string;
  holding_id: string;
  management_style: "active" | "index";
  benchmark_name: string | null;
  ongoing_charge_pct: string | null;
  performance_fee: string | null;
  domicile: string | null;
  base_currency: string | null;
  replication: "physical" | "synthetic" | "sampling" | null;
  distribution: "accumulating" | "distributing" | null;
  fund_size: string | null;
  fund_size_currency: string | null;
  inception_date: string | null;
  risk_class: number | null;
  holdings_count: number | null;
  strategy_summary: string | null;
  report_name_filter: string | null;
  as_of_date: string | null;
  source_document_id: string;
  source_page: number | null;
  updated_at: string;
}

export type FundProfileInput = Omit<FundProfile, "id" | "holding_id" | "updated_at">;

export interface FundReturn {
  id?: string;
  period_kind: "calendar_year" | "rolling_12m" | "trailing" | "since_inception";
  period_label: string;
  years: string | null;
  annualised: boolean;
  fund_return_pct: string;
  benchmark_return_pct: string | null;
  benchmark_name: string | null;
  end_date: string | null;
  source_document_id: string;
  source_page: number | null;
}

export interface FundExposure {
  id: string;
  dimension: FundDimension;
  label: string;
  weight_pct: string;
  ticker: string | null;
  isin: string | null;
  linked_holding_id: string | null;
  link_method: "ticker" | "name" | "manual" | null;
  as_of_date: string;
  source_document_id: string;
  source_page: number | null;
}

export interface FundExposureRowInput {
  label: string;
  weight_pct: string;
  ticker?: string | null;
  isin?: string | null;
  source_page?: number | null;
}

export interface FundDocument {
  id: string;
  original_filename: string;
  type: string;
  reporting_period: string | null;
}

export interface FundReturnRow {
  id: string;
  period_kind: string;
  period_label: string;
  fund_return_pct: string;
  benchmark_return_pct: string | null;
  benchmark_name: string | null;
  difference_pp: string | null;
  fund_annualised_pct: string | null;
  benchmark_annualised_pct: string | null;
  annualised_difference_pp: string | null;
}

export interface FundLookThroughHolding {
  exposure_id: string;
  label: string;
  weight_pct: string;
  linked_holding_id: string | null;
  linked_ticker: string | null;
  link_method: string | null;
  latest_period: string | null;
  roe_pct: string | null;
  operating_margin_pct: string | null;
  net_debt_to_ebitda: string | null;
  moat_rating: string | null;
  verdict_rating: string | null;
  direct_value_nok: string | null;
  through_fund_value_nok: string | null;
}

export interface FundMetrics {
  cost: {
    ongoing_charge_pct: string | null;
    fee_drag_pct: Record<string, string>;
    yearly_fee_nok: string | null;
  };
  track_record: {
    gap_label: string;
    rows: FundReturnRow[];
    one_year_periods_compared: number;
    one_year_periods_beaten: number;
    average_one_year_difference_pp: string | null;
    longest_period_label: string | null;
    longest_period_annualised_difference_pp: string | null;
  };
  concentration: {
    as_of_date: string | null;
    rows_known: number;
    stated_holdings_count: number | null;
    coverage_pct: string | null;
    complete: boolean;
    top10_pct: string | null;
    largest: { label: string; weight_pct: string } | null;
    hhi: string | null;
    effective_holdings: string | null;
  };
  exposures: {
    dimension: string;
    as_of_date: string | null;
    rows: { label: string; weight_pct: string }[];
    total_pct: string;
  }[];
  foreign_currency_pct: string | null;
  look_through: {
    holdings: FundLookThroughHolding[];
    linked_weight_pct: string;
    with_financials_weight_pct: string;
    metrics: { key: string; label: string; value: string | null; coverage_pct: string; holdings_used: number }[];
    moat_mix: Record<string, string>;
    verdict_mix: Record<string, string>;
  };
  overlap: {
    fund_value_nok: string | null;
    rows: FundLookThroughHolding[];
    total_through_fund_nok: string | null;
  };
  gaps: string[];
}

export interface FundFacts {
  holding_id: string;
  instrument_type: string;
  profile: FundProfile | null;
  returns: FundReturn[];
  exposures: Record<FundDimension, FundExposure[]>;
  documents: FundDocument[];
  metrics: FundMetrics;
}

export interface HoldingsImportResult {
  document_id: string;
  was_duplicate_file: boolean;
  as_of_date: string;
  rows_imported: number;
  weight_sum_pct: string;
  linked: number;
  derived_dimensions: string[];
  sheet: string;
  header_row: number;
  columns: Record<string, string>;
  weights_were_fractions: boolean;
  warnings: string[];
}

// --- Numeric macro data (2026-09-24, backend/app/api/macro.py) -----------

export interface MacroHistoryPoint {
  date: string;
  value: string;
}

export interface MacroIndicator {
  key: string;
  label: string;
  region: string; // "NO" | "US"
  group: string; // rates | inflation | fx | labour | credit | derived
  display_unit: string; // "%" | "NOK" | "pp"
  frequency: string; // daily | monthly | computed
  change_kind: "pp" | "pct";
  description: string;
  source_name: string;
  source_series_id: string;
  source_url: string;
  derived: boolean;
  value: string | null;
  observed_on: string | null;
  value_3m_ago: string | null;
  change_3m: string | null;
  value_12m_ago: string | null;
  change_12m: string | null;
  stale: boolean;
  age_days: number | null;
  formula: string | null;
  last_success_at: string | null;
  last_error: string | null;
  history: MacroHistoryPoint[];
}

export interface MacroIndicators {
  series_version: string;
  fetching_enabled: boolean;
  last_success_at: string | null;
  indicators: MacroIndicator[];
  derived: MacroIndicator[];
}

export interface MacroSeriesRefresh {
  key: string;
  label: string;
  status: "updated" | "unchanged" | "failed" | "fresh";
  inserted: number;
  latest_observed: string | null;
  error: string | null;
}

export interface MacroRefreshResult {
  results: MacroSeriesRefresh[];
  indicators: MacroIndicators;
}

// --- Thesis tracking (Sprint 11) — backend/app/schemas/thesis.py

export type ThesisStatus = "tripwire_fired" | "review" | "not_analyzed" | "intact";
export type TripwireOperator = "below" | "above";
export type MetricGroup = "fundamentals" | "market_multiples" | "price";

export interface MetricDef {
  key: string;
  label: string;
  group: MetricGroup;
  unit: string;
}

export interface Tripwire {
  id: string;
  holding_id: string;
  metric: string;
  metric_label: string;
  operator: TripwireOperator;
  threshold: string;
  label: string | null;
  origin: string | null;
  source_run_id: string | null;
  active: boolean;
  fired_at: string | null;
  seen_at: string | null;
  created_at: string;
  updated_at: string;
  current_value: string | null;
  unavailable_reason: string | null;
  firing: boolean;
}

export interface TripwireCreateInput {
  metric: string;
  operator: TripwireOperator;
  threshold: string;
  label?: string | null;
  origin?: string | null;
  source_run_id?: string | null;
}

export interface TripwireUpdateInput {
  operator?: TripwireOperator;
  threshold?: string;
  label?: string | null;
  active?: boolean;
}

export interface ChangeReason {
  key: string;
  text: string;
}

export interface TimelineEntry {
  run_id: string;
  date: string;
  verdict: VerdictRating | null;
  verdict_direction: "up" | "down" | "flat" | null;
  moat: MoatRating | null;
  moat_direction: "up" | "down" | "flat" | null;
  price: string | null;
  price_currency: string | null;
  dcf_low: string | null;
  dcf_high: string | null;
  pass_type: "blind_only" | "reconciled";
  engine: string;
  model_name: string | null;
  thesis_bullets: string[];
}

export interface TripwireSuggestion {
  text: string;
  metric: string | null;
  operator: TripwireOperator | null;
  threshold: string | null;
}

export interface HoldingThesis {
  holding_id: string;
  ticker: string;
  name: string;
  status: ThesisStatus;
  status_label: string;
  analyzed_at: string | null;
  change_reasons: ChangeReason[];
  tripwires: Tripwire[];
  timeline: TimelineEntry[];
  suggestions: TripwireSuggestion[];
}

export interface MonitorRow {
  holding_id: string;
  ticker: string;
  name: string;
  status: ThesisStatus;
  status_label: string;
  firing_count: number;
  change_reason_count: number;
  analyzed_at: string | null;
}

export interface ThesisMonitor {
  rows: MonitorRow[];
}

// --- Portfolio risk (Sprint 12) — backend/app/api/risk.py -----------------

export interface CorrelationPair {
  ticker_a: string;
  ticker_b: string;
  correlation: string;
  overlap_days: number;
}

export interface ExcludedTicker {
  key: string;
  reason: string;
}

export interface CorrelationMatrix {
  lookback_days: number;
  tickers: string[];
  pairs: CorrelationPair[];
  excluded: ExcludedTicker[];
}

export interface ClusterFlag {
  tickers: string[];
  names: string[];
  correlation: string;
  combined_weight_pct: string;
}

export type StressMethod = "dcf_bear" | "volatility" | "unavailable";

export interface HoldingStress {
  holding_id: string;
  ticker: string;
  name: string;
  method: StressMethod;
  value_nok: string;
  weight_pct: string | null;
  shock_pct: string | null;
  contribution_nok: string | null;
  reason: string | null;
}

export interface StressScenario {
  std_devs: string;
  horizon_note: string;
  portfolio_shock_pct: string | null;
  portfolio_drawdown_nok: string | null;
  total_value_considered_nok: string;
  holdings: HoldingStress[];
}

export type MacroRegime = "baseline" | "stagflation" | "crisis";

export interface RegimeInput {
  key: string;
  label: string;
  region: string;
  latest_value: string | null;
  smoothed_value: string | null;
  unit: string;
}

export interface Regime {
  regime: MacroRegime;
  home_market_series_included: boolean;
  curve_and_credit_are_us_only: boolean;
  explanation: string;
  method_note: string;
  inputs: RegimeInput[];
  data_complete: boolean;
  missing: string[];
}

export interface PortfolioRisk {
  as_of: string | null;
  equity_value_nok: string;
  lookback_days: number;
  cluster_threshold: string;
  correlation: CorrelationMatrix;
  clusters: ClusterFlag[];
  stress: StressScenario;
  regime: Regime;
  price_history_notes: string[];
}
