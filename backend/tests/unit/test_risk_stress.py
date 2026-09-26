"""Unit tests for app/services/risk/stress.py: DCF-bear-case sizing,
volatility-based sizing, and graceful handling of a holding with neither."""
import uuid
from datetime import date, timedelta
from decimal import Decimal

from app.services.risk.correlation import MIN_PRICE_POINTS
from app.services.risk.price_history import TickerHistory
from app.services.risk.stress import (
    METHOD_DCF_BEAR,
    METHOD_UNAVAILABLE,
    METHOD_VOLATILITY,
    compute_stress,
)

D = Decimal


def _history(ticker: str, closes: list[Decimal]) -> TickerHistory:
    start = date(2026, 1, 1)
    points = [(start + timedelta(days=i), c) for i, c in enumerate(closes)]
    return TickerHistory(ticker=ticker, available=True, currency="USD", points=points)


def test_holding_with_dcf_uses_bear_case_shock():
    holding_id = uuid.uuid4()
    positions = [(holding_id, "AAPL", "Apple", D("100000"), D("50"))]
    dcf_by_ticker = {"AAPL": (D("100"), D("70"))}  # price 100, bear case 70 -> -30%
    result = compute_stress(positions=positions, histories={}, dcf_by_ticker=dcf_by_ticker, std_devs=D("2"))

    row = result.holdings[0]
    assert row.method == METHOD_DCF_BEAR
    assert row.shock_pct == D("-0.3")
    assert row.contribution_nok == D("-30000")
    assert result.portfolio_shock_pct == D("-0.3")
    assert result.portfolio_drawdown_nok == D("-30000")


def test_holding_without_dcf_uses_volatility_shock():
    holding_id = uuid.uuid4()
    # Alternating +1%/-1% daily returns -> a known, nonzero stdev.
    closes = [D("100")]
    for i in range(MIN_PRICE_POINTS + 10):
        prev = closes[-1]
        closes.append(prev * D("1.01") if i % 2 == 0 else prev * D("0.99"))
    history = _history("FUND", closes)

    positions = [(holding_id, "FUND", "Index Fund", D("50000"), D("20"))]
    result = compute_stress(
        positions=positions, histories={"FUND": history}, dcf_by_ticker={}, std_devs=D("2")
    )

    row = result.holdings[0]
    assert row.method == METHOD_VOLATILITY
    assert row.shock_pct is not None
    assert row.shock_pct < 0  # a stress scenario is a loss, never a gain
    assert row.contribution_nok is not None
    assert row.contribution_nok < 0


def test_holding_with_neither_dcf_nor_history_is_unavailable_not_crashed():
    holding_id = uuid.uuid4()
    positions = [(holding_id, "NEWCO", "New Co", D("1000"), D("1"))]
    result = compute_stress(positions=positions, histories={}, dcf_by_ticker={}, std_devs=D("2"))

    row = result.holdings[0]
    assert row.method == METHOD_UNAVAILABLE
    assert row.shock_pct is None
    assert row.contribution_nok is None
    assert row.reason is not None
    # Excluded from the portfolio-level total, not coerced to a 0% shock.
    assert result.total_value_considered_nok == D("0")


def test_portfolio_drawdown_is_value_weighted_across_mixed_holdings():
    id_a, id_b = uuid.uuid4(), uuid.uuid4()
    positions = [
        (id_a, "AAPL", "Apple", D("80000"), D("80")),
        (id_b, "NEWCO", "New Co", D("20000"), D("20")),
    ]
    dcf_by_ticker = {"AAPL": (D("100"), D("80"))}  # -20%
    result = compute_stress(positions=positions, histories={}, dcf_by_ticker=dcf_by_ticker, std_devs=D("2"))

    # Only AAPL has a computable shock; NEWCO is excluded from the total.
    assert result.total_value_considered_nok == D("80000")
    assert result.portfolio_shock_pct == D("-0.2")
    assert result.portfolio_drawdown_nok == D("-16000")
