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
    FinancialsScenarioOut,
    FinancialsValuationOut,
    FundLookThroughOut,
    HoldingValuationOut,
    LookThroughScenarioOut,
    MarginOfSafetyBoardOut,
    PeriodMultiplesOut,
)
from app.services.settings.demo_guard import require_not_demo
from app.services.settings.demo_mode import is_demo_mode
from app.services.settings.synthetic_data import demo_valuation, demo_valuation_board
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

    financials_out = None
    if result.financials is not None:
        fin = result.financials
        financials_out = FinancialsValuationOut(
            cost_of_equity=fin.cost_of_equity,
            growth_rate=fin.growth_rate,
            book_value_per_share=fin.book_value_per_share,
            roe_periods_used=fin.roe_periods_used,
            roe_was_capped=fin.roe_was_capped,
            scenarios=[
                FinancialsScenarioOut(
                    label=sc.label,
                    roe=sc.roe,
                    justified_price_to_book=sc.justified_price_to_book,
                    value_per_share=sc.value_per_share,
                    margin_of_safety=fin.margin_of_safety(sc.label),
                )
                for sc in fin.scenarios
            ],
        )
    look_out = None
    if result.fund_look_through is not None:
        look = result.fund_look_through
        look_out = FundLookThroughOut(
            scenarios=[
                LookThroughScenarioOut(
                    label=sc.label,
                    growth_rate=sc.growth_rate,
                    fair_pe=sc.fair_pe,
                    value_per_unit=sc.value_per_unit,
                    margin_of_safety=look.margin_of_safety(sc.label),
                )
                for sc in look.scenarios
            ],
            fund_earnings_yield=look.fund_earnings_yield,
            fund_pe=look.fund_pe,
            coverage_pct=look.coverage_pct,
            constituents_used=look.constituents_used,
            constituents_total=look.constituents_total,
            cost_of_equity=look.cost_of_equity,
            terminal_growth_rate=look.terminal_growth_rate,
            oldest_observation=look.oldest_observation,
            notes=look.notes,
            method_note=look.method_note,
        )
    rejected_values = None
    if result.rejected_dcf is not None:
        rejected_values = {sc.label: sc.intrinsic_value_per_share for sc in result.rejected_dcf.scenarios}
    elif result.rejected_financials is not None:
        rejected_values = {sc.label: sc.value_per_share for sc in result.rejected_financials.scenarios}
    elif result.rejected_fund_look_through is not None:
        rejected_values = {sc.label: sc.value_per_unit for sc in result.rejected_fund_look_through.scenarios}
    fades = bool(result.dcf and result.dcf.fades_to_terminal) or bool(
        result.rejected_dcf and result.rejected_dcf.fades_to_terminal
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
        base_discount_rate=result.base_discount_rate,
        regime=result.regime,
        regime_discount_rate_addon=result.regime_discount_rate_addon,
        regime_adjustments_version=result.regime_adjustments_version,
        valuation_method=result.valuation_method,
        valuation_status=result.valuation_status,
        valuation_status_reason=result.valuation_status_reason,
        raw_base_growth_rate=result.raw_base_growth_rate,
        growth_capped=result.growth_capped,
        fades_to_terminal=fades,
        capm_cost_of_equity=result.capm_cost_of_equity,
        financials=financials_out,
        fund_look_through=look_out,
        rejected_values=rejected_values,
    )


@router.get("/holdings/{holding_id}", response_model=HoldingValuationOut)
def get_holding_valuation(
    holding_id: UUID,
    db: Session = Depends(get_db),
    market_data_provider: MarketDataProvider = Depends(get_market_data_provider),
    risk_free_rate_provider: RiskFreeRateProvider = Depends(get_risk_free_rate_provider),
) -> HoldingValuationOut:
    if is_demo_mode(db):
        demo = demo_valuation(holding_id)
        if demo is None:
            raise HTTPException(status_code=404, detail="holding not found")
        return demo
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
    require_not_demo(db)
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
    no LLM call is ever made.

    Page-load-performance P1 (2026-09-28): never revalues live here — each
    holding is priced from whatever's already cached (see
    app/services/valuation/holding_valuation.py's `force_refresh=False`
    default), so this always returns fast regardless of portfolio size.
    Use POST /valuation/board/refresh to force a real revalue of every
    equity holding."""
    if is_demo_mode(db):
        return demo_valuation_board()
    board = build_board(
        db, market_data_provider=market_data_provider, risk_free_rate_provider=risk_free_rate_provider
    )
    return MarginOfSafetyBoardOut(
        rows=[BoardRowOut(**row.__dict__) for row in board.rows],
        total_equity_value_nok=board.total_equity_value_nok,
        zone_counts=board.zone_counts(),
    )


@router.post("/board/refresh", response_model=MarginOfSafetyBoardOut)
def refresh_margin_of_safety_board(
    db: Session = Depends(get_db),
    market_data_provider: MarketDataProvider = Depends(get_market_data_provider),
    risk_free_rate_provider: RiskFreeRateProvider = Depends(get_risk_free_rate_provider),
) -> MarginOfSafetyBoardOut:
    """Forces a real revalue (live price/FX/beta/risk-free-rate/share-count
    fetch, subject to each provider's own staleness cache) of every equity
    holding on the board — this is the slow path GET /board no longer
    takes on its own. "I want this now", same shape as every other
    .../refresh endpoint in the app."""
    require_not_demo(db)
    board = build_board(
        db,
        market_data_provider=market_data_provider,
        risk_free_rate_provider=risk_free_rate_provider,
        force_refresh=True,
    )
    return MarginOfSafetyBoardOut(
        rows=[BoardRowOut(**row.__dict__) for row in board.rows],
        total_equity_value_nok=board.total_equity_value_nok,
        zone_counts=board.zone_counts(),
    )
