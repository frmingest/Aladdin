"""Portfolio performance endpoints (Sprint 13) — daily value history and a
benchmark comparison, one payload per GET /performance/portfolio. Mirrors
app/api/risk.py's shape: a GET serves a result built from cached-where-
possible data (app/services/risk/price_history.py, reused as-is), a POST
.../refresh forces a real re-fetch. See
app/services/performance/portfolio_performance.py for the reindexing
method and its stated approximation.
"""
from __future__ import annotations

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.config.database import get_db
from app.providers.base import MarketDataProvider
from app.providers.factory import get_market_data_provider
from app.schemas.performance import (
    DailyValueOut,
    ExcludedHoldingOut,
    PortfolioPerformanceOut,
)
from app.services.performance.portfolio_performance import (
    DailyValue,
    PortfolioPerformance,
    build_portfolio_performance,
)

router = APIRouter(prefix="/performance", tags=["performance"])


def _day_out(dv: DailyValue | None) -> DailyValueOut | None:
    if dv is None:
        return None
    return DailyValueOut(
        on=dv.on, portfolio_value_nok=dv.portfolio_value_nok, partial=dv.partial,
        portfolio_return_pct=dv.portfolio_return_pct, daily_pnl_nok=dv.daily_pnl_nok,
        benchmark_return_pct=dv.benchmark_return_pct,
    )


def _to_out(perf: PortfolioPerformance) -> PortfolioPerformanceOut:
    return PortfolioPerformanceOut(
        as_of=perf.as_of,
        lookback_days=perf.lookback_days,
        equity_value_nok=perf.equity_value_nok,
        included_value_nok=perf.included_value_nok,
        covered_pct=perf.covered_pct,
        full_coverage_from=perf.full_coverage_from,
        starting_value_nok=perf.starting_value_nok,
        ending_value_nok=perf.ending_value_nok,
        total_return_pct=perf.total_return_pct,
        best_day=_day_out(perf.best_day),
        worst_day=_day_out(perf.worst_day),
        benchmark_ticker=perf.benchmark_ticker,
        benchmark_available=perf.benchmark_available,
        benchmark_reason=perf.benchmark_reason,
        excluded=[ExcludedHoldingOut(ticker=e.ticker, name=e.name, reason=e.reason) for e in perf.excluded],
        method_note=perf.method_note,
        series=[_day_out(dv) for dv in perf.series],
    )


@router.get("/portfolio", response_model=PortfolioPerformanceOut)
def get_portfolio_performance(
    lookback_days: int | None = Query(default=None, ge=7, le=730),
    benchmark: str | None = Query(default=None),
    db: Session = Depends(get_db),
    market_data_provider: MarketDataProvider = Depends(get_market_data_provider),
) -> PortfolioPerformanceOut:
    perf = build_portfolio_performance(
        db, market_data_provider=market_data_provider, lookback_days=lookback_days, benchmark_ticker=benchmark,
    )
    return _to_out(perf)


@router.post("/portfolio/refresh", response_model=PortfolioPerformanceOut)
def refresh_portfolio_performance(
    lookback_days: int | None = Query(default=None, ge=7, le=730),
    benchmark: str | None = Query(default=None),
    db: Session = Depends(get_db),
    market_data_provider: MarketDataProvider = Depends(get_market_data_provider),
) -> PortfolioPerformanceOut:
    perf = build_portfolio_performance(
        db, market_data_provider=market_data_provider, lookback_days=lookback_days, benchmark_ticker=benchmark,
        force_refresh=True,
    )
    return _to_out(perf)
