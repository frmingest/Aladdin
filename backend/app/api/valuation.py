"""Valuation endpoints (Sprint 3) — DCF/reverse-DCF scenarios and
multiples-over-time for one holding (Brain Step 4), built from live market
data + a versioned discount-rate/growth methodology.

Mirrors app/api/research.py's shape: GET serves a fresh-enough result,
recomputing live data only when it's gone stale
(app/services/market_data/), and the POST .../refresh variant forces a
real refresh regardless of freshness. Nothing here ever 500s on a live-data
failure — app/services/valuation/holding_valuation.py degrades the
specific unavailable part (recorded in `unavailable_reasons`) rather than
failing the whole response (CLAUDE.md: fail visibly, never silently).
"""
from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.config.database import get_db
from app.models.holding import Holding
from app.providers.base import MarketDataProvider, RiskFreeRateProvider
from app.providers.factory import get_market_data_provider, get_risk_free_rate_provider
from app.schemas.valuation import (
    BoardRowOut,
    DCFOut,
    DCFScenarioOut,
    HoldingValuationOut,
    MarginOfSafetyBoardOut,
    PeriodMultiplesOut,
)
from app.services.valuation.board import build_board
from app.services.valuation.holding_valuation import (
    HoldingValuationResult,
    compute_holding_valuation,
)

router = APIRouter(prefix="/valuation", tags=["valuation"])


def _get_holding_or_404(db: Session, holding_id: UUID) -> Holding:
    holding = db.get(Holding, holding_id)
    if holding is None:
        raise HTTPException(status_code=404, detail="holding not found")
    return holding


def _to_out(result: HoldingValuationResult) -> HoldingValuationOut:
    dcf_out = None
    if result.dcf is not None:
        dcf_out = DCFOut(
            discount_rate=result.dcf.discount_rate,
            terminal_growth_rate=result.dcf.terminal_growth_rate,
            scenarios=[
                DCFScenarioOut(
                    label=scenario.label,
                    growth_rate=scenario.growth_rate,
                    intrinsic_value_per_share=scenario.intrinsic_value_per_share,
                    margin_of_safety=result.dcf.margin_of_safety(scenario.label),
                )
                for scenario in result.dcf.scenarios
            ],
        )

    return HoldingValuationOut(
        holding_id=result.holding_id,
        ticker=result.ticker,
        valuation_currency=result.valuation_currency,
        as_of=result.as_of,
        base_growth_rate=result.base_growth_rate,
        discount_rate=result.discount_rate,
        risk_free_rate_pct=result.risk_free_rate_pct,
        beta=result.beta,
        equity_risk_premium=result.equity_risk_premium,
        current_price_per_share=result.current_price_per_share,
        dcf=dcf_out,
        reverse_dcf_implied_growth=result.reverse_dcf_implied_growth,
        multiples=[
            PeriodMultiplesOut(
                period=m.period,
                matched_price_observed_at=m.matched_price_observed_at,
                computed=m.computed,
                skipped=m.skipped,
                notes=m.notes,
            )
            for m in result.multiples
        ],
        shares_outstanding=result.shares_outstanding,
        shares_source=result.shares_source,
        assumptions_version=result.assumptions_version,
        unavailable_reasons=result.unavailable_reasons,
    )


@router.get("/holdings/{holding_id}", response_model=HoldingValuationOut)
def get_holding_valuation(
    holding_id: UUID,
    db: Session = Depends(get_db),
    market_data_provider: MarketDataProvider = Depends(get_market_data_provider),
    risk_free_rate_provider: RiskFreeRateProvider = Depends(get_risk_free_rate_provider),
) -> HoldingValuationOut:
    holding = _get_holding_or_404(db, holding_id)
    result = compute_holding_valuation(db, holding, market_data_provider, risk_free_rate_provider)
    return _to_out(result)


@router.post("/holdings/{holding_id}/refresh", response_model=HoldingValuationOut)
def refresh_holding_valuation(
    holding_id: UUID,
    db: Session = Depends(get_db),
    market_data_provider: MarketDataProvider = Depends(get_market_data_provider),
    risk_free_rate_provider: RiskFreeRateProvider = Depends(get_risk_free_rate_provider),
) -> HoldingValuationOut:
    holding = _get_holding_or_404(db, holding_id)
    result = compute_holding_valuation(
        db, holding, market_data_provider, risk_free_rate_provider, force_refresh=True
    )
    return _to_out(result)


@router.get("/board", response_model=MarginOfSafetyBoardOut)
def get_margin_of_safety_board(
    db: Session = Depends(get_db),
    market_data_provider: MarketDataProvider = Depends(get_market_data_provider),
    risk_free_rate_provider: RiskFreeRateProvider = Depends(get_risk_free_rate_provider),
) -> MarginOfSafetyBoardOut:
    """Feature F3: every currently owned equity ranked by margin of safety.
    Uses the same cached price/FX/rate data as GET /valuation/holdings/{id};
    no LLM call is ever made."""
    board = build_board(
        db, market_data_provider=market_data_provider, risk_free_rate_provider=risk_free_rate_provider
    )
    return MarginOfSafetyBoardOut(
        rows=[BoardRowOut(**row.__dict__) for row in board.rows],
        total_equity_value_nok=board.total_equity_value_nok,
        zone_counts=board.zone_counts(),
    )
