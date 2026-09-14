export type Holding = {
  id: string;
  ticker: string;
  name: string;
  asset_class: string;
  sector: string | null;
  trading_currency: string;
};

// A real-world custody/brokerage account an upload can be tagged with (§26
// accounts feature) — see backend/app/models/account.py.
export type Account = {
  id: string;
  name: string;
  account_number: string;
  institution: string | null;
  created_at: string;
};

export type AccountCreate = {
  name: string;
  account_number: string;
  institution?: string | null;
};

export type AccountUpdate = Partial<AccountCreate>;

export type PortfolioPosition = {
  holding_id: string;
  ticker: string;
  name: string;
  asset_class: string;
  sector: string | null;
  trading_currency: string;
  // Decimal fields serialize as JSON strings, not numbers (pydantic v2's
  // default Decimal->JSON encoding — confirmed against a live response;
  // see frontend/src/types/market_valuation.ts's note). Parse with Number()
  // or ../lib/num's num() before arithmetic/formatting.
  weight_pct: string | null;
  quantity: string | null;
  cost_basis: string | null;
  cost_basis_currency: string | null;
  notes: string | null;
  account_id: string | null;
  account_name: string | null;
};

export type PortfolioSnapshotSummary = {
  id: string;
  uploaded_at: string;
  source_file_id: string;
  reporting_currency: string;
  status: string;
  position_count: number;
  account_id: string | null;
  account_name: string | null;
};

export type PortfolioSnapshotDetail = PortfolioSnapshotSummary & {
  positions: PortfolioPosition[];
};

export type PortfolioUploadResponse = {
  snapshot: PortfolioSnapshotDetail;
  warnings: string[];
  was_duplicate_file: boolean;
  // Uploads merge onto the previous snapshot by ticker rather than
  // replacing it outright — see backend/app/services/portfolio/ingestion.py.
  new_position_count: number;
  updated_position_count: number;
  carried_forward_position_count: number;
};

export type PortfolioResetResponse = {
  holdings_deleted: number;
  snapshots_deleted: number;
  documents_deleted: number;
};

export type RowError = { row: number; message: string };
