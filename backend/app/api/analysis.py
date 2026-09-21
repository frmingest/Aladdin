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
from app.domain.analysis_schema import BlindPassOutputV1, ReconciliationOutputV1
from app.models.analysis import EquityAnalysisRun
from app.models.holding import Holding
from app.providers.base import (
    LLMProvider,
    MarketDataProvider,
    ResearchProvider,
    RiskFreeRateProvider,
)
from app.providers.factory import (
    get_llm_fallback_provider,
    get_llm_provider,
    get_market_data_provider,
    get_research_provider,
    get_risk_free_rate_provider,
)
from app.schemas.analysis import (
    EquityAnalysisRunOut,
    EquityHoldingNoteIn,
    EquityHoldingNoteOut,
)
from app.services.analysis.notes import get_holding_note, set_holding_note
from app.services.analysis.pipeline import NotEquityAnalyzableError, run_full_analysis

router = APIRouter(prefix="/analysis", tags=["analysis"])


def _get_holding_or_404(db: Session, holding_id: UUID) -> Holding:
    holding = db.get(Holding, holding_id)
    if holding is None:
        raise HTTPException(status_code=404, detail="holding not found")
    return holding


def _latest_run(db: Session, holding_id: UUID) -> EquityAnalysisRun | None:
    stmt = (
        select(EquityAnalysisRun)
        .where(EquityAnalysisRun.holding_id == holding_id)
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
        blind_pass=BlindPassOutputV1.model_validate(run.blind_pass_json) if run.blind_pass_json else None,
        blind_pass_citation_warnings=run.blind_pass_citation_warnings,
        reconciliation=(
            ReconciliationOutputV1.model_validate(run.reconciliation_json)
            if run.reconciliation_json
            else None
        ),
        reconciliation_citation_warnings=run.reconciliation_citation_warnings,
        price_target_low=run.price_target_low,
        price_target_high=run.price_target_high,
        price_target_currency=run.price_target_currency,
    )


@router.get("/holdings/{holding_id}", response_model=EquityAnalysisRunOut)
def get_latest_analysis(holding_id: UUID, db: Session = Depends(get_db)) -> EquityAnalysisRunOut:
    holding = _get_holding_or_404(db, holding_id)
    run = _latest_run(db, holding.id)
    if run is None:
        raise HTTPException(status_code=404, detail="no analysis run yet for this holding")
    return _to_out(run)


@router.post("/holdings/{holding_id}/run", response_model=EquityAnalysisRunOut, status_code=201)
def run_analysis(
    holding_id: UUID,
    db: Session = Depends(get_db),
    llm_provider: LLMProvider = Depends(get_llm_provider),
    llm_fallback_provider: LLMProvider | None = Depends(get_llm_fallback_provider),
    market_data_provider: MarketDataProvider = Depends(get_market_data_provider),
    risk_free_rate_provider: RiskFreeRateProvider = Depends(get_risk_free_rate_provider),
    research_provider: ResearchProvider = Depends(get_research_provider),
) -> EquityAnalysisRunOut:
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
        )
    except NotEquityAnalyzableError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    return _to_out(run)


@router.get("/holdings/{holding_id}/notes", response_model=EquityHoldingNoteOut)
def get_notes(holding_id: UUID, db: Session = Depends(get_db)) -> EquityHoldingNoteOut:
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
    holding = _get_holding_or_404(db, holding_id)
    note = set_holding_note(db, holding.id, payload.content)
    return EquityHoldingNoteOut(
        holding_id=note.holding_id, content=note.content, updated_at=note.updated_at
    )
