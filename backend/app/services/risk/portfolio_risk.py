"""Sprint 12 orchestrator: wires price history, correlation, the
correlated-cluster flag, stress scenarios and regime classification into
one payload for GET /risk/portfolio (app/api/risk.py).

Reuses rather than reimplements (CLAUDE.md, and this sprint's brief):
position enumeration + weights come from
app/services/portfolio_overview.py's build_overview (same "currently
owned" rule, same NOK values), and DCF bear/base/price per holding come
from app/services/valuation/board.py's build_board (Sprint 5's
margin-of-safety board) — nothing here recomputes a DCF or a weight.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime
from decimal import Decimal

from sqlalchemy.orm import Session

from app.config.settings import get_settings
from app.domain.instrument_types import EQUITY_ANALYZABLE_TYPES
from app.providers.base import MarketDataProvider, RiskFreeRateProvider
from app.services.portfolio_overview import Overview, build_overview
from app.services.risk.correlation import (
    ClusterFlag,
    CorrelationResult,
    build_correlation_matrix,
    correlated_clusters,
)
from app.services.risk.price_history import TickerHistory, get_or_refresh_daily_history
from app.services.risk.regime import RegimeResult, classify_regime
from app.services.risk.stress import StressResult, compute_stress
from app.services.valuation.board import Board, build_board


@dataclass
class PortfolioRisk:
    as_of: datetime | None
    equity_value_nok: Decimal
    lookback_days: int
    correlation: CorrelationResult
    clusters: list[ClusterFlag]
    cluster_threshold: Decimal
    stress: StressResult
    regime: RegimeResult
    price_history_notes: list[str] = field(default_factory=list)


def build_portfolio_risk(
    db: Session,
    *,
    market_data_provider: MarketDataProvider,
    risk_free_rate_provider: RiskFreeRateProvider,
    force_refresh: bool = False,
) -> PortfolioRisk:
    settings = get_settings()
    lookback_days = settings.risk_correlation_lookback_days
    cluster_threshold = Decimal(settings.risk_cluster_correlation_threshold)
    std_devs = Decimal(settings.risk_stress_shock_std_devs)

    overview: Overview = build_overview(db)
    equity_positions = [p for p in overview.positions if p.instrument_type in EQUITY_ANALYZABLE_TYPES]

    histories: dict[str, TickerHistory] = {}
    notes: list[str] = []
    seen_tickers: set[str] = set()
    for p in equity_positions:
        if p.ticker in seen_tickers:
            continue
        seen_tickers.add(p.ticker)
        history = get_or_refresh_daily_history(
            db,
            market_data_provider,
            ticker=p.ticker,
            currency_hint=p.trading_currency,
            lookback_days=lookback_days,
            force=force_refresh,
        )
        histories[p.ticker] = history
        if history.reason:
            notes.append(f"{p.ticker}: {history.reason}")

    correlation = build_correlation_matrix(histories, lookback_days=lookback_days)

    top_holdings = sorted(
        ((p.ticker, p.name, p.weight_pct or Decimal(0)) for p in equity_positions),
        key=lambda t: -t[2],
    )
    clusters = correlated_clusters(top_holdings=top_holdings, correlation=correlation, threshold=cluster_threshold)

    board: Board = build_board(
        db, market_data_provider=market_data_provider, risk_free_rate_provider=risk_free_rate_provider
    )
    dcf_by_ticker: dict[str, tuple[Decimal | None, Decimal | None]] = {
        row.ticker: (row.price, row.bear) for row in board.rows
    }

    positions_for_stress = [
        (p.holding_id, p.ticker, p.name, p.value_nok or Decimal(0), p.weight_pct) for p in equity_positions
    ]
    stress = compute_stress(
        positions=positions_for_stress, histories=histories, dcf_by_ticker=dcf_by_ticker, std_devs=std_devs
    )

    regime = classify_regime(db)

    return PortfolioRisk(
        as_of=overview.as_of,
        equity_value_nok=overview.equity_value_nok,
        lookback_days=lookback_days,
        correlation=correlation,
        clusters=clusters,
        cluster_threshold=cluster_threshold,
        stress=stress,
        regime=regime,
        price_history_notes=notes,
    )
