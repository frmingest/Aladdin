"""Valuation & scenario engine endpoints (architecture §17, §26 Phase 5)."""

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.config.database import get_db
from app.models.holding import Holding
from app.models.valuation import ValuationCase
from app.providers.base import LLMProvider
from app.providers.factory import get_llm_provider
from app.schemas.valuation import ValuationCaseCreate, ValuationCaseOut, ValuationCritiqueOutput
from app.services.valuation.dcf import create_valuation_case

router = APIRouter(prefix="/valuation", tags=["valuation"])

_VALID_CASE_TYPES = {"bull", "base", "bear"}


def _case_to_out(case: ValuationCase) -> ValuationCaseOut:
    return ValuationCaseOut(
        id=case.id,
        holding_id=case.holding_id,
        analysis_run_id=case.analysis_run_id,
        case_type=case.case_type,
        assumptions=case.assumptions_json,
        calculated_value=case.calculated_value,
        currency=case.currency,
        confidence=case.confidence,
        calculation_note=case.calculation_note,
        critique=ValuationCritiqueOutput.model_validate(case.critique_json) if case.critique_json else None,
        critique_error=case.critique_error,
        created_at=case.created_at,
    )


@router.post("/holdings/{holding_id}/cases", response_model=ValuationCaseOut, status_code=201)
def create_holding_valuation_case(
    holding_id: UUID,
    body: ValuationCaseCreate,
    db: Session = Depends(get_db),
    llm_provider: LLMProvider = Depends(get_llm_provider),
) -> ValuationCaseOut:
    """Runs the deterministic DCF (app.domain.valuation) and, best-effort,
    the §17 LLM assumption critique. The calculated value is always
    persisted even if the critique step fails — see critique_error."""
    if body.case_type not in _VALID_CASE_TYPES:
        raise HTTPException(status_code=422, detail=f"case_type must be one of {sorted(_VALID_CASE_TYPES)}")

    holding = db.get(Holding, holding_id)
    if holding is None:
        raise HTTPException(status_code=404, detail="holding not found")

    case = create_valuation_case(db, llm_provider, holding, body)
    return _case_to_out(case)


@router.get("/holdings/{holding_id}/cases", response_model=list[ValuationCaseOut])
def list_holding_valuation_cases(holding_id: UUID, db: Session = Depends(get_db)) -> list[ValuationCaseOut]:
    holding = db.get(Holding, holding_id)
    if holding is None:
        raise HTTPException(status_code=404, detail="holding not found")
    cases = (
        db.query(ValuationCase)
        .filter(ValuationCase.holding_id == holding_id)
        .order_by(ValuationCase.created_at.desc())
        .all()
    )
    return [_case_to_out(c) for c in cases]


@router.get("/cases/{case_id}", response_model=ValuationCaseOut)
def get_valuation_case(case_id: UUID, db: Session = Depends(get_db)) -> ValuationCaseOut:
    case = db.get(ValuationCase, case_id)
    if case is None:
        raise HTTPException(status_code=404, detail="valuation case not found")
    return _case_to_out(case)
