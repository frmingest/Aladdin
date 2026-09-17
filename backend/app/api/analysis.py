"""Analysis-run endpoints (architecture §26 Phase 3)."""

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import PlainTextResponse
from sqlalchemy.orm import Session

from app.config.database import get_db
from app.models.analysis import AnalysisRun, HoldingAnalysis
from app.models.document import Document
from app.models.financial_fact import FinancialLineItem
from app.models.holding import Holding
from app.models.portfolio import PortfolioPosition, PortfolioSnapshot
from app.providers.base import LLMProvider
from app.providers.factory import get_llm_fallback_provider, get_llm_provider
from app.schemas.analysis import (
    AnalysisRunDetail,
    AnalysisRunFailureOut,
    AnalysisRunRequest,
    AnalysisRunSummary,
    EvidenceReferenceOut,
    FactorAssessmentOut,
    HoldingAnalysisDetail,
    HoldingAnalysisOutput,
    HoldingAnalysisSummary,
)
from app.services.analysis.memo import render_holding_memo
from app.services.analysis.runner import AnalysisRunOutcome, run_analysis

router = APIRouter(prefix="/analysis", tags=["analysis"])


def _holdings_with_evidence(db: Session, snapshot_id: UUID) -> list[UUID]:
    """Default holding set for a run with no explicit `holding_ids`: every
    holding in the snapshot that has at least one document or financial
    fact on record — analyzing a holding with nothing at all would only
    invite fabrication (see InsufficientContextError)."""
    holding_ids = {
        p.holding_id
        for p in db.query(PortfolioPosition).filter(PortfolioPosition.snapshot_id == snapshot_id).all()
    }
    if not holding_ids:
        return []
    with_docs = {
        row[0]
        for row in db.query(Document.holding_id).filter(Document.holding_id.in_(holding_ids)).all()
    }
    with_facts = {
        row[0]
        for row in db.query(FinancialLineItem.holding_id).filter(FinancialLineItem.holding_id.in_(holding_ids)).all()
    }
    return list(with_docs | with_facts)


def _run_to_summary(run: AnalysisRun) -> AnalysisRunSummary:
    return AnalysisRunSummary(
        id=run.id,
        portfolio_snapshot_id=run.portfolio_snapshot_id,
        status=run.status,
        started_at=run.started_at,
        completed_at=run.completed_at,
        provider=run.provider,
        model_name=run.model_name,
        prompt_version=run.prompt_version,
        scoring_version=run.scoring_version,
        macro_regime=run.macro_regime,
        holding_analysis_count=len(run.holding_analyses),
        failure_count=len(run.requested_holding_ids) - len(run.holding_analyses),
    )


def _holding_analysis_to_summary(holding_analysis: HoldingAnalysis, holding: Holding) -> HoldingAnalysisSummary:
    return HoldingAnalysisSummary(
        id=holding_analysis.id,
        holding_id=holding_analysis.holding_id,
        ticker=holding.ticker,
        name=holding.name,
        overall_score=holding_analysis.overall_score,
        confidence=holding_analysis.confidence,
        thesis_status=holding_analysis.structured_output_json.get("thesis_status", "unknown"),
    )


def _outcome_to_detail(db: Session, outcome: AnalysisRunOutcome) -> AnalysisRunDetail:
    holdings_by_id = {
        h.id: h
        for h in db.query(Holding)
        .filter(Holding.id.in_([ha.holding_id for ha in outcome.holding_analyses]))
        .all()
    }
    summary = _run_to_summary(outcome.analysis_run)
    return AnalysisRunDetail(
        **summary.model_dump(),
        holding_analyses=[
            _holding_analysis_to_summary(ha, holdings_by_id[ha.holding_id]) for ha in outcome.holding_analyses
        ],
        failures=[AnalysisRunFailureOut(holding_id=f.holding_id, reason=f.reason) for f in outcome.failures],
        error_message=outcome.analysis_run.error_message,
    )


@router.post("/snapshots/{snapshot_id}/runs", response_model=AnalysisRunDetail, status_code=201)
def create_analysis_run(
    snapshot_id: UUID,
    body: AnalysisRunRequest,
    db: Session = Depends(get_db),
    provider: LLMProvider = Depends(get_llm_provider),
    fallback_provider: LLMProvider | None = Depends(get_llm_fallback_provider),
) -> AnalysisRunDetail:
    """Runs the Phase 3 two-pass Buffett/Munger analysis (§11) for every
    requested holding in the snapshot, synchronously. See
    app.services.analysis.runner for why this isn't backgrounded yet.

    `fallback_provider` is None unless settings.llm_fallback_provider is
    configured (§29, 2026-09-17) — run_analysis only ever reaches for it once
    the primary provider's daily budget is exhausted mid-run."""
    snapshot = db.get(PortfolioSnapshot, snapshot_id)
    if snapshot is None:
        raise HTTPException(status_code=404, detail="portfolio snapshot not found")

    holding_ids = body.holding_ids or _holdings_with_evidence(db, snapshot_id)
    if not holding_ids:
        raise HTTPException(
            status_code=422,
            detail="no holdings in this snapshot have any documents or financial facts to analyze",
        )

    outcome = run_analysis(db, provider, snapshot_id, holding_ids, fallback_provider=fallback_provider)
    return _outcome_to_detail(db, outcome)


@router.get("/runs/{run_id}", response_model=AnalysisRunDetail)
def get_analysis_run(run_id: UUID, db: Session = Depends(get_db)) -> AnalysisRunDetail:
    run = db.get(AnalysisRun, run_id)
    if run is None:
        raise HTTPException(status_code=404, detail="analysis run not found")

    holdings_by_id = {
        h.id: h
        for h in db.query(Holding).filter(Holding.id.in_([ha.holding_id for ha in run.holding_analyses])).all()
    }
    requested = {UUID(h) for h in run.requested_holding_ids}
    succeeded = {ha.holding_id for ha in run.holding_analyses}
    failed_ids = requested - succeeded

    summary = _run_to_summary(run)
    return AnalysisRunDetail(
        **summary.model_dump(),
        holding_analyses=[
            _holding_analysis_to_summary(ha, holdings_by_id[ha.holding_id]) for ha in run.holding_analyses
        ],
        failures=[
            AnalysisRunFailureOut(holding_id=hid, reason=run.error_message or "see error_message")
            for hid in failed_ids
        ],
        error_message=run.error_message,
    )


@router.get("/holdings/{holding_id}/analyses", response_model=list[HoldingAnalysisSummary])
def list_holding_analyses(holding_id: UUID, db: Session = Depends(get_db)) -> list[HoldingAnalysisSummary]:
    holding = db.get(Holding, holding_id)
    if holding is None:
        raise HTTPException(status_code=404, detail="holding not found")

    analyses = (
        db.query(HoldingAnalysis)
        .filter(HoldingAnalysis.holding_id == holding_id)
        .order_by(HoldingAnalysis.created_at.desc())
        .all()
    )
    return [_holding_analysis_to_summary(ha, holding) for ha in analyses]


@router.get("/holding-analyses/{holding_analysis_id}", response_model=HoldingAnalysisDetail)
def get_holding_analysis(holding_analysis_id: UUID, db: Session = Depends(get_db)) -> HoldingAnalysisDetail:
    holding_analysis = db.get(HoldingAnalysis, holding_analysis_id)
    if holding_analysis is None:
        raise HTTPException(status_code=404, detail="holding analysis not found")
    holding = db.get(Holding, holding_analysis.holding_id)
    if holding is None:  # pragma: no cover — FK integrity makes this unreachable in practice
        raise HTTPException(status_code=500, detail="holding analysis references a missing holding")

    return HoldingAnalysisDetail(
        id=holding_analysis.id,
        analysis_run_id=holding_analysis.analysis_run_id,
        holding_id=holding_analysis.holding_id,
        ticker=holding.ticker,
        name=holding.name,
        overall_score=holding_analysis.overall_score,
        confidence=holding_analysis.confidence,
        structured_output=HoldingAnalysisOutput.model_validate(holding_analysis.structured_output_json),
        factor_assessments=[FactorAssessmentOut.model_validate(fa) for fa in holding_analysis.factor_assessments],
        evidence_references=[
            EvidenceReferenceOut.model_validate(er) for er in holding_analysis.evidence_references
        ],
        created_at=holding_analysis.created_at,
    )


@router.get("/holding-analyses/{holding_analysis_id}/memo")
def get_holding_analysis_memo(holding_analysis_id: UUID, db: Session = Depends(get_db)) -> PlainTextResponse:
    holding_analysis = db.get(HoldingAnalysis, holding_analysis_id)
    if holding_analysis is None:
        raise HTTPException(status_code=404, detail="holding analysis not found")
    holding = db.get(Holding, holding_analysis.holding_id)
    if holding is None:  # pragma: no cover — FK integrity makes this unreachable in practice
        raise HTTPException(status_code=500, detail="holding analysis references a missing holding")

    memo = render_holding_memo(holding, holding_analysis, holding_analysis.factor_assessments)
    return PlainTextResponse(memo, media_type="text/markdown")
