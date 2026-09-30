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
    resolve_window,
)
from app.services.settings.demo_guard import require_not_demo
from app.services.settings.demo_mode import is_demo_mode
from app.services.settings.synthetic_data import demo_performance
from app.services.snapshots import get_or_build, performance_key

router = APIRouter(prefix="/performance", tags=["performance"])


def _day_out(dv: DailyValue | None) -> DailyValueOut | None:
    if dv is None:
        return None
    return DailyValueOut(
        on=dv.on, portfolio_value_nok=dv.portfolio_value_nok, partial=dv.partial,
        portfolio_return_pct=dv.portfolio_return_pct, daily_pnl_nok=dv.daily_pnl_nok,
        benchmark_return_pct=dv.benchmark_return_pct, real_return_pct=dv.real_return_pct,
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
        real_return_available=perf.real_return_available,
        real_return_reason=perf.real_return_reason,
        cpi_region=perf.cpi_region,
        excluded=[ExcludedHoldingOut(ticker=e.ticker, name=e.name, reason=e.reason) for e in perf.excluded],
        method_note=perf.method_note,
        real_return_note=perf.real_return_note,
        series=[_day_out(dv) for dv in perf.series],
    )


def build_performance_out(
    db: Session,
    market_data_provider: MarketDataProvider,
    lookback_days: int,
    benchmark_ticker: str,
    *,
    force_refresh: bool,
) -> PortfolioPerformanceOut:
    return _to_out(
        build_portfolio_performance(
            db,
            market_data_provider=market_data_provider,
            lookback_days=lookback_days,
            benchmark_ticker=benchmark_ticker,
            force_refresh=force_refresh,
            serve_stale=not force_refresh,
        )
    )


def _serve(
    db: Session,
    market_data_provider: MarketDataProvider,
    lookback_days: int | None,
    benchmark: str | None,
    *,
    refresh: bool,
) -> PortfolioPerformanceOut:
    lookback, bench = resolve_window(lookback_days, benchmark)
    return get_or_build(
        db,
        performance_key(lookback, bench),
        PortfolioPerformanceOut,
        lambda: build_performance_out(db, market_data_provider, lookback, bench, force_refresh=refresh),
        refresh=refresh,
    )


@router.get("/portfolio", response_model=PortfolioPerformanceOut)
def get_portfolio_performance(
    lookback_days: int | None = Query(default=None, ge=7, le=730),
    benchmark: str | None = Query(default=None),
    db: Session = Depends(get_db),
    market_data_provider: MarketDataProvider = Depends(get_market_data_provider),
) -> PortfolioPerformanceOut:
    """Stored snapshot when inputs are unchanged; else built from stored
    price history (no live Yahoo call for a ticker that has history)."""
    if is_demo_mode(db):
        return demo_performance()
    return _serve(db, market_data_provider, lookback_days, benchmark, refresh=False)


@router.post("/portfolio/refresh", response_model=PortfolioPerformanceOut)
def refresh_portfolio_performance(
    lookback_days: int | None = Query(default=None, ge=7, le=730),
    benchmark: str | None = Query(default=None),
    db: Session = Depends(get_db),
    market_data_provider: MarketDataProvider = Depends(get_market_data_provider),
) -> PortfolioPerformanceOut:
    require_not_demo(db)
    return _serve(db, market_data_provider, lookback_days, benchmark, refresh=True)
