"""Portfolio risk endpoints (Sprint 12) — correlation matrix, correlated-
cluster flags, drawdown/stress scenarios and macro regime, one payload per
GET /risk/portfolio. Mirrors app/api/valuation.py's shape: a GET serves a
result built from cached-where-possible data (app/services/risk/
price_history.py), a POST .../refresh forces a real re-fetch. Nothing here
ever 500s on a live-data failure — a ticker's price history or a macro
series being unavailable degrades just that part (see
app/services/risk/portfolio_risk.py) rather than failing the whole
response (CLAUDE.md: fail visibly, never silently).
"""
from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.config.database import get_db
from app.providers.base import MarketDataProvider, RiskFreeRateProvider
from app.providers.factory import get_market_data_provider, get_risk_free_rate_provider
from app.schemas.risk import (
    ClusterFlagOut,
    CorrelationOut,
    CorrelationPairOut,
    ExcludedOut,
    HoldingStressOut,
    PortfolioRiskOut,
    RegimeInputOut,
    RegimeOut,
    StressOut,
)
from app.services.risk.portfolio_risk import PortfolioRisk, build_portfolio_risk

router = APIRouter(prefix="/risk", tags=["risk"])


def _to_out(risk: PortfolioRisk) -> PortfolioRiskOut:
    return PortfolioRiskOut(
        as_of=risk.as_of,
        equity_value_nok=risk.equity_value_nok,
        lookback_days=risk.lookback_days,
        cluster_threshold=risk.cluster_threshold,
        correlation=CorrelationOut(
            lookback_days=risk.correlation.lookback_days,
            tickers=risk.correlation.tickers,
            pairs=[
                CorrelationPairOut(
                    ticker_a=p.ticker_a, ticker_b=p.ticker_b, correlation=p.correlation, overlap_days=p.overlap_days
                )
                for p in risk.correlation.pairs
            ],
            excluded=[ExcludedOut(key=e.ticker, reason=e.reason) for e in risk.correlation.excluded],
        ),
        clusters=[
            ClusterFlagOut(tickers=c.tickers, names=c.names, correlation=c.correlation, combined_weight_pct=c.combined_weight_pct)
            for c in risk.clusters
        ],
        stress=StressOut(
            std_devs=risk.stress.std_devs,
            horizon_note=risk.stress.horizon_note,
            portfolio_shock_pct=risk.stress.portfolio_shock_pct,
            portfolio_drawdown_nok=risk.stress.portfolio_drawdown_nok,
            total_value_considered_nok=risk.stress.total_value_considered_nok,
            holdings=[
                HoldingStressOut(
                    holding_id=str(h.holding_id), ticker=h.ticker, name=h.name, method=h.method,
                    value_nok=h.value_nok, weight_pct=h.weight_pct, shock_pct=h.shock_pct,
                    contribution_nok=h.contribution_nok, reason=h.reason,
                )
                for h in risk.stress.holdings
            ],
        ),
        regime=RegimeOut(
            regime=risk.regime.regime,
            home_market_series_included=risk.regime.home_market_series_included,
            curve_and_credit_are_us_only=risk.regime.curve_and_credit_are_us_only,
            explanation=risk.regime.explanation,
            method_note=risk.regime.method_note,
            inputs=[
                RegimeInputOut(
                    key=i.key, label=i.label, region=i.region, latest_value=i.latest_value,
                    smoothed_value=i.smoothed_value, unit=i.unit,
                )
                for i in risk.regime.inputs
            ],
            data_complete=risk.regime.data_complete,
            missing=risk.regime.missing,
        ),
        price_history_notes=risk.price_history_notes,
    )


@router.get("/portfolio", response_model=PortfolioRiskOut)
def get_portfolio_risk(
    db: Session = Depends(get_db),
    market_data_provider: MarketDataProvider = Depends(get_market_data_provider),
    risk_free_rate_provider: RiskFreeRateProvider = Depends(get_risk_free_rate_provider),
) -> PortfolioRiskOut:
    risk = build_portfolio_risk(
        db, market_data_provider=market_data_provider, risk_free_rate_provider=risk_free_rate_provider
    )
    return _to_out(risk)


@router.post("/portfolio/refresh", response_model=PortfolioRiskOut)
def refresh_portfolio_risk(
    db: Session = Depends(get_db),
    market_data_provider: MarketDataProvider = Depends(get_market_data_provider),
    risk_free_rate_provider: RiskFreeRateProvider = Depends(get_risk_free_rate_provider),
) -> PortfolioRiskOut:
    risk = build_portfolio_risk(
        db,
        market_data_provider=market_data_provider,
        risk_free_rate_provider=risk_free_rate_provider,
        force_refresh=True,
    )
    return _to_out(risk)
