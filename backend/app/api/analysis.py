"""Sprint 4 — the Buffett/Munger analysis engine's endpoints
(claude/buffett-munger-rebuild-sprint-plan-2026-09-21.md).

Unlike GET /research/* or GET /valuation/*, there's no "serve cached,
refresh if stale" shape here: an analysis run is a real, explicit,
LLM-cost-bearing operation, so POST .../run always executes the full
two-pass pipeline fresh and GET always just serves whatever the latest
stored run already is (including a FAILED one — fail visibly, CLAUDE.md).

Notes are a separate small resource, read only by the reconciliation pass
(CLAUDE.md Rule 4) — GET/PUT here never touch the blind pass.
"""
from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config.database import get_db
from app.config.settings import get_settings
from app.domain.analysis_schema import get_blind_pass_schema, get_reconciliation_schema
from app.models.analysis import (
    PENDING_RUN_STATUSES,
    EquityAnalysisRun,
    EquityAnalysisRunStatus,
)
from app.models.holding import Holding
from app.providers.base import (
    LLMProvider,
    MarketDataProvider,
    ResearchProvider,
    RiskFreeRateProvider,
)
from app.providers.budget import DailyBudgetGuard
from app.providers.factory import (
    get_announcements_provider_or_none,
    get_llm_fallback_provider,
    get_llm_provider,
    get_macro_data_provider_or_none,
    get_market_data_provider,
    get_primary_budget_guard,
    get_research_provider,
    get_risk_free_rate_provider,
)
from app.providers.macro_data_providers import MacroDataProvider
from app.providers.newsweb_provider import NewswebAnnouncementsProvider
from app.schemas.analysis import (
    AnalysisQueueOut,
    AnalysisReadinessCheckOut,
    AnalysisReadinessOut,
    AnalysisWorkerOut,
    EquityAnalysisRunOut,
    EquityHoldingNoteIn,
    EquityHoldingNoteOut,
    EvidenceItemOut,
    QueuedRunOut,
    QueueReadyHoldingsOut,
    QueueSkippedOut,
)
from app.services.analysis import queue as analysis_queue
from app.services.analysis.latest import run_ratings
from app.services.analysis.notes import get_holding_note, set_holding_note
from app.services.analysis.pipeline import NotEquityAnalyzableError, run_full_analysis
from app.services.analysis.readiness import check_analysis_readiness
from app.services.settings.demo_guard import require_not_demo
from app.services.settings.demo_mode import is_demo_mode
from app.services.settings.synthetic_data import (
    demo_analysis_note,
    demo_analysis_queue,
    demo_analysis_readiness,
    demo_analysis_run,
)

router = APIRouter(prefix="/analysis", tags=["analysis"])


def _get_holding_or_404(db: Session, holding_id: UUID) -> Holding:
    holding = db.get(Holding, holding_id)
    if holding is None:
        raise HTTPException(status_code=404, detail="holding not found")
    return holding


# Queued / running (local worker) and cancelled runs aren't "the latest
# analysis": showing them would hide the holding's previous verdict while a
# new run waits on the PC. They're served by GET /analysis/queue instead.
_NOT_A_RESULT = (*PENDING_RUN_STATUSES, EquityAnalysisRunStatus.CANCELLED.value)


def _latest_run(db: Session, holding_id: UUID) -> EquityAnalysisRun | None:
    stmt = (
        select(EquityAnalysisRun)
        .where(EquityAnalysisRun.holding_id == holding_id, EquityAnalysisRun.status.notin_(_NOT_A_RESULT))
        .order_by(EquityAnalysisRun.started_at.desc())
        .limit(1)
    )
    return db.scalar(stmt)


def _to_out(run: EquityAnalysisRun) -> EquityAnalysisRunOut:
    return EquityAnalysisRunOut(
        id=run.id,
        holding_id=run.holding_id,
        status=run.status,
        schema_version=run.schema_version,
        blind_prompt_version=run.blind_prompt_version,
        reconciliation_prompt_version=run.reconciliation_prompt_version,
        evidence_packet_version=run.evidence_packet_version,
        provider=run.provider,
        model_name=run.model_name,
        started_at=run.started_at,
        blind_completed_at=run.blind_completed_at,
        completed_at=run.completed_at,
        error_message=run.error_message,
        evidence_unavailable_reasons=run.evidence_unavailable_reasons or [],
        blind_pass=(
            get_blind_pass_schema(run.schema_version).model_validate(run.blind_pass_json)
            if run.blind_pass_json
            else None
        ),
        blind_pass_citation_warnings=run.blind_pass_citation_warnings,
        reconciliation=(
            get_reconciliation_schema(run.schema_version).model_validate(run.reconciliation_json)
            if run.reconciliation_json
            else None
        ),
        reconciliation_citation_warnings=run.reconciliation_citation_warnings,
        price_target_low=run.price_target_low,
        price_target_high=run.price_target_high,
        price_target_currency=run.price_target_currency,
        evidence_items=_evidence_items(run),
        user_notes_snapshot=run.user_notes_snapshot,
        engine=run.engine or "cloud",
        queued_at=run.queued_at,
        claimed_by=run.claimed_by,
        attempts=run.attempts or 0,
    )


def _queued_out(db: Session, run: EquityAnalysisRun) -> QueuedRunOut:
    holding = db.get(Holding, run.holding_id)
    verdict = run_ratings(run)[0] if run.blind_pass_json else None
    return QueuedRunOut(
        id=run.id,
        holding_id=run.holding_id,
        ticker=holding.ticker if holding else None,
        holding_name=holding.name if holding else None,
        status=run.status,
        engine=run.engine or "cloud",
        queued_at=run.queued_at,
        claimed_by=run.claimed_by,
        claimed_at=run.claimed_at,
        started_at=run.started_at,
        completed_at=run.completed_at,
        attempts=run.attempts or 0,
        error_message=run.error_message,
        provider=run.provider,
        model_name=run.model_name,
        verdict=verdict,
    )


def _evidence_items(run: EquityAnalysisRun) -> list[EvidenceItemOut]:
    packet = run.evidence_packet_json or {}
    items: list[EvidenceItemOut] = []
    for raw in packet.get("items") or []:
        try:
            items.append(EvidenceItemOut.model_validate(raw))
        except ValueError:
            continue  # a malformed stored item must not take the whole run off the page
    return items


@router.get("/holdings/{holding_id}", response_model=EquityAnalysisRunOut)
def get_latest_analysis(holding_id: UUID, db: Session = Depends(get_db)) -> EquityAnalysisRunOut:
    if is_demo_mode(db):
        demo = demo_analysis_run(holding_id)
        if demo is None:
            raise HTTPException(status_code=404, detail="no analysis run yet for this holding")
        return demo
    holding = _get_holding_or_404(db, holding_id)
    run = _latest_run(db, holding.id)
    if run is None:
        raise HTTPException(status_code=404, detail="no analysis run yet for this holding")
    return _to_out(run)


@router.get("/holdings/{holding_id}/readiness", response_model=AnalysisReadinessOut)
def get_readiness(
    holding_id: UUID,
    db: Session = Depends(get_db),
    budget_guard: DailyBudgetGuard = Depends(get_primary_budget_guard),
) -> AnalysisReadinessOut:
    """Feature F2: what a run on this holding would cost and whether it's
    worth it — without spending anything. Deliberately depends on no live
    provider (those factories raise on a misconfigured provider name,
    which is exactly what this endpoint must be able to report)."""
    if is_demo_mode(db):
        demo = demo_analysis_readiness(holding_id)
        if demo is None:
            raise HTTPException(status_code=404, detail="holding not found")
        return demo
    holding = _get_holding_or_404(db, holding_id)
    report = check_analysis_readiness(
        db, holding, settings=get_settings(), budget_guard=budget_guard
    )
    return AnalysisReadinessOut(
        holding_id=report.holding_id,
        ready=report.ready,
        blockers=report.blockers,
        warnings=report.warnings,
        estimated_gemini_calls=report.estimated_gemini_calls,
        gemini_calls_remaining_today=report.gemini_calls_remaining_today,
        checks=[
            AnalysisReadinessCheckOut(key=c.key, label=c.label, status=c.status, detail=c.detail)
            for c in report.checks
        ],
    )


@router.post("/holdings/{holding_id}/run", response_model=EquityAnalysisRunOut, status_code=201)
def run_analysis(
    holding_id: UUID,
    db: Session = Depends(get_db),
    llm_provider: LLMProvider = Depends(get_llm_provider),
    llm_fallback_provider: LLMProvider | None = Depends(get_llm_fallback_provider),
    market_data_provider: MarketDataProvider = Depends(get_market_data_provider),
    risk_free_rate_provider: RiskFreeRateProvider = Depends(get_risk_free_rate_provider),
    research_provider: ResearchProvider = Depends(get_research_provider),
    announcements_provider: NewswebAnnouncementsProvider | None = Depends(
        get_announcements_provider_or_none
    ),
    macro_data_provider: MacroDataProvider | None = Depends(get_macro_data_provider_or_none),
) -> EquityAnalysisRunOut:
    require_not_demo(db)
    holding = _get_holding_or_404(db, holding_id)
    try:
        run = run_full_analysis(
            db,
            holding,
            llm_provider=llm_provider,
            llm_fallback_provider=llm_fallback_provider,
            market_data_provider=market_data_provider,
            risk_free_rate_provider=risk_free_rate_provider,
            research_provider=research_provider,
            announcements_provider=announcements_provider,
            macro_data_provider=macro_data_provider,
        )
    except NotEquityAnalyzableError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    return _to_out(run)


@router.post("/holdings/{holding_id}/queue", response_model=QueuedRunOut, status_code=202)
def queue_local_analysis(holding_id: UUID, db: Session = Depends(get_db)) -> QueuedRunOut:
    """Sprint 5B / F8: "Run on my PC". Only inserts a QUEUED run; the local
    worker (`python -m app.worker`) picks it up. Deliberately depends on no
    LLM/research/market provider: nothing runs on this server. A holding
    that already has a queued or running local run gets that run back."""
    require_not_demo(db)
    holding = _get_holding_or_404(db, holding_id)
    try:
        run, _created = analysis_queue.enqueue_local_run(db, holding, settings=get_settings())
    except NotEquityAnalyzableError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    return _queued_out(db, run)


@router.get("/queue", response_model=AnalysisQueueOut)
def get_queue(db: Session = Depends(get_db)) -> AnalysisQueueOut:
    """Local workers, the pending local runs and the last finished ones."""
    if is_demo_mode(db):
        return demo_analysis_queue()
    workers = analysis_queue.worker_statuses(db, settings=get_settings())
    return AnalysisQueueOut(
        workers=[AnalysisWorkerOut(**w.__dict__) for w in workers],
        any_worker_online=any(w.online for w in workers),
        pending=[_queued_out(db, r) for r in analysis_queue.list_queue(db)],
        recent=[_queued_out(db, r) for r in analysis_queue.recent_local_runs(db)],
    )


@router.post("/queue/ready-holdings", response_model=QueueReadyHoldingsOut)
def queue_ready_holdings(db: Session = Depends(get_db)) -> QueueReadyHoldingsOut:
    """F5: queue every owned stock / equity ETF that isn't blocked on its
    instrument type, ticker or financial history."""
    require_not_demo(db)
    result = analysis_queue.queue_ready_holdings(db, settings=get_settings())
    return QueueReadyHoldingsOut(
        queued=[_queued_out(db, r) for r in result.queued],
        already_queued=[_queued_out(db, r) for r in result.already_queued],
        skipped=[
            QueueSkippedOut(holding_id=h.id, ticker=h.ticker, holding_name=h.name, reason=reason)
            for h, reason in result.skipped
        ],
    )


@router.post("/runs/{run_id}/cancel", response_model=QueuedRunOut)
def cancel_queued_run(run_id: UUID, db: Session = Depends(get_db)) -> QueuedRunOut:
    """Removes a queued run no worker has started (e.g. before choosing
    "Run in cloud instead"). A running run can't be cancelled from here."""
    require_not_demo(db)
    run = db.get(EquityAnalysisRun, run_id)
    if run is None:
        raise HTTPException(status_code=404, detail="run not found")
    try:
        run = analysis_queue.cancel_run(db, run)
    except analysis_queue.RunNotCancellableError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    return _queued_out(db, run)


@router.get("/holdings/{holding_id}/notes", response_model=EquityHoldingNoteOut)
def get_notes(holding_id: UUID, db: Session = Depends(get_db)) -> EquityHoldingNoteOut:
    if is_demo_mode(db):
        demo = demo_analysis_note(holding_id)
        if demo is None:
            raise HTTPException(status_code=404, detail="holding not found")
        return demo
    holding = _get_holding_or_404(db, holding_id)
    note = get_holding_note(db, holding.id)
    if note is None:
        return EquityHoldingNoteOut(holding_id=holding.id, content="", updated_at=None)
    return EquityHoldingNoteOut(
        holding_id=note.holding_id, content=note.content, updated_at=note.updated_at
    )


@router.put("/holdings/{holding_id}/notes", response_model=EquityHoldingNoteOut)
def put_notes(
    holding_id: UUID, payload: EquityHoldingNoteIn, db: Session = Depends(get_db)
) -> EquityHoldingNoteOut:
    require_not_demo(db)
    holding = _get_holding_or_404(db, holding_id)
    note = set_holding_note(db, holding.id, payload.content)
    return EquityHoldingNoteOut(
        holding_id=note.holding_id, content=note.content, updated_at=note.updated_at
    )
