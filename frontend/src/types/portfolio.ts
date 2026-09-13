export type Holding = {
  id: string;
  ticker: string;
  name: string;
  asset_class: string;
  sector: string | null;
  trading_currency: string;
};

export type PortfolioPosition = {
  holding_id: string;
  ticker: string;
  name: string;
  asset_class: string;
  sector: string | null;
  trading_currency: string;
  weight_pct: number | null;
  quantity: number | null;
  cost_basis: number | null;
  cost_basis_currency: string | null;
  notes: string | null;
};

export type PortfolioSnapshotSummary = {
  id: string;
  uploaded_at: string;
  source_file_id: string;
  reporting_currency: string;
  status: string;
  position_count: number;
};

export type PortfolioSnapshotDetail = PortfolioSnapshotSummary & {
  positions: PortfolioPosition[];
};

export type PortfolioUploadResponse = {
  snapshot: PortfolioSnapshotDetail;
  warnings: string[];
  was_duplicate_file: boolean;
};

export type RowError = { row: number; message: string };
