"""
Structured LLM output contract (architecture §12) and the API request/
response schemas built around it (architecture §26 Phase 3).

The pydantic models in the first section are the versioned contract §12
calls for — passed directly as `response_schema` to LLMProvider.
generate_structured (app.providers.base) so the vendor SDK constrains
generation to this shape, and used again on the way back
(`Model.model_validate_json(response.content)`) so a schema-invalid response
fails loudly (§28 rule 10) rather than getting persisted. They are also the
source of truth for schemas/versions/analysis_output_v1.json — see
tests/unit/test_analysis_schema_contract.py, which fails if that checked-in
file drifts from HoldingAnalysisOutput.model_json_schema().
"""

from datetime import datetime
from decimal import Decimal
from enum import Enum
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field

# --- LLM structured-output contract (§12) -----------------------------------


class ConfidenceLevel(str, Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"


class ThesisStatus(str, Enum):
    NEW = "new"  # first analysis on record for this holding
    INTACT = "intact"
    WEAKENING = "weakening"
    BROKEN = "broken"


class FactorAssessmentOutput(BaseModel):
    score: int = Field(ge=1, le=10, description="1 = very poor, 10 = excellent")
    confidence: ConfidenceLevel
    reasoning: str


class ThesisDivergenceOutput(BaseModel):
    blind_assessment_summary: str
    user_thesis_summary: str
    material_disagreement: bool
    disagreement_notes: str


class BlindAnalysisOutput(BaseModel):
    """Pass 1 (§11.3 confirmation-bias guardrail) — produced from the
    evidence packet before the model has seen the user's own notes/thesis."""

    executive_summary: str
    thesis_status: ThesisStatus
    business_quality: FactorAssessmentOutput
    financial_strength: FactorAssessmentOutput
    valuation: FactorAssessmentOutput
    key_strengths: list[str]
    key_risks: list[str]
    new_information: list[str]
    invalidation_triggers: list[str]
    decision_considerations: list[str]
    source_references: list[str] = Field(
        description="evidence_id values (e.g. 'E1') from the packet this assessment materially relies on"
    )
    insufficient_evidence_areas: list[str] = Field(default_factory=list)


class ReconciliationOutput(BaseModel):
    """Pass 2 (§11.3) — compares Pass 1's blind assessment against the
    user's own notes. Deliberately does not repeat/replace the factor
    scores: reconciliation is comparison, not re-scoring."""

    thesis_divergence: ThesisDivergenceOutput
    additional_risks: list[str] = Field(default_factory=list)
    additional_considerations: list[str] = Field(default_factory=list)
    source_references: list[str] = Field(default_factory=list)


class HoldingAnalysisOutput(BaseModel):
    """The final structured_output_json persisted on HoldingAnalysis — Pass
    1's independent judgment plus Pass 2's reconciliation, merged by
    app.services.analysis.llm_analysis. This is the illustrative §12 shape,
    simplified: one `source_references` list (evidence_ids cited) stands in
    for §12's separate supporting/contradicting-evidence arrays — see
    docs/decisions/0006 for the reasoning."""

    executive_summary: str
    thesis_status: ThesisStatus
    business_quality: FactorAssessmentOutput
    financial_strength: FactorAssessmentOutput
    valuation: FactorAssessmentOutput
    key_strengths: list[str]
    key_risks: list[str]
    new_information: list[str]
    thesis_divergence: ThesisDivergenceOutput
    invalidation_triggers: list[str]
    decision_considerations: list[str]
    source_references: list[str]
    insufficient_evidence_areas: list[str]


# --- API request/response schemas -------------------------------------------


class AnalysisRunRequest(BaseModel):
    holding_ids: list[UUID] | None = Field(
        default=None,
        description="Analyze only these holdings. Omit to analyze every holding in the "
        "snapshot that has at least one document or financial fact.",
    )


class FactorAssessmentOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    factor: str
    score: int
    confidence: str
    methodology: str
    reasoning: str


class EvidenceReferenceOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    source_type: str
    source_id: str
    page_start: int | None
    page_end: int | None
    section: str | None
    relevance: str


class HoldingAnalysisSummary(BaseModel):
    id: UUID
    holding_id: UUID
    ticker: str
    name: str
    overall_score: Decimal | None
    confidence: str
    thesis_status: str


class HoldingAnalysisDetail(BaseModel):
    id: UUID
    analysis_run_id: UUID
    holding_id: UUID
    ticker: str
    name: str
    overall_score: Decimal | None
    confidence: str
    structured_output: HoldingAnalysisOutput
    factor_assessments: list[FactorAssessmentOut]
    evidence_references: list[EvidenceReferenceOut]
    created_at: datetime


class AnalysisRunFailureOut(BaseModel):
    holding_id: UUID
    reason: str


class AnalysisRunSummary(BaseModel):
    id: UUID
    portfolio_snapshot_id: UUID
    status: str
    started_at: datetime
    completed_at: datetime | None
    provider: str
    model_name: str
    prompt_version: str
    scoring_version: str
    # ECON-002 fix (docs/decisions/0014, §13.1) — which named factor-weight
    # profile was used for every holding in this run (app.domain.scoring).
    macro_regime: str
    holding_analysis_count: int
    failure_count: int


class AnalysisRunDetail(AnalysisRunSummary):
    holding_analyses: list[HoldingAnalysisSummary]
    failures: list[AnalysisRunFailureOut]
    error_message: str | None
