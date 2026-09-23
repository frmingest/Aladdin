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
   * "stock" | "equity_etf" | "bond_fund" | "money_market_fund" |
   * "commodity_etc". Only "stock"/"equity_etf" are in scope for the
   * Buffett/Munger analysis engine; the rest are tracked for portfolio
   * composition only. */
  asset_class_raw: string;
  created_at: string;
  updated_at: string;
  document_count: number;
  position_count: number;
}

export const INSTRUMENT_TYPE_LABELS: Record<string, string> = {
  stock: "Stock",
  equity_etf: "Equity ETF",
  bond_fund: "Bond fund",
  money_market_fund: "Money-market fund",
  commodity_etc: "Commodity ETC",
};

export const EQUITY_ANALYZABLE_TYPES = new Set(["stock", "equity_etf"]);

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
  roic: "ROIC",
  roe: "ROE",
  price_to_earnings: "P/E",
  price_to_book: "P/B",
  price_to_sales: "P/S",
  ev_to_ebitda: "EV / EBITDA",
  enterprise_value: "Enterprise value",
};

export const METRIC_ORDER = Object.keys(METRIC_LABELS);

/** Ratios expressed as a fraction (0.4 = 40%) vs. an absolute figure or a
 * multiple — decides whether the metrics table renders "40.0%" or a plain
 * tabular number. Matches app/services/calculations.py's own doc comments. */
/** Absolute money amounts (rendered "USD 1,787.4m"); every other
 * non-percent metric is a multiple (rendered "2.93×"). */
export const MONEY_METRICS = new Set(["free_cash_flow", "owner_earnings", "net_debt"]);

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
};

export const PERCENT_METRICS = new Set([
  "gross_margin",
  "operating_margin",
  "net_margin",
  "roic",
  "roe",
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

export type AnalysisRunStatus = "RUNNING" | "BLIND_ONLY" | "COMPLETED" | "FAILED";

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
  blind_pass: BlindPassOutput | null;
  blind_pass_citation_warnings: string[] | null;
  reconciliation: ReconciliationOutput | null;
  reconciliation_citation_warnings: string[] | null;
  /** Deterministic, from the DCF bear/bull scenarios — never LLM output. */
  price_target_low: string | null;
  price_target_high: string | null;
  price_target_currency: string | null;
  evidence_items: EvidenceItem[];
  user_notes_snapshot: string | null;
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
