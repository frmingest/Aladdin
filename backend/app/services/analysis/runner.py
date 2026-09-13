"""
Analysis-run orchestration (architecture §11 recommended flow, §26 Phase 3).

Runs synchronously within the request — a background job queue (APScheduler,
§4) is a natural addition once analysis runs take long enough, or happen
often enough, to want that, but at single-user, on-demand scale a
synchronous call is simpler and the architecture explicitly warns against
premature infrastructure (§2.9, §29). One holding failing (no evidence,
invalid LLM output, provider error) does not fail the whole run — it's
recorded as a failure and excluded from `holding_analyses`, mirroring the
Phase 2 valuation precedent (§21: fail visibly, per-item, not silently or
all-or-nothing).
"""

from dataclasses import dataclass
from datetime import datetime, timezone
from uuid import UUID

from sqlalchemy.orm import Session

from app.config.settings import Settings, get_settings
from app.domain import scoring
from app.models.analysis import AnalysisRun, AnalysisRunStatus, EvidenceReference, FactorAssessment, HoldingAnalysis
from app.models.portfolio import PortfolioSnapshot
from app.models.research import ResearchRunType
from app.providers.base import LLMProvider, LLMUnavailableError
from app.services.analysis.context import InsufficientContextError, build_analysis_context
from app.services.analysis.llm_analysis import run_two_pass_analysis
from app.services.research.common import latest_completed_run

_FACTOR_FIELDS = ("business_quality", "financial_strength", "valuation")


@dataclass
class HoldingAnalysisFailure:
    holding_id: UUID
    reason: str


@dataclass
class AnalysisRunOutcome:
    analysis_run: AnalysisRun
    holding_analyses: list[HoldingAnalysis]
    failures: list[HoldingAnalysisFailure]


def run_analysis(
    db: Session,
    provider: LLMProvider,
    snapshot_id: UUID,
    holding_ids: list[UUID],
    settings: Settings | None = None,
) -> AnalysisRunOutcome:
    settings = settings or get_settings()

    snapshot = db.get(PortfolioSnapshot, snapshot_id)
    if snapshot is None:
        raise ValueError(f"portfolio snapshot '{snapshot_id}' not found")

    # §26 Phase 4: macro conditions apply portfolio-wide, so this points at
    # the one MACRO research_runs row shared by every holding in this
    # analysis run, not a per-holding value — sector research is finer-
    # grained and stays visible per holding via each HoldingAnalysis's own
    # EvidenceReference rows instead (source_type="research_item", §5.2).
    # None until a macro refresh has ever completed (see decision 0007).
    macro_research_run = latest_completed_run(db, ResearchRunType.MACRO)

    run = AnalysisRun(
        portfolio_snapshot_id=snapshot_id,
        status=AnalysisRunStatus.RUNNING.value,
        provider=settings.llm_provider,
        model_name=settings.llm_model_name,
        prompt_version=settings.active_prompt_version,
        scoring_version=settings.active_scoring_version,
        extraction_schema_version=settings.active_extraction_schema_version,
        application_version=settings.application_version,
        research_snapshot_id=macro_research_run.id if macro_research_run else None,
        requested_holding_ids=[str(h) for h in holding_ids],
    )
    db.add(run)
    db.flush()

    holding_analyses: list[HoldingAnalysis] = []
    failures: list[HoldingAnalysisFailure] = []

    for holding_id in holding_ids:
        try:
            context = build_analysis_context(db, holding_id, snapshot_id)
            result = run_two_pass_analysis(provider, context, settings.active_prompt_version)
        except (InsufficientContextError, LLMUnavailableError, ValueError) as exc:
            failures.append(HoldingAnalysisFailure(holding_id=holding_id, reason=str(exc)))
            continue

        factor_scores = {f: getattr(result.output, f).score for f in _FACTOR_FIELDS}
        confidences = [getattr(result.output, f).confidence.value for f in _FACTOR_FIELDS]
        overall_score = scoring.compute_overall_score(factor_scores, settings.active_scoring_version)
        overall_confidence = scoring.aggregate_confidence(confidences, settings.active_scoring_version)

        holding_analysis = HoldingAnalysis(
            analysis_run_id=run.id,
            holding_id=holding_id,
            structured_output_json=result.output.model_dump(mode="json"),
            overall_score=overall_score,
            confidence=overall_confidence,
        )
        db.add(holding_analysis)
        db.flush()

        for factor in _FACTOR_FIELDS:
            assessment = getattr(result.output, factor)
            db.add(
                FactorAssessment(
                    holding_analysis_id=holding_analysis.id,
                    factor=factor,
                    score=assessment.score,
                    confidence=assessment.confidence.value,
                    methodology="llm_qualitative",
                    reasoning=assessment.reasoning,
                )
            )

        evidence_by_id = {item.evidence_id: item for item in context.evidence_items}
        for evidence_id in result.output.source_references:
            item = evidence_by_id.get(evidence_id)
            if item is None:
                # The model cited an evidence_id we never handed it — dropped,
                # not invented a home for (§28 rule 10).
                continue
            db.add(
                EvidenceReference(
                    holding_analysis_id=holding_analysis.id,
                    source_type=item.source_type,
                    source_id=item.source_id,
                    page_start=item.page_start,
                    page_end=item.page_end,
                    section=item.section,
                    relevance="cited",
                )
            )

        holding_analyses.append(holding_analysis)

    run.completed_at = datetime.now(timezone.utc)
    if holding_analyses and not failures:
        run.status = AnalysisRunStatus.COMPLETED.value
    elif holding_analyses and failures:
        run.status = AnalysisRunStatus.PARTIAL.value
    else:
        run.status = AnalysisRunStatus.FAILED.value
        run.error_message = "; ".join(f"{f.holding_id}: {f.reason}" for f in failures) or "no holdings requested"

    db.commit()
    db.refresh(run)

    return AnalysisRunOutcome(analysis_run=run, holding_analyses=holding_analyses, failures=failures)
