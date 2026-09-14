// Mirrors backend/app/schemas/valuation.py (architecture §17, §26 Phase 5).
// Named "dcf" (not "valuation") to avoid colliding with the Phase 2 market
// valuation types in market_valuation.ts.

export type ValuationCritiqueOutput = {
  assumptions_reasonable: boolean;
  reasoning: string;
  key_risks_to_assumptions: string[];
  highest_uncertainty_areas: string[];
  source_references: string[];
};

export type ValuationCaseOut = {
  id: string;
  holding_id: string;
  analysis_run_id: string | null;
  case_type: string; // bull | base | bear
  assumptions: Record<string, unknown>;
  calculated_value: string | null; // Decimal -> JSON string; see market_valuation.ts's note
  currency: string;
  confidence: string;
  calculation_note: string | null;
  critique: ValuationCritiqueOutput | null;
  critique_error: string | null;
  created_at: string;
};

// Mirrors backend/app/schemas/valuation.py's ValuationCaseCreate. holding_id
// is not a field here — it's the path param on
// POST /valuation/holdings/{holding_id}/cases. Every *_pct field is a plain
// percentage-scale number (e.g. 6 means 6%), matching the rest of this
// codebase's *_pct convention (see e.g. PortfolioPosition.weight_pct).
export type ValuationCaseCreate = {
  case_type: string; // bull | base | bear
  revenue_growth_pct: number;
  margin_pct: number;
  capex_pct_of_revenue: number;
  tax_rate_pct: number;
  discount_rate_pct: number;
  terminal_growth_pct: number;
  shares_outstanding: number;
  projection_years?: number;
  commodity_price_multiplier?: number | null;
  fx_rate_to_reporting?: number | null;
  net_debt?: number | null;
  // Overrides the latest reported revenue financial fact as the DCF's
  // starting point. Omit to use the holding's latest "revenue" fact.
  base_revenue_override?: number | null;
  // Currency of calculated_value. Omit to use the revenue fact's own
  // currency, falling back to the holding's trading_currency.
  currency?: string | null;
  analysis_run_id?: string | null;
  // Best-effort LLM critique of the assumptions (§17) — a failure here never
  // blocks the deterministic calculated_value from being persisted.
  run_critique?: boolean;
};
