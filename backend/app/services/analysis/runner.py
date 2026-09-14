"""Analysis-run orchestration (architecture §11 recommended flow, §26 Phase 3).

Runs synchronously within the request — a background job queue (APScheduler,
§4) is a natural addition once analysis runs take long enough, or happen
often enough, to want that, but at single-user, on-demand scale a
synchronous call is simpler and the architecture explicitly warns against
premature infrastructure (§2.9, §29). One holding failing (no evidence,
invalid LLM output, provider error) does not fail the whole run — it's
recorded as a failure and excluded from `holding_analyses`, mirroring the
Phase 2 valuation precedent (§21: fail visibly, per-item, not silently or
all-or-nothing).

Also records one (or two) llm_usage_events rows per successfully-analyzed
holding — §28 observability follow-up, docs/decisions/0013: this is exactly
the "computed per analysis run, never persisted" gap the Phase 8 status
review flagged, since result.total_input_tokens/total_output_tokens used to
be computed by app.services.analysis.llm_analysis and then simply discarded
here. A failed holding records no usage row even though the call happened
and cost tokens — LLMUnavailableError's own message is the only trace of
that today (a real gap, but a pre-existing one this pass doesn't attempt to
close — see ADR 0013's Consequences).
"""

from dataclasses import dataclass
from datetime import datetime, timezone
from uuid import UUID

from sqlalchemy.orm import Session

from app.config.settings import Settings, get_settings
from app.domain import scoring
from app.models.analysis import AnalysisRun, AnalysisRunStatus, EvidenceReference, FactorAssessment, HoldingAnalysis
from app.models.llm_usage import LLMCallType
from app.models.portfolio import PortfolioSnapshot
from app.models.research import ResearchRunType
from app.providers.base import LLMProvider, LLMUnavailableError
from app.services.analysis.context import InsufficientContextError, build_analysis_context
from app.services.analysis.llm_analysis import LLMAnalysisResult, run_two_pass_analysis
from app.services.research.common import latest_completed_run
from app.services.usage import record_llm_usage

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

        _record_analysis_usage(db, settings, run.id, holding_id, holding_analysis.id, result)

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


def _record_analysis_usage(
    db: Session,
    settings: Settings,
    analysis_run_id: UUID,
    holding_id: UUID,
    holding_analysis_id: UUID,
    result: LLMAnalysisResult,
) -> None:
    """One llm_usage_events row per Gemini call `result` actually represents
    (§28 observability follow-up, ADR 0013) — added to `db` alongside the
    rest of this holding's rows, committed together with them by the caller,
    never a separate transaction."""
    record_llm_usage(
        db,
        provider=settings.llm_provider,
        model_name=result.model_name,
        call_type=LLMCallType.ANALYSIS_BLIND,
        input_tokens=result.blind_input_tokens,
        output_tokens=result.blind_output_tokens,
        latency_ms=result.blind_latency_ms,
        prompt_version=f"persona/{result.prompt_version}",
        holding_id=holding_id,
        analysis_run_id=analysis_run_id,
        holding_analysis_id=holding_analysis_id,
    )
    if result.reconciliation_ran:
        record_llm_usage(
            db,
            provider=settings.llm_provider,
            model_name=result.model_name,
            call_type=LLMCallType.ANALYSIS_RECONCILIATION,
            input_tokens=result.reconciliation_input_tokens,
            output_tokens=result.reconciliation_output_tokens,
            latency_ms=result.reconciliation_latency_ms,
            prompt_version=f"synthesis/{result.prompt_version}",
            holding_id=holding_id,
            analysis_run_id=analysis_run_id,
            holding_analysis_id=holding_analysis_id,
        )
