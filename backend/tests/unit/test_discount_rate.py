"""Unit tests for app.services.valuation.discount_rate — CAPM cost of
equity."""
from decimal import Decimal

from app.services.valuation import discount_rate

D = Decimal


def test_cost_of_equity_known_answer():
    # 4.25% risk-free (as FRED publishes it, a percentage) + 1.2 beta * 4.5% ERP
    # = 0.0425 + 0.054 = 0.0965.
    result = discount_rate.cost_of_equity(
        risk_free_rate_pct=D("4.25"), beta=D("1.2"), equity_risk_premium=D("0.045")
    )
    assert result == D("0.0965")


def test_cost_of_equity_at_market_beta():
    result = discount_rate.cost_of_equity(
        risk_free_rate_pct=D("4"), beta=D("1"), equity_risk_premium=D("0.05")
    )
    assert result == D("0.09")


def test_cost_of_equity_low_beta_reduces_premium():
    result = discount_rate.cost_of_equity(
        risk_free_rate_pct=D("4"), beta=D("0.5"), equity_risk_premium=D("0.05")
    )
    assert result == D("0.065")
