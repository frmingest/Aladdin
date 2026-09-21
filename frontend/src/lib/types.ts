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

export interface HoldingCreateInput {
  ticker: string;
  name: string;
  trading_currency: string;
  sector?: string | null;
  institution?: string | null;
  custody_type?: string | null;
}

export interface HoldingUpdateInput {
  name?: string;
  trading_currency?: string;
  sector?: string | null;
  institution?: string | null;
  custody_type?: string | null;
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
  quality_flags: Record<string, boolean>;
  page_count: number;
  fact_count: number;
}

export interface HoldingMetrics {
  holding_id: string;
  period: string;
  facts: Record<string, string>;
  computed: Record<string, string>;
  skipped: Record<string, string>;
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
};
