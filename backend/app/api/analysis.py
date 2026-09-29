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

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config.database import get_db
from app.config.settings import get_settings
from app.domain.analysis_schema import get_blind_pass_schema, get_reconciliation_schema
from app.domain.analyst_modes import DALIO, DALIO_VERDICT_BASIS, DEFAULT_PERSONA
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
    get_country_indicator_provider_or_none,
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
    AutoQueueActionOut,
    AutoQueueOut,
    ComparisonOut,
    EquityAnalysisRunOut,
    EquityHoldingNoteIn,
    EquityHoldingNoteOut,
    EvidenceItemOut,
    QueuedRunOut,
    QueueReadyHoldingsOut,
    QueueSkippedOut,
    SideBySideOut,
    SynthesisOut,
)
from app.services.analysis import queue as analysis_queue
from app.services.analysis.auto_queue import auto_queue_missing
from app.services.analysis.latest import run_ratings
from app.services.analysis.notes import get_holding_note, set_holding_note
from app.services.analysis.pipeline import NotEquityAnalyzableError, run_full_analysis
from app.services.analysis.readiness import check_analysis_readiness
from app.services.analysis.side_by_side import compare_runs
from app.services.analysis.synthesis import (
    SynthesisNotPossibleError,
    latest_synthesis,
    run_synthesis,
)
from app.services.analysis.target_check import stored_target_warning
from app.services.settings.analyst_mode import is_synthesis_enabled
from app.services.settings.demo_guard import require_not_demo
from app.services.settings.demo_mode import is_demo_mode
from app.services.settings.synthetic_dalio import demo_dalio_run, demo_side_by_side
from app.services.settings.synthetic_data import (
    demo_analysis_note,
    demo_analysis_queue,
    demo_analysis_readiness,
    demo_analysis_run,
)

router = APIRouter(prefix="/analysis", tags=["analysis"])

# F22: every per-holding endpoint takes an optional ?persona=; the default
# keeps every pre-F22 caller on Buffett/Munger.
PersonaParam = Query(DEFAULT_PERSONA, pattern="^(buffett_munger|dalio)$")


def _get_holding_or_404(db: Session, holding_id: UUID) -> Holding:
    holding = db.get(Holding, holding_id)
    if holding is None:
        raise HTTPException(status_code=404, detail="holding not found")
    return holding


# Queued / running (local worker) and cancelled runs aren't "the latest
# analysis": showing them would hide the holding's previous verdict while a
# new run waits on the PC. They're served by GET /analysis/queue instead.
_NOT_A_RESULT = (*PENDING_RUN_STATUSES, EquityAnalysisRunStatus.CANCELLED.value)


def _latest_run(db: Session, holding_id: UUID, persona: str = DEFAULT_PERSONA) -> EquityAnalysisRun | None:
    stmt = (
        select(EquityAnalysisRun)
        .where(
            EquityAnalysisRun.holding_id == holding_id,
            EquityAnalysisRun.status.notin_(_NOT_A_RESULT),
            EquityAnalysisRun.persona == persona,
        )
        .order_by(EquityAnalysisRun.started_at.desc())
        .limit(1)
    )
    return db.scalar(stmt)


def _to_out(run: EquityAnalysisRun, db: Session | None = None) -> EquityAnalysisRunOut:
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
        price_target_warning=stored_target_warning(db, run) if db is not None else None,
        evidence_items=_evidence_items(run),
        user_notes_snapshot=run.user_notes_snapshot,
        engine=run.engine or "cloud",
        queued_at=run.queued_at,
        claimed_by=run.claimed_by,
        attempts=run.attempts or 0,
        persona=run.persona or DEFAULT_PERSONA,
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
        persona=run.persona or DEFAULT_PERSONA,
        auto_queued=bool(run.auto_queued),
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
def get_latest_analysis(
    holding_id: UUID, persona: str = PersonaParam, db: Session = Depends(get_db)
) -> EquityAnalysisRunOut:
    if is_demo_mode(db):
        demo = demo_dalio_run(holding_id) if persona == DALIO else demo_analysis_run(holding_id)
        if demo is None:
            raise HTTPException(status_code=404, detail="no analysis run yet for this holding")
        return demo
    holding = _get_holding_or_404(db, holding_id)
    run = _latest_run(db, holding.id, persona)
    if run is None:
        raise HTTPException(status_code=404, detail="no analysis run yet for this holding")
    return _to_out(run, db)


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
    persona: str = PersonaParam,
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
    country_indicator_provider=Depends(get_country_indicator_provider_or_none),
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
            country_indicator_provider=country_indicator_provider,
            persona=persona,
        )
    except NotEquityAnalyzableError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    return _to_out(run, db)


@router.post("/holdings/{holding_id}/queue", response_model=QueuedRunOut, status_code=202)
def queue_local_analysis(
    holding_id: UUID, persona: str = PersonaParam, db: Session = Depends(get_db)
) -> QueuedRunOut:
    """Sprint 5B / F8: "Run on my PC". Only inserts a QUEUED run; the local
    worker (`python -m app.worker`) picks it up. Deliberately depends on no
    LLM/research/market provider: nothing runs on this server. A holding
    that already has a queued or running local run gets that run back."""
    require_not_demo(db)
    holding = _get_holding_or_404(db, holding_id)
    try:
        run, _created = analysis_queue.enqueue_local_run(db, holding, settings=get_settings(), persona=persona)
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
def queue_ready_holdings(
    scope: analysis_queue.QueueScope = Query("holdings"),
    persona: analysis_queue.QueuePersona = Query("buffett_munger"),
    db: Session = Depends(get_db),
) -> QueueReadyHoldingsOut:
    """F5: queue every stock / equity ETF in `scope` that isn't blocked on
    its instrument type, ticker or financial history. `scope` is
    "holdings" (owned positions, default), "watchlist", or "all".
    `persona` (F22): "buffett_munger" (default), "dalio" or "both"."""
    require_not_demo(db)
    result = analysis_queue.queue_ready_holdings(db, settings=get_settings(), scope=scope, persona=persona)
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


# ---------------------------------------------------------------------------
# Epic F22: side-by-side, auto-queue, synthesis


def _synthesis_out(row) -> SynthesisOut:
    from app.domain.analysis_schema.synthesis_v1 import SynthesisOutputV1

    return SynthesisOut(
        id=row.id,
        holding_id=row.holding_id,
        buffett_run_id=row.buffett_run_id,
        dalio_run_id=row.dalio_run_id,
        status=row.status,
        schema_version=row.schema_version,
        prompt_version=row.prompt_version,
        provider=row.provider,
        model_name=row.model_name,
        output=SynthesisOutputV1.model_validate(row.output_json) if row.output_json else None,
        citation_warnings=row.citation_warnings or [],
        error_message=row.error_message,
        created_at=row.created_at,
    )


def app_dependency_llm() -> LLMProvider:
    """The configured LLM, honouring test/dev dependency overrides."""
    from app.main import app

    return app.dependency_overrides.get(get_llm_provider, get_llm_provider)()


def _usable(run: EquityAnalysisRun | None) -> EquityAnalysisRun | None:
    return run if run is not None and run.blind_pass_json else None


@router.get("/holdings/{holding_id}/side-by-side", response_model=SideBySideOut)
def get_side_by_side(holding_id: UUID, db: Session = Depends(get_db)) -> SideBySideOut:
    """Story 22.7: both personas' latest runs, a deterministic agree/disagree
    comparison and the latest synthesis (if any). Pure read — the auto-queue
    is a separate POST."""
    if is_demo_mode(db):
        demo = demo_side_by_side(holding_id)
        if demo is None:
            raise HTTPException(status_code=404, detail="holding not found")
        return demo
    holding = _get_holding_or_404(db, holding_id)
    buffett = _latest_run(db, holding.id, "buffett_munger")
    dalio = _latest_run(db, holding.id, DALIO)
    comparison = compare_runs(_usable(buffett), _usable(dalio))
    synthesis = latest_synthesis(db, holding.id)
    return SideBySideOut(
        holding_id=holding.id,
        buffett=_to_out(buffett, db) if buffett else None,
        dalio=_to_out(dalio, db) if dalio else None,
        comparison=ComparisonOut(**comparison.__dict__),
        synthesis=_synthesis_out(synthesis) if synthesis else None,
        synthesis_enabled=is_synthesis_enabled(db),
        dalio_verdict_basis=DALIO_VERDICT_BASIS,
    )


def _auto_queue_out(result) -> AutoQueueOut:
    return AutoQueueOut(
        mode=result.mode,
        cap=result.cap,
        auto_queued_last_24h=result.auto_queued_last_24h,
        queued_count=len(result.queued),
        actions=[AutoQueueActionOut(**a.__dict__) for a in result.actions],
    )


@router.post("/holdings/{holding_id}/auto-queue", response_model=AutoQueueOut)
def auto_queue_holding(holding_id: UUID, db: Session = Depends(get_db)) -> AutoQueueOut:
    """Story 22.7 / plan §5: in side-by-side mode, queue this holding's
    missing or stale persona run on the local worker (never the cloud),
    within the nightly cap. Does nothing in any other mode."""
    require_not_demo(db)
    holding = _get_holding_or_404(db, holding_id)
    return _auto_queue_out(auto_queue_missing(db, [holding], settings=get_settings()))


@router.post("/auto-queue", response_model=AutoQueueOut)
def auto_queue_portfolio(
    scope: analysis_queue.QueueScope = Query("holdings"), db: Session = Depends(get_db)
) -> AutoQueueOut:
    """Same as the per-holding auto-queue, for every holding in `scope` —
    called by the side-by-side list views (dashboard board)."""
    require_not_demo(db)
    ids = analysis_queue._scoped_holding_ids(db, scope)
    holdings = [h for h in (db.get(Holding, i) for i in ids) if h is not None]
    return _auto_queue_out(auto_queue_missing(db, holdings, settings=get_settings()))


@router.post("/holdings/{holding_id}/synthesis", response_model=SynthesisOut, status_code=201)
def create_synthesis(holding_id: UUID, db: Session = Depends(get_db)) -> SynthesisOut:
    """Story 22.8: the optional "where they'd argue" pass. Off by default
    (Settings page), explicit click only, never overwrites either verdict.
    Spends one call on the server's configured LLM — resolved only after
    the demo/on-off checks, so a switched-off synthesis never needs one."""
    require_not_demo(db)
    holding = _get_holding_or_404(db, holding_id)
    if not is_synthesis_enabled(db):
        raise HTTPException(status_code=409, detail="The synthesis is switched off (Settings -> Analyst modes).")
    buffett = _usable(_latest_run(db, holding.id, "buffett_munger"))
    dalio = _usable(_latest_run(db, holding.id, DALIO))
    if buffett is None or dalio is None:
        raise HTTPException(
            status_code=409,
            detail="A synthesis needs both a Buffett/Munger and a Dalio analysis of this holding.",
        )
    llm_provider: LLMProvider = app_dependency_llm()
    try:
        row = run_synthesis(
            db, holding_id=holding.id, buffett=buffett, dalio=dalio, llm_provider=llm_provider, settings=get_settings()
        )
    except SynthesisNotPossibleError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    return _synthesis_out(row)

