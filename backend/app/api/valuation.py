"""Valuation & scenario engine endpoints (architecture §17, §26 Phase 5)."""

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.config.database import get_db
from app.models.holding import Holding
from app.models.valuation import ValuationCase
from app.providers.base import LLMProvider
from app.providers.factory import get_llm_provider
from app.schemas.valuation import (
    DiscountRateSuggestionOut,
    FxRateSuggestionOut,
    ValuationCaseCreate,
    ValuationCaseOut,
    ValuationCritiqueOutput,
    ValuationDefaultsOut,
)
from app.services.valuation.dcf import create_valuation_case
from app.services.valuation.defaults import get_valuation_defaults

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


@router.get("/holdings/{holding_id}/defaults", response_model=ValuationDefaultsOut)
def get_holding_valuation_defaults(holding_id: UUID, db: Session = Depends(get_db)) -> ValuationDefaultsOut:
    """ECON-001 fix (docs/decisions/0014): a suggested discount_rate_pct
    (risk-free leg for the holding's currency + a configurable equity risk
    premium) and fx_rate_to_reporting, grounded in macro/FX data the app
    already persists (Phase 4/Phase 2) — never auto-applied, just a visible
    anchor for the "New valuation case" form (§21)."""
    holding = db.get(Holding, holding_id)
    if holding is None:
        raise HTTPException(status_code=404, detail="holding not found")

    defaults = get_valuation_defaults(db, holding)
    return ValuationDefaultsOut(
        discount_rate=DiscountRateSuggestionOut(
            available=defaults.discount_rate.available,
            currency=defaults.discount_rate.currency,
            config_version=defaults.discount_rate.config_version,
            risk_free_pct=defaults.discount_rate.risk_free_pct,
            equity_risk_premium_pct=defaults.discount_rate.equity_risk_premium_pct,
            suggested_discount_rate_pct=defaults.discount_rate.suggested_discount_rate_pct,
            risk_free_series_used=defaults.discount_rate.risk_free_series_used,
            macro_as_of=defaults.discount_rate.macro_as_of,
            reason=defaults.discount_rate.reason,
        ),
        fx_rate=FxRateSuggestionOut(
            available=defaults.fx_rate.available,
            from_currency=defaults.fx_rate.from_currency,
            to_currency=defaults.fx_rate.to_currency,
            rate=defaults.fx_rate.rate,
            observed_at=defaults.fx_rate.observed_at,
            reason=defaults.fx_rate.reason,
        ),
    )


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
