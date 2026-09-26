"""Drawdown / stress scenarios (Sprint 12). CLAUDE.md Rule 1: every shock
size here comes from real, already-computed data — never an invented
illustrative percentage.

Two sizing methods, chosen per holding (documented, not silently mixed):

- **DCF bear case** (app/services/valuation/dcf.py), when the holding has
  one: for a stock Faiz has actually analyzed, the Brain's own fundamental
  bear-case price is a more defensible "what could this be worth in a bad
  scenario" than a generic statistical shock — it reflects real
  company-specific downside (margin compression, growth stalling), not
  just historical price noise.
- **Historical volatility**, otherwise (funds/ETFs, which have no
  single-company DCF, or a stock whose DCF is unavailable): a shock of
  `risk_stress_shock_std_devs` (default 2) standard deviations of the
  holding's own daily-return distribution, scaled to a
  `STRESS_HORIZON_TRADING_DAYS` (20 trading days, ~1 calendar month)
  horizon via the standard sqrt-of-time scaling (sigma_T = sigma_daily *
  sqrt(T)) — a plain, well-known volatility-scaling convention, not a
  new invented model.

A holding with neither (no DCF and no usable price history) is reported
`unavailable` with a reason and excluded from the portfolio-level total,
never silently coerced to a 0% shock.
"""
from __future__ import annotations

import uuid
from dataclasses import dataclass, field
from decimal import Decimal

from app.services.calculations import ZERO, daily_returns, standard_deviation
from app.services.risk.price_history import TickerHistory

STRESS_HORIZON_TRADING_DAYS = 20
# Same floor as the correlation module (app/services/risk/correlation.py) —
# a volatility estimate below this many observations is too noisy to trust.
MIN_PRICE_POINTS = 30
METHOD_DCF_BEAR = "dcf_bear"
METHOD_VOLATILITY = "volatility"
METHOD_UNAVAILABLE = "unavailable"


@dataclass
class HoldingStress:
    holding_id: uuid.UUID
    ticker: str
    name: str
    method: str
    value_nok: Decimal
    weight_pct: Decimal | None
    shock_pct: Decimal | None = None  # fractional, negative = a loss
    contribution_nok: Decimal | None = None
    reason: str | None = None


@dataclass
class StressResult:
    std_devs: Decimal
    horizon_note: str
    portfolio_shock_pct: Decimal | None = None
    portfolio_drawdown_nok: Decimal | None = None
    total_value_considered_nok: Decimal = ZERO
    holdings: list[HoldingStress] = field(default_factory=list)


def _volatility_shock_pct(history: TickerHistory | None, std_devs: Decimal) -> Decimal | None:
    if history is None or not history.available:
        return None
    closes = [c for _, c in history.points]
    if len(closes) < MIN_PRICE_POINTS:
        return None
    try:
        returns = daily_returns(closes)
        sigma_daily = standard_deviation(returns)
    except ValueError:
        return None
    horizon_scale = Decimal(str(STRESS_HORIZON_TRADING_DAYS**0.5))
    return -(std_devs * sigma_daily * horizon_scale)


def compute_stress(
    *,
    positions: list[tuple[uuid.UUID, str, str, Decimal, Decimal | None]],
    histories: dict[str, TickerHistory],
    dcf_by_ticker: dict[str, tuple[Decimal | None, Decimal | None]],
    std_devs: Decimal,
) -> StressResult:
    result = StressResult(
        std_devs=std_devs,
        horizon_note=(
            f"{STRESS_HORIZON_TRADING_DAYS}-trading-day (~1 month) shock; volatility path uses "
            f"{std_devs} standard deviations of daily returns, scaled by sqrt({STRESS_HORIZON_TRADING_DAYS})"
        ),
    )

    for holding_id, ticker, name, value_nok, weight_pct in positions:
        row = HoldingStress(
            holding_id=holding_id, ticker=ticker, name=name, method=METHOD_UNAVAILABLE,
            value_nok=value_nok, weight_pct=weight_pct,
        )
        price, bear = dcf_by_ticker.get(ticker, (None, None))
        if price is not None and bear is not None and price > 0:
            row.method = METHOD_DCF_BEAR
            row.shock_pct = ((bear - price) / price).quantize(Decimal("0.0001"))
        else:
            shock = _volatility_shock_pct(histories.get(ticker), std_devs)
            if shock is not None:
                row.method = METHOD_VOLATILITY
                row.shock_pct = shock.quantize(Decimal("0.0001"))
            else:
                row.reason = "no DCF bear case and insufficient/unavailable daily price history"

        if row.shock_pct is not None and value_nok is not None:
            row.contribution_nok = (value_nok * row.shock_pct).quantize(Decimal(1))
        result.holdings.append(row)

    considered = [h for h in result.holdings if h.contribution_nok is not None]
    result.total_value_considered_nok = sum((h.value_nok for h in considered), ZERO)
    if considered and result.total_value_considered_nok > 0:
        total_contribution = sum((h.contribution_nok for h in considered), ZERO)
        result.portfolio_drawdown_nok = total_contribution
        result.portfolio_shock_pct = (total_contribution / result.total_value_considered_nok).quantize(
            Decimal("0.0001")
        )

    result.holdings.sort(key=lambda h: (h.contribution_nok if h.contribution_nok is not None else ZERO))
    return result
