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
