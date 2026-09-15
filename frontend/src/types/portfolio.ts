export type Holding = {
  id: string;
  ticker: string;
  name: string;
  asset_class: string;
  sector: string | null;
  trading_currency: string;
  // The Yahoo-Finance-resolvable symbol the Phase 2 market-data layer prices
  // this holding by (e.g. "VAR.OL") — distinct from `ticker` above, which is
  // the full instrument name for a Nordnet-imported holding (decision 0003)
  // and can't be priced directly. Null until set via PATCH
  // /portfolio/holdings/{id} — see the "Market data tickers" section of the
  // Portfolio tab.
  market_ticker: string | null;
  // How this holding is held — e.g. "physical", "custodian", "vault" — free
  // text set at creation (manual entry) or via upload. Null when unset.
  custody_type: string | null;
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
  // ISO datetime the position was acquired (manual entry / Whiskybase
  // import "Added on"). Null when not recorded.
  acquired_at: string | null;
};

// Request body for POST /portfolio/holdings/manual — one-off entry of a
// holding with no CSV/XLSX upload (e.g. a single gold or silver coin
// purchase). See backend/app/schemas/portfolio.py's ManualPositionCreate.
export type ManualPositionCreate = {
  ticker: string;
  name: string;
  // Raw string, validated server-side — "COMMODITY" | "COLLECTIBLE" (see
  // backend/app/domain/asset_class.py for the full enum).
  asset_class: string;
  trading_currency: string;
  quantity: string;
  cost_basis?: string | null;
  cost_basis_currency?: string | null;
  // "XAU" or "XAG" routes live pricing through the gold-api.com provider
  // (see backend/app/services/market_data/gold_api.py). Leave unset for
  // collectibles with no live feed — they're valued at cost basis instead.
  market_ticker?: string | null;
  custody_type?: string | null;
  acquired_at?: string | null;
  notes?: string | null;
  account_id?: string | null;
};

// Response of POST /portfolio/holdings/manual — a PortfolioPositionOut,
// same shape as the positions inside a PortfolioSnapshotDetail.
export type ManualPositionResponse = PortfolioPosition;

// Partial-update body for PATCH /portfolio/holdings/manual/{holding_id} —
// corrects a manually-entered coin/collectible after the fact (e.g. a buy
// price stored in the wrong currency because "Holding currency" and "Buy
// price currency" were changed independently). Only include the fields
// you're changing — everything here is optional, and an omitted key is left
// untouched server-side (see backend/app/schemas/portfolio.py's
// ManualPositionUpdate).
export type ManualPositionUpdate = Partial<{
  name: string;
  trading_currency: string;
  quantity: string;
  cost_basis: string | null;
  cost_basis_currency: string | null;
  market_ticker: string | null;
  custody_type: string | null;
  acquired_at: string | null;
  notes: string | null;
  account_id: string | null;
}>;

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
