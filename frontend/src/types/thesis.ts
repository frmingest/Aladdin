// Mirrors backend/app/schemas/thesis.py (architecture §16, §26 Phase 5).

import type { ConfidenceLevel } from "./analysis";

export type ThesisOut = {
  id: string;
  holding_id: string;
  thesis: string;
  bull_case: string | null;
  bear_case: string | null;
  key_assumptions: string[];
  invalidation_conditions: string[];
  confidence: ConfidenceLevel;
  status: string; // ACTIVE | UNDER_REVIEW | INVALIDATED | CLOSED (app.models.thesis.InvestmentThesisStatus)
  created_at: string;
  updated_at: string;
};

// Mirrors backend/app/schemas/thesis.py's ThesisCreate. holding_id is not a
// field here — it's the path param on POST /thesis/holdings/{holding_id}.
export type ThesisCreate = {
  thesis: string;
  bull_case?: string | null;
  bear_case?: string | null;
  key_assumptions?: string[];
  invalidation_conditions?: string[];
  confidence?: ConfidenceLevel;
};

// Mirrors backend/app/schemas/thesis.py's ThesisUpdate — PATCH semantics,
// every field optional, only supplied fields change (status included, since
// this is the only way to move a thesis to UNDER_REVIEW/INVALIDATED/CLOSED).
export type ThesisUpdate = {
  thesis?: string;
  bull_case?: string | null;
  bear_case?: string | null;
  key_assumptions?: string[];
  invalidation_conditions?: string[];
  confidence?: ConfidenceLevel;
  status?: string;
};

export type InvalidationSignalOut = {
  thesis_id: string;
  holding_id: string;
  checked_at: string;
  has_signal: boolean;
  reasons: string[];
  latest_analysis_run_id: string | null;
  latest_analysis_completed_at: string | null;
  latest_analysis_thesis_status: string | null;
  latest_analysis_overall_score: string | null; // Decimal -> JSON string; see market_valuation.ts's note
  new_invalidation_triggers: string[];
};
