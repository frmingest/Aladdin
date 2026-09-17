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

Daily-budget guard (2026-09-16, Faiz's "many stored PDF documents" report):
the free tier's binding constraint isn't the per-minute rate app.providers.
gemini_retry already paces against — with `gemini-3.6-flash` it's
`settings.llm_rate_limit_rpd`, 20 requests/day (ADR 0013), an order of
magnitude tighter. Before this, a run requesting more holdings than the
day's remaining budget would burn through gemini_retry's exponential
backoff for every single one of them, each attempt guaranteed to 429,
before finally recording the same "provider unavailable" failure a plain
budget check could have produced instantly. `calls_remaining_today` below
is seeded once from app.services.usage.get_usage_summary (the same ledger
the `/usage/summary` endpoint reads, §2.7 "compute once, reuse") and then
tracked locally for the rest of this run: a holding whose blind pass (plus
reconciliation pass, when it has notes/thesis to reconcile against) would
exceed what's left is skipped with a clear reason instead of attempted.

Fallback provider (2026-09-17, Faiz asked to investigate free alternatives —
see claude/llm-provider-alternatives-2026-09-17.md): once the daily budget
above is exhausted, a holding is only skipped outright when no
`fallback_provider` was passed in (app.providers.factory.
get_llm_fallback_provider, settings.llm_fallback_provider == "none", the
default). When one is configured (currently only "mistral"), that holding
gets a real two-pass analysis from the fallback instead — Gemini's own
budget is untouched by this (it was never going to be spent on this holding
either way), and the fallback's own usage is still recorded to
llm_usage_events under its own provider name (see _record_analysis_usage),
so the ledger stays an honest record of which provider actually served each
holding even though `AnalysisRun.provider` records only the run's
configured *primary* provider (§10/§28 rule 9 reproducibility field — a
single run-level column can't hold a per-holding mix, so the per-call ledger
is the source of truth for "who actually answered this one").
"""

from dataclasses import dataclass
from datetime import datetime, timezone
from uuid import UUID

from sqlalchemy.orm import Session

from app.config.settings import Settings, get_settings
from app.domain import scoring
from app.models.analysis import (
    AnalysisRun,
    AnalysisRunStatus,
    EvidenceReference,
    FactorAssessment,
    HoldingAnalysis,
)
from app.models.llm_usage import LLMCallType
from app.models.portfolio import PortfolioSnapshot
from app.models.research import ResearchRunType
from app.providers.base import LLMProvider, LLMUnavailableError
from app.services.analysis.context import (
    InsufficientContextError,
    build_analysis_context,
)
from app.services.analysis.llm_analysis import LLMAnalysisResult, run_two_pass_analysis
from app.services.research.common import latest_completed_run
from app.services.research.macro import get_latest_macro_snapshot
from app.services.usage import get_usage_summary, record_llm_usage

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
    fallback_provider: LLMProvider | None = None,
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

    # ECON-002 fix (docs/decisions/0014, §13.1): classify the macro regime
    # once per run (it applies portfolio-wide, same reasoning as
    # macro_research_run above) from whatever macro observations are
    # currently on record — no provider call, §2.7 — and use it for every
    # holding's factor-weight blend below. Falls back to "baseline" (v1's
    # only behavior) if no macro refresh has ever completed, or if
    # scoring_version defines no regime_classification at all.
    macro_snapshot = get_latest_macro_snapshot(db)
    latest_macro_values = {obs.series_key: obs.value for obs in macro_snapshot.observations}
    macro_regime = scoring.classify_macro_regime(latest_macro_values, settings.active_scoring_version)

    run = AnalysisRun(
        portfolio_snapshot_id=snapshot_id,
        status=AnalysisRunStatus.RUNNING.value,
        provider=settings.llm_provider,
        model_name=settings.llm_model_name,
        prompt_version=settings.active_prompt_version,
        scoring_version=settings.active_scoring_version,
        macro_regime=macro_regime,
        extraction_schema_version=settings.active_extraction_schema_version,
        application_version=settings.application_version,
        research_snapshot_id=macro_research_run.id if macro_research_run else None,
        requested_holding_ids=[str(h) for h in holding_ids],
    )
    db.add(run)
    db.flush()

    holding_analyses: list[HoldingAnalysis] = []
    failures: list[HoldingAnalysisFailure] = []

    # Seeded once per run from today's already-committed ledger rows, then
    # tracked locally below — see this module's docstring. A fresh query per
    # holding isn't needed: this process is the only writer of usage rows for
    # a synchronous, single-user run (§2.9), so the local counter stays exact.
    usage_summary = get_usage_summary(db, settings)
    calls_remaining_today = max(settings.llm_rate_limit_rpd - usage_summary.today.requests, 0)

    for holding_id in holding_ids:
        try:
            context = build_analysis_context(db, holding_id, snapshot_id)
        except (InsufficientContextError, ValueError) as exc:
            failures.append(HoldingAnalysisFailure(holding_id=holding_id, reason=str(exc)))
            continue

        # Reconciliation only runs when this holding already has notes/thesis
        # to reconcile against (app.services.analysis.llm_analysis) — known
        # from context alone, no provider call needed to find out.
        planned_calls = 2 if (context.user_notes and context.user_notes.strip()) else 1
        use_primary = calls_remaining_today >= planned_calls

        if not use_primary and fallback_provider is None:
            failures.append(
                HoldingAnalysisFailure(holding_id=holding_id, reason=_daily_budget_exhausted_reason(settings))
            )
            continue

        if use_primary:
            active_provider: LLMProvider = provider
        else:
            # Guaranteed non-None: the `not use_primary and fallback_provider
            # is None` branch above already skipped/continued otherwise.
            assert fallback_provider is not None
            active_provider = fallback_provider
        active_provider_name = settings.llm_provider if use_primary else settings.llm_fallback_provider

        try:
            result = run_two_pass_analysis(active_provider, context, settings.active_prompt_version)
        except (LLMUnavailableError, ValueError) as exc:
            if use_primary:
                # The Gemini call(s) still happened — and still cost real
                # quota — even though the analysis itself failed (same gap
                # ADR 0013's Consequences already flagged for the usage
                # ledger). Assume the worst case (planned_calls) rather than
                # under-counting and letting the next holding retry into a
                # guaranteed 429 (§21: fail visibly, don't paper over).
                calls_remaining_today = max(calls_remaining_today - planned_calls, 0)
                failures.append(HoldingAnalysisFailure(holding_id=holding_id, reason=str(exc)))
            else:
                # The fallback itself failed — say so plainly, and name both
                # the exhausted primary budget and the fallback failure
                # rather than just the latter, so this doesn't read like a
                # generic outage (§21: fail visibly, name the real cause).
                failures.append(
                    HoldingAnalysisFailure(
                        holding_id=holding_id,
                        reason=(
                            f"{_daily_budget_exhausted_reason(settings)} Fallback provider "
                            f"'{active_provider_name}' also failed: {exc}"
                        ),
                    )
                )
            continue

        if use_primary:
            calls_remaining_today -= 2 if result.reconciliation_ran else 1

        factor_scores = {f: getattr(result.output, f).score for f in _FACTOR_FIELDS}
        confidences = [getattr(result.output, f).confidence.value for f in _FACTOR_FIELDS]
        overall_score = scoring.compute_overall_score(factor_scores, settings.active_scoring_version, regime=macro_regime)
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

        _record_analysis_usage(db, active_provider_name, run.id, holding_id, holding_analysis.id, result)

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


def _daily_budget_exhausted_reason(settings: Settings) -> str:
    """§21 fail visibly: names the actual constraint (the free tier's
    requests-per-day cap, not a generic "provider unavailable") and when it
    resets, so this reads differently in the UI than a transient Gemini
    outage would."""
    return (
        f"skipped — today's Gemini free-tier request budget is exhausted "
        f"({settings.llm_rate_limit_rpd} requests/day for {settings.llm_model_name}); "
        "resets at UTC midnight. Re-run this holding after the reset, spread a large "
        "batch across multiple days, or raise llm_rate_limit_rpd once on a paid tier."
    )


def _record_analysis_usage(
    db: Session,
    provider_name: str,
    analysis_run_id: UUID,
    holding_id: UUID,
    holding_analysis_id: UUID,
    result: LLMAnalysisResult,
) -> None:
    """One llm_usage_events row per call `result` actually represents (§28
    observability follow-up, ADR 0013) — added to `db` alongside the rest of
    this holding's rows, committed together with them by the caller, never a
    separate transaction. `provider_name` is whichever provider actually
    served this holding (settings.llm_provider, or settings.
    llm_fallback_provider once the 2026-09-17 fallback path is taken — see
    this module's docstring) — the ledger's per-row provider is always the
    real one, independent of AnalysisRun.provider's single run-level value."""
    record_llm_usage(
        db,
        provider=provider_name,
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
            provider=provider_name,
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
