// Mirrors backend/app/schemas/analysis.py (architecture §12, §26 Phase 3).

export type ConfidenceLevel = "low" | "medium" | "high";
export type ThesisStatus = "new" | "intact" | "weakening" | "broken";

export type FactorAssessmentOutput = {
  score: number;
  confidence: ConfidenceLevel;
  reasoning: string;
};

export type ThesisDivergenceOutput = {
  blind_assessment_summary: string;
  user_thesis_summary: string;
  material_disagreement: boolean;
  disagreement_notes: string;
};

export type HoldingAnalysisOutput = {
  executive_summary: string;
  thesis_status: ThesisStatus;
  business_quality: FactorAssessmentOutput;
  financial_strength: FactorAssessmentOutput;
  valuation: FactorAssessmentOutput;
  key_strengths: string[];
  key_risks: string[];
  new_information: string[];
  thesis_divergence: ThesisDivergenceOutput;
  invalidation_triggers: string[];
  decision_considerations: string[];
  source_references: string[];
  insufficient_evidence_areas: string[];
};

export type FactorAssessmentOut = {
  factor: string;
  score: number;
  confidence: string;
  methodology: string;
  reasoning: string;
};

export type EvidenceReferenceOut = {
  source_type: string;
  source_id: string;
  page_start: number | null;
  page_end: number | null;
  section: string | null;
  relevance: string;
};

export type HoldingAnalysisSummary = {
  id: string;
  holding_id: string;
  ticker: string;
  name: string;
  overall_score: string | null; // Decimal -> JSON string; see types/market_valuation.ts's note
  confidence: string;
  thesis_status: string;
};

export type HoldingAnalysisDetail = {
  id: string;
  analysis_run_id: string;
  holding_id: string;
  ticker: string;
  name: string;
  overall_score: string | null; // Decimal -> JSON string; see types/market_valuation.ts's note
  confidence: string;
  structured_output: HoldingAnalysisOutput;
  factor_assessments: FactorAssessmentOut[];
  evidence_references: EvidenceReferenceOut[];
  created_at: string;
};

export type AnalysisRunFailureOut = { holding_id: string; reason: string };

export type AnalysisRunSummary = {
  id: string;
  portfolio_snapshot_id: string;
  status: "QUEUED" | "RUNNING" | "COMPLETED" | "PARTIAL" | "FAILED";
  started_at: string;
  completed_at: string | null;
  provider: string;
  model_name: string;
  prompt_version: string;
  scoring_version: string;
  holding_analysis_count: number;
  failure_count: number;
};

export type AnalysisRunDetail = AnalysisRunSummary & {
  holding_analyses: HoldingAnalysisSummary[];
  failures: AnalysisRunFailureOut[];
  error_message: string | null;
};
