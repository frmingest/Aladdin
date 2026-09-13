"""Investment thesis ledger API schemas (architecture §16, §26 Phase 5)."""

from datetime import datetime
from decimal import Decimal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field

from app.schemas.analysis import ConfidenceLevel


class ThesisCreate(BaseModel):
    thesis: str
    bull_case: str | None = None
    bear_case: str | None = None
    key_assumptions: list[str] = Field(default_factory=list)
    invalidation_conditions: list[str] = Field(default_factory=list)
    confidence: ConfidenceLevel = ConfidenceLevel.MEDIUM


class ThesisUpdate(BaseModel):
    """All fields optional — PATCH semantics, only supplied fields change."""

    thesis: str | None = None
    bull_case: str | None = None
    bear_case: str | None = None
    key_assumptions: list[str] | None = None
    invalidation_conditions: list[str] | None = None
    confidence: ConfidenceLevel | None = None
    status: str | None = None  # app.models.thesis.InvestmentThesisStatus


class ThesisOut(BaseModel):
    """Built explicitly by app.api.thesis (not `model_validate(obj,
    from_attributes=True)`) since the ORM column names
    (key_assumptions_json/invalidation_conditions_json) intentionally differ
    from this schema's field names — matching the rest of this codebase's
    convention of a small `_thesis_to_out` mapper (see app.api.portfolio's
    `_position_to_out`) rather than relying on alias-based ORM validation."""

    model_config = ConfigDict(from_attributes=False)

    id: UUID
    holding_id: UUID
    thesis: str
    bull_case: str | None
    bear_case: str | None
    key_assumptions: list[str]
    invalidation_conditions: list[str]
    confidence: str
    status: str
    created_at: datetime
    updated_at: datetime


class InvalidationSignalOut(BaseModel):
    """A deterministic, read-only comparison of a thesis's own record
    against the most recent completed HoldingAnalysis for the same holding
    (app.services.thesis.service.check_invalidation_signal). Informational
    only — nothing here ever mutates the thesis itself (§25 non-goal: never
    automatically alter the user's thesis without explicit user action)."""

    thesis_id: UUID
    holding_id: UUID
    checked_at: datetime
    has_signal: bool
    reasons: list[str]
    latest_analysis_run_id: UUID | None
    latest_analysis_completed_at: datetime | None
    latest_analysis_thesis_status: str | None
    latest_analysis_overall_score: Decimal | None
    new_invalidation_triggers: list[str]
