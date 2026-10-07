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

/** One stored figure of a document — mirrors backend/app/schemas/document.py's
 * FinancialLineItemOut. `source_page` is the rendered report page (XHTML) or
 * PDF page it came from; null/0 when the source has no pages (CSV, derived). */
export interface DocumentFact {
  metric: string;
  value: string;
  unit: string;
  currency: string | null;
  period: string;
  source_page: number | null;
  confidence: number;
}

/** GET /documents/{id}: the summary plus every stored figure. */
export interface DocumentDetail extends DocumentSummary {
  facts: DocumentFact[];
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
  profit_continuing_operations: "Profit from continuing operations",
  profit_discontinued_operations: "Profit from discontinued operations",
  impairment_loss: "Impairment loss",
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
  /** Cash typed by hand (game mode's Vault). null = never entered; "0" = entered and empty. */
  cash_nok: string | null;
  cash_as_of: string | null;
}

/** Mirrors backend/app/schemas/account.py's AccountUpdate — every field
 * optional, only what's supplied is changed. account_number is
 * deliberately excluded (see the backend schema's own docstring). */
export interface AccountUpdateInput {
  name?: string;
  institution?: string | null;
  /** Decimal string; null clears the figure back to "never entered". */
  cash_nok?: string | null;
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
  newsweb_annual_report: boolean;
  newsweb_annual_report_reason: string | null;
  newsweb_interim_report: boolean;
  newsweb_interim_report_reason: string | null;
}

/** Mirrors backend NewswebAnnualReportOut — one ESEF annual-report filing
 * fetched from Newsweb itself, unzipped if needed, and run through the
 * same extractor an upload uses (Sprint 15). */
export interface NewswebAnnualReport {
  message_id: string;
  message_url: string;
  title: string;
  published_at: string | null;
  attachment_name: string;
  document_id: string;
  was_duplicate: boolean;
  imported_at: string | null;
  facts_imported: number;
  periods_imported: string[];
  metrics_by_period: Record<string, string[]>;
  warnings: string[];
}

/** Mirrors backend NewswebAnnualReportsOut — every year fetched from
 * Newsweb for a holding so far (extended 2026-09-26 to fetch every
 * available year back to history_since, not just the newest one). */
export interface NewswebAnnualReports {
  holding_id: string;
  history_since: string; // e.g. "2022-01-01"
  reports: NewswebAnnualReport[]; // newest first
  newly_imported_this_run: number;
  already_on_file_this_run: string[];
  no_esef_file_this_run: string[];
  failed_this_run: string[];
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

export interface FinancialsScenario {
  label: string;
  roe: string;
  justified_price_to_book: string;
  value_per_share: string;
  margin_of_safety: string | null;
}

/** Justified price-to-book valuation for banks/insurers (2026-09-29). */
export interface FinancialsValuation {
  cost_of_equity: string;
  growth_rate: string;
  book_value_per_share: string;
  roe_periods_used: number;
  roe_was_capped: boolean;
  scenarios: FinancialsScenario[];
}

export type ValuationMethod = "owner_earnings_dcf" | "financials_price_to_book" | "fund_look_through_pe";
/** "implausible" = computed, then withheld because it was not credible vs the price. */
export type ValuationStatus = "ok" | "implausible" | "unavailable";

export interface LookThroughScenario {
  label: string;
  growth_rate: string;
  fair_pe: string;
  value_per_unit: string;
  margin_of_safety: string | null;
}

/** Fund look-through earnings-yield screen (2026-09-29) — GET /valuation/holdings/{fund}. */
export interface FundLookThrough {
  scenarios: LookThroughScenario[];
  fund_earnings_yield: string;
  fund_pe: string;
  coverage_pct: string;
  constituents_used: number;
  constituents_total: number;
  cost_of_equity: string;
  terminal_growth_rate: string;
  oldest_observation: string | null;
  notes: string[];
  method_note: string;
}

export interface LookThroughRefresh {
  lines: number;
  priced: number;
  unpriced: number;
  no_isin: number;
  /** Lines linked to companies added to the app since the list was imported. */
  newly_linked?: number;
  /** Lines priced through their linked holding because they have no ISIN. */
  via_link?: number;
  refreshed_at: string;
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
  /** Sprint 14 (2026-09-26) — set only when the backend's
   * regime_adjusted_dcf_enabled setting is on. base_discount_rate is the
   * plain CAPM rate before any widening; discount_rate above is what the
   * DCF actually used (they're equal when this feature is off). */
  base_discount_rate?: string | null;
  regime?: MacroRegime | null;
  regime_discount_rate_addon?: string | null;
  regime_adjustments_version?: string | null;
  valuation_method?: ValuationMethod;
  valuation_status?: ValuationStatus;
  valuation_status_reason?: string | null;
  raw_base_growth_rate?: string | null;
  growth_capped?: boolean;
  fades_to_terminal?: boolean;
  capm_cost_of_equity?: string | null;
  financials?: FinancialsValuation | null;
  fund_look_through?: FundLookThrough | null;
  /** Withheld values, for display as "rejected" only. */
  rejected_values?: Record<string, string> | null;
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
  /** Set when a stored target is implausible vs the price (pre-guard runs). */
  price_target_warning?: string | null;
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

export type QueueScope = "holdings" | "watchlist" | "all";

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
  valuation_method?: ValuationMethod;
  valuation_status?: ValuationStatus;
  unavailable_reason: string | null;
  verdict_rating: VerdictRating | null;
  moat_rating: MoatRating | null;
  analyzed_at: string | null;
  /** Sprint 14 (2026-09-26) — same meaning as HoldingValuation's fields. */
  regime?: MacroRegime | null;
  regime_discount_rate_addon?: string | null;
  /** 2026-09-30 — watchlist rows only: your own buy-below target. */
  buy_below_price?: string | null;
  buy_below_currency?: string | null;
}

export interface MarginOfSafetyBoard {
  rows: BoardRow[];
  total_equity_value_nok: string;
  zone_counts: Record<BoardZone, number>;
  /** Watchlist companies you don't own — shown in their own card. */
  watchlist_rows?: BoardRow[];
  snapshot_at?: string | null;
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

/** GET /usage/summary — the LLM usage ledger (backend/app/services/llm_ledger.py). */
export interface UsageDay {
  date: string;
  provider: string;
  model_name: string;
  requests: number;
  failed: number;
  blocked: number;
  input_tokens: number;
  output_tokens: number;
  daily_limit: number | null;
  remaining: number | null;
}

export interface UsageSummary {
  generated_at: string;
  days: number;
  gemini_daily_limit: number;
  gemini_used_today: number;
  gemini_remaining_today: number;
  daily: UsageDay[];
  by_call_type: { provider: string; call_type: string; requests: number }[];
  recent_errors: { occurred_at: string; provider: string; call_type: string; detail: string }[];
  demo_mode: boolean;
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
  demo_mode: boolean;
}

// --- Demo mode settings (2026-09-26) — backend/app/api/settings.py

export interface DemoModeState {
  demo_mode: boolean;
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
  valuation_method?: ValuationMethod;
  valuation_status?: ValuationStatus;
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
  /** When the stored snapshot was built (page-load work, 2026-09-30). */
  snapshot_at?: string | null;
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
  /** When the nightly tripwire check last ran (null = never), and its one-line summary. */
  last_check_at?: string | null;
  last_check_summary?: string | null;
}

export interface TripwireChange {
  holding_id: string;
  ticker: string;
  tripwire_id: string;
  metric: string;
  label: string | null;
  current_value: string | null;
}

/** POST /thesis/check — what the tripwire check found this pass. */
export interface TripwireCheckResult {
  ran_at: string;
  holdings_checked: number;
  tripwires_checked: number;
  newly_fired: TripwireChange[];
  cleared: TripwireChange[];
  no_data: number;
  price_refresh_failed: string[];
  summary: string;
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
  ticker_names: Record<string, string>;
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
  snapshot_at?: string | null;
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

// Sprint 13 (2026-09-27) — GET /performance/portfolio
// (backend/app/services/performance/portfolio_performance.py). See its
// module docstring for the reindexing method and its stated approximation.
export interface ExcludedPerformanceHolding {
  ticker: string;
  name: string;
  reason: string;
}

export interface DailyValue {
  on: string;
  portfolio_value_nok: string;
  partial: boolean;
  portfolio_return_pct: string | null;
  daily_pnl_nok: string | null;
  benchmark_return_pct: string | null;
  real_return_pct: string | null;
}

export interface PortfolioPerformance {
  snapshot_at?: string | null;
  as_of: string | null;
  lookback_days: number;
  equity_value_nok: string;
  included_value_nok: string;
  covered_pct: string | null;
  full_coverage_from: string | null;
  starting_value_nok: string | null;
  ending_value_nok: string | null;
  total_return_pct: string | null;
  best_day: DailyValue | null;
  worst_day: DailyValue | null;
  benchmark_ticker: string;
  benchmark_available: boolean;
  benchmark_reason: string | null;
  // Real (CPI-deflated) return overlay (Sprint 15 backlog #2, 2026-09-27) — see
  // backend/app/services/performance/portfolio_performance.py's module docstring.
  real_return_available: boolean;
  real_return_reason: string | null;
  cpi_region: string;
  excluded: ExcludedPerformanceHolding[];
  method_note: string;
  real_return_note: string;
  series: DailyValue[];
}

// Precious metals (2026-09-26) — GET/POST /precious-metals/* (backend/app/api/precious_metals.py).
// Physical 1oz gold/silver coins, valued at gold-api.com spot converted to NOK. Not part of
// PortfolioOverview's equity math (see the backend module's docstring) — its own dashboard card,
// same pattern as Portfolio risk / Performance.
export interface CoinSeries {
  code: string;
  name: string;
  metal: "gold" | "silver";
  country: string;
  weight_oz: string;
}

export interface PreciousMetalHoldingCreateInput {
  coin_series: string;
  quantity: string;
  purchase_date?: string | null;
  purchase_price_nok?: string | null;
  storage_location?: string | null;
  notes?: string | null;
}

export interface PreciousMetalHoldingUpdateInput {
  quantity?: string;
  purchase_date?: string | null;
  purchase_price_nok?: string | null;
  clear_purchase_price?: boolean;
  storage_location?: string | null;
  clear_storage_location?: boolean;
  notes?: string | null;
  clear_notes?: boolean;
}

export interface MetalHoldingRow {
  id: string;
  coin_series: string;
  coin_series_label: string;
  metal: "gold" | "silver";
  quantity: string;
  purchase_date: string | null;
  purchase_price_nok: string | null;
  storage_location: string | null;
  notes: string | null;
  value_nok: string | null;
  unrealized_pnl_nok: string | null;
}

export interface MetalSpot {
  metal: "gold" | "silver";
  available: boolean;
  price_nok_per_oz: string | null;
  price_usd_per_oz: string | null;
  usd_nok_rate: string | null;
  as_of: string | null;
  reason: string | null;
}

export interface PreciousMetalsOverview {
  as_of: string;
  spots: MetalSpot[];
  holdings: MetalHoldingRow[];
  total_value_nok: string;
  total_oz_by_metal: Record<string, string>;
}

export interface MetalPricePoint {
  on: string;
  price_nok: string;
}

export interface MetalPriceHistory {
  metal: string;
  points: MetalPricePoint[];
  method_note: string;
}

// --- Game mode (F33, G1) — backend/app/schemas/game.py
// Decimals arrive as strings, like every other schema here.
export type FortressStructure = "keep" | "outpost" | "bullion" | "granary";
export type FortressSize = "great" | "medium" | "small" | "tiny" | "unknown";
export type FortressMoat = "wide" | "narrow" | "none" | "unsurveyed" | "not_applicable";
export type FortressWall =
  | "basalt"
  | "granite"
  | "brick"
  | "timber"
  | "rotted"
  | "unsurveyed"
  | "not_applicable";
export type FortressFreshness = "fresh" | "weathered" | "overgrown" | "unsurveyed" | "not_applicable";
export type FortressShantytown = "none" | "light" | "heavy";
export type FortressVaultLevel = "deep" | "stocked" | "thin" | "empty" | "unsurveyed";
// G4 (sieges, land for sale, breaches).
export type FortressLand = "bargain" | "discount" | "full_price" | "overpriced" | "fog";
export type FortressThesis = "intact" | "review" | "breached" | "not_analyzed" | "not_applicable";
export type FortressSiegeExposure = "sheltered" | "exposed" | "breach_risk" | "unsurveyed";
export type FortressSiegeLevel = "calm" | "gathering" | "besieged" | "unsurveyed";

export interface GameTower {
  holding_id: string;
  ticker: string;
  name: string;
  instrument_type: string;
  sector: string | null;
  structure: FortressStructure;
  value_nok: string | null;
  weight_pct: string | null;
  size_class: FortressSize;
  moat: FortressMoat;
  wall: FortressWall;
  wall_reason: string;
  wall_inputs: Record<string, string>;
  freshness: FortressFreshness;
  analysis_age_days: number | null;
  verdict_rating: string | null;
  land: FortressLand;
  land_reason: string;
  /** Percent (18.3 = 18.3%), null when the land is fog. */
  margin_of_safety_pct: string | null;
  thesis: FortressThesis;
  tripwires_fired: number;
  siege_exposure: FortressSiegeExposure;
  /** Fraction, negative = a loss in the stored stress scenario (-0.25 = -25%). */
  siege_shock_pct: string | null;
  siege_method: string | null;
  shared_wall_with: string[];
}

export interface GameDiworsification {
  position_count: number;
  shack_count: number;
  shantytown: FortressShantytown;
  hhi: string | null;
  effective_holdings: string | null;
  top1_pct: string | null;
  top5_pct: string | null;
}

/** One account's hand-entered cash (G5). */
export interface GameVaultAccount {
  account_id: string | null;
  name: string;
  cash_nok: string | null;
  cash_as_of: string | null;
  stale: boolean;
}

export interface GameVault {
  level: FortressVaultLevel;
  cash_nok: string | null;
  cash_share_pct: string | null;
  accounts_total: number;
  accounts_with_cash: number;
  cash_oldest_as_of: string | null;
  gold_oz: string;
  silver_oz: string;
  accounts: GameVaultAccount[];
  cash_stale: boolean;
}

export interface GameSharedWall {
  names: string[];
  tickers: string[];
  correlation: string;
  combined_weight_pct: string;
}

export interface GameSiege {
  level: FortressSiegeLevel;
  reasons: string[];
  regime: string | null;
  regime_explanation: string | null;
  /** Fraction, negative = a loss in the stored stress scenario. */
  portfolio_shock_pct: string | null;
  portfolio_drawdown_nok: string | null;
  risk_snapshot_at: string | null;
  risk_snapshot_age_days: number | null;
  risk_snapshot_stale: boolean;
  land_snapshot_at: string | null;
  land_snapshot_age_days: number | null;
  land_snapshot_stale: boolean;
  shared_walls: GameSharedWall[];
  breached_count: number;
}

// --- Game mode G6: temperament meter — backend/app/services/game/temperament.py

export type FortressTemperamentLevel = "composed" | "steady" | "restless" | "rash" | "unsurveyed";

export interface GameTemperamentEvent {
  kind: "drain" | "restore";
  /** Rule id, e.g. "churn", "acted_on_tripwire" (see TEMPERAMENT_RULE_LABEL). */
  rule: string;
  /** ISO date (YYYY-MM-DD). */
  on: string;
  holding_name: string;
  holding_id: string | null;
  explanation: string;
  source: "journal" | "snapshots";
  entry_id: string | null;
}

export interface GameTurnover {
  account_name: string;
  from_at: string;
  to_at: string;
  positions_before: number;
  positions_after: number;
  added: number;
  removed: number;
  resized: number;
  /** 0-100: changed positions as a share of all positions seen in either snapshot. */
  turnover_pct: string | null;
}

export interface GameTemperament {
  level: FortressTemperamentLevel;
  /** 0-100: restoring events as a share of all judged events; null when nothing was judged. */
  needle_pct: string | null;
  low_confidence: boolean;
  decisions_logged: number;
  snapshot_comparisons: number;
  drains: number;
  restores: number;
  window_days: number;
  summary: string;
  events: GameTemperamentEvent[];
  turnover: GameTurnover[];
}

// --- Game mode G7b: advisors — backend/app/services/game/advisors.py

export type GameAdvisorName = "oracle" | "partner";
export type GameAdvisorTone = "warning" | "note" | "calm";

export interface GameAdvisorLine {
  advisor: GameAdvisorName;
  /** Rule id, e.g. "tripwire_fired". */
  rule: string;
  tone: GameAdvisorTone;
  text: string;
  holding_id: string | null;
  holding_name: string | null;
  /** The stored facts the rule was triggered by, so every line can be checked. */
  facts: string[];
}

export interface GameAdvisors {
  lines_version: string;
  lines: GameAdvisorLine[];
  /** Lines that matched a rule but did not fit in the shown set. */
  hidden_count: number;
  disclaimer: string;
}

export interface GameState {
  mapping_version: string;
  as_of: string | null;
  demo: boolean;
  total_value_nok: string;
  towers: GameTower[];
  diworsification: GameDiworsification;
  vault: GameVault;
  siege: GameSiege | null;
  /** G6. Optional so an older backend without the meter still renders. */
  temperament?: GameTemperament | null;
  /** G7b. Optional so an older backend without the advisors still renders. */
  advisors?: GameAdvisors | null;
  notes: string[];
}

// --- G13: Siege Simulator (backend/app/api/game.py GET /game/siege) ----------

export type SiegeSimExposure = "sheltered" | "exposed" | "breach_risk" | "unmodelled";

export interface SiegeSimHolding {
  holding_id: string;
  ticker: string;
  name: string;
  structure: FortressStructure;
  size_class: FortressSize;
  wall: FortressWall;
  value_nok: string | null;
  weight_pct: string | null;
  beta: string | null;
  beta_as_of: string | null;
  modelled: boolean;
  /** Fraction, negative = a loss. */
  shock_pct: string | null;
  loss_nok: string | null;
  exposure: SiegeSimExposure;
  /** The Fortress's own stored stress shock for the same holding. */
  stored_shock_pct: string | null;
  reason: string | null;
}

export interface SiegeSim {
  scenarios_version: string;
  mapping_version: string;
  demo: boolean;
  /** Fractions: 0.30 = a 30% market fall. */
  market_drop: string;
  drop_min: string;
  drop_max: string;
  drop_step: string;
  level: FortressSiegeLevel;
  level_reason: string;
  portfolio_shock_pct: string | null;
  portfolio_loss_nok: string | null;
  covered_value_nok: string;
  total_value_nok: string;
  coverage: string | null;
  weighted_beta: string | null;
  gathering_line: string;
  besieged_line: string;
  drop_to_gathering: string | null;
  drop_to_besieged: string | null;
  reach_note_gathering: string;
  reach_note_besieged: string;
  counts: Record<string, number>;
  oldest_beta_at: string | null;
  holdings: SiegeSimHolding[];
  notes: string[];
}

// --- Sprint 24: Chronicle (G14), Ravens (G15), Night Watch (G16) -------------
// backend/app/api/game.py GET /game/chronicle, /game/ravens, /game/night-watch

export type ChronicleSource = "stored" | "positions_only";
export type ChronicleChangeKind =
  | "tower_added"
  | "tower_removed"
  | "tower_resized"
  | "wall_changed"
  | "moat_changed"
  | "thesis_changed"
  | "weather_changed";

export interface ChronicleTower {
  holding_id: string;
  ticker: string;
  name: string;
  structure: FortressStructure;
  size_class: FortressSize;
  weight_pct: string | null;
  wall: FortressWall;
  moat: FortressMoat;
  land: FortressLand;
  thesis: FortressThesis;
}

export interface ChronicleFrame {
  day: string;
  at: string;
  source: ChronicleSource;
  total_value_nok: string | null;
  weather: FortressSiegeLevel;
  towers: ChronicleTower[];
}

export interface ChronicleChange {
  day: string;
  kind: ChronicleChangeKind;
  holding_id: string | null;
  holding_name: string | null;
  text: string;
}

export interface Chronicle {
  rules_version: string;
  demo: boolean;
  frames: ChronicleFrame[];
  changes: ChronicleChange[];
  stored_frames: number;
  positions_only_frames: number;
  first_stored_day: string | null;
  hidden_frames: number;
  notes: string[];
}

export type RavenDirection = "better" | "worse" | "steady" | "unknown";

export interface RavenLine {
  metric: string;
  label: string;
  previous: string | null;
  current: string | null;
  direction: RavenDirection;
  text: string;
}

export interface Raven {
  id: string;
  kind: "figures" | "text_only";
  holding_id: string;
  ticker: string;
  name: string;
  in_portfolio: boolean;
  period: string | null;
  previous_period: string | null;
  captured_at: string;
  age_days: number;
  document_id: string | null;
  summary: string;
  better: number;
  worse: number;
  lines: RavenLine[];
}

export interface Ravens {
  rules_version: string;
  demo: boolean;
  as_of: string;
  window_days: number;
  ravens: Raven[];
  notes: string[];
}

export type NightWatchState = "ok" | "old" | "never";
export type NightWatchStatus = "attention" | "quiet" | "unknown";

export interface NightWatchLine {
  tone: "warning" | "note" | "calm";
  text: string;
  holding_id: string | null;
  holding_name: string | null;
  facts: string[];
}

export interface NightWatchFired {
  holding_id: string;
  ticker: string;
  name: string;
  label: string | null;
  metric: string;
  fired_at: string;
}

export interface NightWatch {
  rules_version: string;
  demo: boolean;
  as_of: string;
  status: NightWatchStatus;
  headline: string;
  watch_state: NightWatchState;
  watch_last_at: string | null;
  watch_age_hours: number | null;
  watch_summary: string | null;
  tripwires_firing: number;
  fired_overnight: NightWatchFired[];
  snapshots_last_at: string | null;
  snapshots_summary: string | null;
  frames_stored: number;
  last_frame_day: string | null;
  ravens_landed: number;
  changes_since_last_frame: ChronicleChange[];
  lines: NightWatchLine[];
}

// --- Game mode Sprint 25: rituals — backend/app/services/game/rituals.py, competence.py

export interface HoldingAdvisors {
  holding_id: string;
  lines_version: string;
  lines: GameAdvisorLine[];
  disclaimer: string;
}

export type CouncilKind =
  | "tripwire"
  | "thesis_review"
  | "review_due"
  | "weak_walls"
  | "no_moat"
  | "stale_analysis"
  | "outside_circle"
  | "cash";

export interface CouncilHolding {
  holding_id: string | null;
  name: string;
  weight_pct: string | null;
}

export interface CouncilItem {
  kind: CouncilKind;
  tone: "warning" | "note";
  title: string;
  text: string;
  holdings: CouncilHolding[];
  /** Holdings that matched but were not named. */
  more: number;
  facts: string[];
}

export interface Council {
  rules_version: string;
  demo: boolean;
  as_of: string;
  items: CouncilItem[];
  advisors: GameAdvisorLine[];
  unknowns: string[];
  summary: string;
  disclaimer: string;
}

export type RecordReviewState = "written" | "due" | "not_due";

export interface DecisionRecord {
  id: string;
  holding_id: string | null;
  ticker: string;
  company_name: string;
  action: string;
  decided_on: string;
  days_since: number;
  thesis: string;
  invalidation: string | null;
  confidence: number | null;
  verdict_then: string | null;
  verdict_now: string | null;
  price_then: string | null;
  price_now: string | null;
  price_now_at: string | null;
  currency: string | null;
  price_change_pct: string | null;
  price_note: string | null;
  review_6m: RecordReviewState;
  review_12m: RecordReviewState;
  review_6m_text: string | null;
  review_12m_text: string | null;
}

export interface Records {
  rules_version: string;
  demo: boolean;
  records: DecisionRecord[];
  reviews_due: number;
  caption: string;
}

export type CompetenceLevel = "know" | "partly" | "outside";
export type CompetenceStatus = "inside" | "edge" | "outside" | "unmarked" | "unclassified" | "not_applicable";

export interface CompetenceHeld {
  holding_id: string;
  name: string;
  weight_pct: string | null;
}

export interface CompetenceSector {
  sector: string;
  level: CompetenceLevel | null;
  note: string | null;
  marked_at: string | null;
  weight_pct: string;
  holdings: CompetenceHeld[];
}

export interface CompetenceTower {
  holding_id: string;
  name: string;
  sector: string | null;
  weight_pct: string | null;
  status: CompetenceStatus;
}

export interface Competence {
  rules_version: string;
  demo: boolean;
  levels: string[];
  sectors: CompetenceSector[];
  towers: CompetenceTower[];
  inside_weight_pct: string;
  edge_weight_pct: string;
  outside_weight_pct: string;
  unmarked_weight_pct: string;
  unclassified_weight_pct: string;
  summary: string;
  note_max_chars: number;
}


/** Tag review inbox (PR 1, read-only): ESEF inputs the extractor could not
 * fill, the closest tagged lines, and big tagged numbers nothing reads. */
export type TagCheck = "ties" | "plausible" | "does_not_tie" | "no_check";

export interface TagCandidate {
  concept: string;
  prefix: string;
  extension: boolean;
  suggested_scope: "all" | "company";
  value: string;
  unit: string;
  prior_year_value: string | null;
  check: TagCheck;
  check_detail: string;
  warning: string | null;
  score: number;
}

export interface TagGap {
  metric: string;
  fiscal_year: string;
  candidates: TagCandidate[];
}

export interface TagUnused {
  concept: string;
  extension: boolean;
  statement: string;
  value: string;
  unit: string;
  share_of_base: string;
  prior_year_value: string | null;
}

export interface TagReviewHolding {
  holding_id: string;
  ticker: string;
  name: string;
  document_id: string;
  filename: string;
  fiscal_year: string;
  gaps: TagGap[];
  unused: TagUnused[];
  chat_summary: string;
}

export interface TagReview {
  holdings: TagReviewHolding[];
  holdings_needing_review: number;
  total_gaps: number;
}
