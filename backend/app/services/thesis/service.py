"""
Investment thesis ledger CRUD + deterministic invalidation signal
(architecture §16, §26 Phase 5).

`check_invalidation_signal` is the deterministic "has new evidence
strengthened or weakened the thesis" answer §16 asks for, computed by
comparing a thesis's own record against the most recent completed
HoldingAnalysis for the same holding — never a new LLM judgment call, and
never something that mutates the thesis itself (§25 non-goal: "never
automatically alter the user's investment thesis without explicit user
action"). A human decides what to do with the signal via an explicit PATCH.
"""

from dataclasses import dataclass, field
from datetime import datetime, timezone
from decimal import Decimal
from uuid import UUID

from sqlalchemy.orm import Session

from app.models.analysis import AnalysisRun, AnalysisRunStatus, HoldingAnalysis
from app.models.thesis import InvestmentThesis, InvestmentThesisStatus
from app.schemas.thesis import ThesisCreate, ThesisUpdate

_CONCERNING_THESIS_STATUSES = {"weakening", "broken"}


def create_thesis(db: Session, holding_id: UUID, data: ThesisCreate) -> InvestmentThesis:
    thesis = InvestmentThesis(
        holding_id=holding_id,
        thesis=data.thesis,
        bull_case=data.bull_case,
        bear_case=data.bear_case,
        key_assumptions_json=list(data.key_assumptions),
        invalidation_conditions_json=list(data.invalidation_conditions),
        confidence=data.confidence.value,
        status=InvestmentThesisStatus.ACTIVE.value,
    )
    db.add(thesis)
    db.commit()
    db.refresh(thesis)
    return thesis


class UnknownThesisStatusError(Exception):
    def __init__(self, status: str):
        self.status = status
        super().__init__(
            f"unknown thesis status '{status}' — must be one of "
            f"{[s.value for s in InvestmentThesisStatus]}"
        )


def update_thesis(db: Session, thesis: InvestmentThesis, data: ThesisUpdate) -> InvestmentThesis:
    if data.thesis is not None:
        thesis.thesis = data.thesis
    if data.bull_case is not None:
        thesis.bull_case = data.bull_case
    if data.bear_case is not None:
        thesis.bear_case = data.bear_case
    if data.key_assumptions is not None:
        thesis.key_assumptions_json = list(data.key_assumptions)
    if data.invalidation_conditions is not None:
        thesis.invalidation_conditions_json = list(data.invalidation_conditions)
    if data.confidence is not None:
        thesis.confidence = data.confidence.value
    if data.status is not None:
        if data.status not in {s.value for s in InvestmentThesisStatus}:
            raise UnknownThesisStatusError(data.status)
        thesis.status = data.status

    db.commit()
    db.refresh(thesis)
    return thesis


def list_theses_for_holding(db: Session, holding_id: UUID) -> list[InvestmentThesis]:
    """The full ledger for a holding, newest first (§16: "a historical
    thesis ledger" — every past thesis stays queryable, not just the
    current one)."""
    return (
        db.query(InvestmentThesis)
        .filter(InvestmentThesis.holding_id == holding_id)
        .order_by(InvestmentThesis.created_at.desc())
        .all()
    )


def get_active_thesis(db: Session, holding_id: UUID) -> InvestmentThesis | None:
    """The thesis app.services.analysis.context reads as `AnalysisContext.
    user_notes` (replacing the Phase 3 PortfolioPosition.notes stand-in, see
    decision 0008): the most recently updated ACTIVE or UNDER_REVIEW thesis
    for this holding. An INVALIDATED/CLOSED thesis is history, not the
    current read on why the holding is held, so it's excluded here even
    though list_theses_for_holding still returns it."""
    return (
        db.query(InvestmentThesis)
        .filter(
            InvestmentThesis.holding_id == holding_id,
            InvestmentThesis.status.in_(
                [InvestmentThesisStatus.ACTIVE.value, InvestmentThesisStatus.UNDER_REVIEW.value]
            ),
        )
        .order_by(InvestmentThesis.updated_at.desc())
        .first()
    )


def format_thesis_for_context(thesis: InvestmentThesis) -> str:
    """Renders a thesis row into the free-text blob app.services.analysis.
    context hands the LLM as `user_notes` — plain text, since that's what
    the Phase 3 reconciliation prompt already expects (prompts/synthesis/
    v1.md), not a schema/prompt-version change."""
    parts = [f"Thesis: {thesis.thesis}"]
    if thesis.bull_case:
        parts.append(f"Bull case: {thesis.bull_case}")
    if thesis.bear_case:
        parts.append(f"Bear case: {thesis.bear_case}")
    if thesis.key_assumptions_json:
        parts.append("Key assumptions: " + "; ".join(thesis.key_assumptions_json))
    if thesis.invalidation_conditions_json:
        parts.append("Would reconsider this thesis if: " + "; ".join(thesis.invalidation_conditions_json))
    return "\n".join(parts)


@dataclass
class InvalidationSignal:
    thesis_id: UUID
    holding_id: UUID
    checked_at: datetime
    has_signal: bool
    reasons: list[str] = field(default_factory=list)
    latest_analysis_run_id: UUID | None = None
    latest_analysis_completed_at: datetime | None = None
    latest_analysis_thesis_status: str | None = None
    latest_analysis_overall_score: Decimal | None = None
    new_invalidation_triggers: list[str] = field(default_factory=list)


def check_invalidation_signal(db: Session, thesis: InvestmentThesis) -> InvalidationSignal:
    row = (
        db.query(HoldingAnalysis, AnalysisRun)
        .join(AnalysisRun, HoldingAnalysis.analysis_run_id == AnalysisRun.id)
        .filter(
            HoldingAnalysis.holding_id == thesis.holding_id,
            AnalysisRun.status == AnalysisRunStatus.COMPLETED.value,
        )
        .order_by(AnalysisRun.completed_at.desc())
        .first()
    )
    now = datetime.now(timezone.utc)

    if row is None:
        return InvalidationSignal(
            thesis_id=thesis.id,
            holding_id=thesis.holding_id,
            checked_at=now,
            has_signal=False,
            reasons=["no completed analysis run on record for this holding yet"],
        )

    holding_analysis, analysis_run = row
    output = holding_analysis.structured_output_json or {}
    analysis_thesis_status = output.get("thesis_status")
    analysis_invalidation_triggers = list(output.get("invalidation_triggers") or [])

    reasons: list[str] = []
    has_signal = False
    if analysis_thesis_status in _CONCERNING_THESIS_STATUSES:
        reasons.append(f"most recent analysis rates this thesis '{analysis_thesis_status}'")
        has_signal = True
    if analysis_invalidation_triggers:
        reasons.append(
            f"most recent analysis lists {len(analysis_invalidation_triggers)} invalidation trigger(s)"
        )
        has_signal = True
    if not reasons and analysis_run.completed_at and analysis_run.completed_at > thesis.updated_at:
        reasons.append("a newer analysis exists than this thesis's last update — not yet reviewed against it")

    return InvalidationSignal(
        thesis_id=thesis.id,
        holding_id=thesis.holding_id,
        checked_at=now,
        has_signal=has_signal,
        reasons=reasons,
        latest_analysis_run_id=analysis_run.id,
        latest_analysis_completed_at=analysis_run.completed_at,
        latest_analysis_thesis_status=analysis_thesis_status,
        latest_analysis_overall_score=holding_analysis.overall_score,
        new_invalidation_triggers=analysis_invalidation_triggers,
    )
