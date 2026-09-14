// Mirrors backend/app/schemas/market_data.py (architecture §8, §26 Phase 2).
//
// Every Decimal field here serializes as a JSON STRING, not a JSON number —
// confirmed against a real response (pydantic v2's default Decimal->JSON
// encoding), not just this codebase's risk-snapshot JSON columns (see
// portfolio_risk.ts's module docstring for that case). Use `num()` from
// ../lib/num before formatting or charting any of these.

export type HoldingValuationOut = {
  holding_id: string;
  ticker: string;
  name: string;
  asset_class: string;
  sector: string | null;
  trading_currency: string;
  market_ticker: string | null;
  quantity: string | null;
  uploaded_weight_pct: string | null;

  price: string | null;
  price_currency: string | null;
  price_observed_at: string | null;
  price_status: string;

  market_value_trading_ccy: string | null;
  fx_rate_to_reporting: string | null;
  market_value_reporting_ccy: string | null;

  cost_basis_value_reporting_ccy: string | null;
  unrealized_pnl: string | null;
  unrealized_pnl_pct: string | null;

  computed_weight_pct: string | null;
  data_warning: string | null;
};

export type ConcentrationProfileOut = {
  single_name_hhi: string | null;
  largest_single_name_pct: string | null;
  single_name_weights: Record<string, string>;
  sector_hhi: string | null;
  sector_weights: Record<string, string>;
  currency_weights: Record<string, string>;
  asset_class_weights: Record<string, string>;
  holdings_excluded_from_concentration: string[];
};

export type PortfolioValuationOut = {
  snapshot_id: string;
  reporting_currency: string;
  total_market_value: string;
  total_cost_basis_value: string | null;
  total_unrealized_pnl: string | null;
  holdings: HoldingValuationOut[];
  concentration: ConcentrationProfileOut;
  warnings: string[];
  // null = every account (no filter applied). The account_id filter this
  // valuation was actually computed against (§26 accounts feature dashboard
  // filter).
  account_ids: string[] | null;
};
