"""Investment thesis ledger endpoints (architecture §16, §26 Phase 5)."""

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.config.database import get_db
from app.models.holding import Holding
from app.models.thesis import InvestmentThesis
from app.schemas.thesis import InvalidationSignalOut, ThesisCreate, ThesisOut, ThesisUpdate
from app.services.thesis.service import (
    UnknownThesisStatusError,
    check_invalidation_signal,
    create_thesis,
    list_theses_for_holding,
    update_thesis,
)

router = APIRouter(prefix="/thesis", tags=["thesis"])


def _thesis_to_out(thesis: InvestmentThesis) -> ThesisOut:
    return ThesisOut(
        id=thesis.id,
        holding_id=thesis.holding_id,
        thesis=thesis.thesis,
        bull_case=thesis.bull_case,
        bear_case=thesis.bear_case,
        key_assumptions=list(thesis.key_assumptions_json or []),
        invalidation_conditions=list(thesis.invalidation_conditions_json or []),
        confidence=thesis.confidence,
        status=thesis.status,
        created_at=thesis.created_at,
        updated_at=thesis.updated_at,
    )


@router.post("/holdings/{holding_id}", response_model=ThesisOut, status_code=201)
def create_holding_thesis(holding_id: UUID, body: ThesisCreate, db: Session = Depends(get_db)) -> ThesisOut:
    """Adds a new thesis row for this holding (§16's "historical thesis
    ledger" — this does not replace any existing thesis row; use PATCH
    /thesis/{thesis_id} to edit one in place, or create a new one and close
    the old one out via its own status update)."""
    holding = db.get(Holding, holding_id)
    if holding is None:
        raise HTTPException(status_code=404, detail="holding not found")
    thesis = create_thesis(db, holding_id, body)
    return _thesis_to_out(thesis)


@router.get("/holdings/{holding_id}", response_model=list[ThesisOut])
def list_holding_theses(holding_id: UUID, db: Session = Depends(get_db)) -> list[ThesisOut]:
    holding = db.get(Holding, holding_id)
    if holding is None:
        raise HTTPException(status_code=404, detail="holding not found")
    return [_thesis_to_out(t) for t in list_theses_for_holding(db, holding_id)]


@router.get("/{thesis_id}", response_model=ThesisOut)
def get_thesis(thesis_id: UUID, db: Session = Depends(get_db)) -> ThesisOut:
    thesis = db.get(InvestmentThesis, thesis_id)
    if thesis is None:
        raise HTTPException(status_code=404, detail="thesis not found")
    return _thesis_to_out(thesis)


@router.patch("/{thesis_id}", response_model=ThesisOut)
def patch_thesis(thesis_id: UUID, body: ThesisUpdate, db: Session = Depends(get_db)) -> ThesisOut:
    thesis = db.get(InvestmentThesis, thesis_id)
    if thesis is None:
        raise HTTPException(status_code=404, detail="thesis not found")
    try:
        thesis = update_thesis(db, thesis, body)
    except UnknownThesisStatusError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    return _thesis_to_out(thesis)


@router.get("/{thesis_id}/invalidation-check", response_model=InvalidationSignalOut)
def get_invalidation_check(thesis_id: UUID, db: Session = Depends(get_db)) -> InvalidationSignalOut:
    """Read-only, deterministic comparison against the most recent completed
    analysis for this holding (app.services.thesis.service.
    check_invalidation_signal) — never mutates the thesis (§25)."""
    thesis = db.get(InvestmentThesis, thesis_id)
    if thesis is None:
        raise HTTPException(status_code=404, detail="thesis not found")
    signal = check_invalidation_signal(db, thesis)
    return InvalidationSignalOut(
        thesis_id=signal.thesis_id,
        holding_id=signal.holding_id,
        checked_at=signal.checked_at,
        has_signal=signal.has_signal,
        reasons=signal.reasons,
        latest_analysis_run_id=signal.latest_analysis_run_id,
        latest_analysis_completed_at=signal.latest_analysis_completed_at,
        latest_analysis_thesis_status=signal.latest_analysis_thesis_status,
        latest_analysis_overall_score=signal.latest_analysis_overall_score,
        new_invalidation_triggers=signal.new_invalidation_triggers,
    )
