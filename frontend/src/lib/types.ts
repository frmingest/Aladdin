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
  created_at: string;
  updated_at: string;
  document_count: number;
  position_count: number;
}

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
