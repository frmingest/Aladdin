"""CAPM cost of equity — the DCF discount rate (Sprint 3).

Equity DCF (discounting owner earnings at the cost of equity) rather than
FCFF at WACC — CAPM's cost of equity is exactly what that needs, and this
rebuild has no debt-structure/WACC model to build on yet.
"""
from __future__ import annotations

from decimal import Decimal


def cost_of_equity(
    *, risk_free_rate_pct: Decimal, beta: Decimal, equity_risk_premium: Decimal
) -> Decimal:
    """cost of equity = risk-free rate + beta * equity risk premium.

    `risk_free_rate_pct` is a PERCENTAGE (e.g. Decimal("4.25") for 4.25%,
    matching app/providers/base.py's RiskFreeRate.rate as FRED publishes
    it) — divided by 100 here, the one place that conversion happens.
    `beta` and `equity_risk_premium` are already fractions (see
    app/domain/valuation_assumptions/'s module docstring).
    """
    risk_free_rate = risk_free_rate_pct / Decimal(100)
    return risk_free_rate + beta * equity_risk_premium
