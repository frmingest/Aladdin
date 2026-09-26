"""Deterministic financial calculations — CLAUDE.md Rule 1.

Every ratio, margin, and multiple the Buffett/Munger persona (Brain Steps
1.3, 2.1-2.2, 4) reasons over is computed here in plain Python, never by the
LLM. The analysis pipeline (a later sprint) hands the model these *results*
to interpret and cite; it never asks the model to do the arithmetic itself.

Conventions used throughout this module:
- All inputs/outputs are `Decimal`, not `float` — this handles real money
  and real filings; float's binary rounding error has no place here.
- A function raises `ValueError` when its result would be mathematically
  undefined (division by zero) rather than returning 0, None, or infinity —
  CLAUDE.md's "fail visibly, don't silently invent" applies to arithmetic
  as much as to data. Callers (the analysis pipeline) decide how to
  surface an undefined metric; this module never guesses on their behalf.
- A function does NOT reject a mathematically valid but unusual result
  (a negative margin, a negative ROE from negative equity, leverage above
  what's "normal") — flagging what a number *means* is the persona's job,
  computing it correctly is this module's job.
"""
from __future__ import annotations

import itertools
from collections.abc import Sequence
from decimal import Decimal

ZERO = Decimal(0)
HUNDRED = Decimal(100)


def _ratio(numerator: Decimal, denominator: Decimal, *, label: str) -> Decimal:
    if denominator == ZERO:
        raise ValueError(f"Cannot compute {label}: denominator is zero")
    return numerator / denominator


# --- Margins (Brain Step 1.3) -----------------------------------------------


def gross_margin(revenue: Decimal, cogs: Decimal) -> Decimal:
    """(revenue - cost of goods sold) / revenue."""
    return _ratio(revenue - cogs, revenue, label="gross margin")


def operating_margin(revenue: Decimal, operating_income: Decimal) -> Decimal:
    """operating income / revenue."""
    return _ratio(operating_income, revenue, label="operating margin")


def net_margin(revenue: Decimal, net_income: Decimal) -> Decimal:
    """net income / revenue."""
    return _ratio(net_income, revenue, label="net margin")


# --- Capital efficiency (Brain Step 1.3) ------------------------------------


def roic(nopat: Decimal, invested_capital: Decimal) -> Decimal:
    """Return on invested capital: NOPAT / invested capital.

    `invested_capital` is typically total debt + total equity - cash (the
    caller supplies this; this function doesn't derive it, to keep the
    definition explicit and testable rather than baked in silently).
    """
    return _ratio(nopat, invested_capital, label="ROIC")


def roe(net_income: Decimal, shareholders_equity: Decimal) -> Decimal:
    """Return on equity: net income / shareholders' equity."""
    return _ratio(net_income, shareholders_equity, label="ROE")


# --- Cash flow & earnings quality (Brain Step 2.1-2.2) ----------------------


def free_cash_flow(operating_cash_flow: Decimal, capex: Decimal) -> Decimal:
    """FCF = operating cash flow - capital expenditures."""
    return operating_cash_flow - capex


def owner_earnings(
    net_income: Decimal,
    depreciation_and_amortization: Decimal,
    capex: Decimal,
    working_capital_change: Decimal = ZERO,
) -> Decimal:
    """Buffett's owner earnings: net income + D&A - capex - Δworking capital.

    `working_capital_change` is the *increase* in working capital over the
    period (a use of cash, so it's subtracted) — pass 0 when unknown rather
    than omitting it, so every call site is explicit about the assumption.
    """
    return (
        net_income + depreciation_and_amortization - capex - working_capital_change
    )


# --- Balance-sheet health / financial fortress (Brain Step 2) --------------


def net_debt(total_debt: Decimal, cash_and_equivalents: Decimal) -> Decimal:
    """Net debt = total debt - cash and cash equivalents.

    Can be negative (a net-cash company) — that's a meaningful result, not
    an error.
    """
    return total_debt - cash_and_equivalents


def net_debt_to_ebitda(net_debt_value: Decimal, ebitda: Decimal) -> Decimal:
    return _ratio(net_debt_value, ebitda, label="Net Debt/EBITDA")


def net_debt_to_fcf(net_debt_value: Decimal, fcf: Decimal) -> Decimal:
    return _ratio(net_debt_value, fcf, label="Net Debt/FCF")


def interest_coverage(ebit: Decimal, interest_expense: Decimal) -> Decimal:
    """EBIT / interest expense — how many times over earnings cover interest."""
    return _ratio(ebit, interest_expense, label="interest coverage")


def debt_to_equity(total_debt: Decimal, shareholders_equity: Decimal) -> Decimal:
    return _ratio(total_debt, shareholders_equity, label="D/E")


# --- Valuation multiples (Brain Step 4) -------------------------------------


def price_to_earnings(price: Decimal, earnings_per_share: Decimal) -> Decimal:
    return _ratio(price, earnings_per_share, label="P/E")


def price_to_book(price: Decimal, book_value_per_share: Decimal) -> Decimal:
    return _ratio(price, book_value_per_share, label="P/B")


def price_to_sales(market_cap: Decimal, revenue: Decimal) -> Decimal:
    return _ratio(market_cap, revenue, label="P/S")


def ev_to_ebitda(enterprise_value: Decimal, ebitda: Decimal) -> Decimal:
    return _ratio(enterprise_value, ebitda, label="EV/EBITDA")


def enterprise_value(
    market_cap: Decimal, total_debt: Decimal, cash_and_equivalents: Decimal
) -> Decimal:
    """EV = market cap + total debt - cash and cash equivalents."""
    return market_cap + total_debt - cash_and_equivalents


# --- Portfolio concentration (Brain opening / portfolio roll-up) -----------


def herfindahl_hirschman_index(weights_pct: Sequence[Decimal]) -> Decimal:
    """HHI = sum of each holding's weight-in-percent, squared.

    Standard convention: weights are 0-100 (percent, matching
    `portfolio_positions.weight_pct`), so a fully concentrated one-holding
    portfolio scores 10000 and an infinitely diversified one approaches 0.
    Does not require weights to sum to exactly 100 — a caller passing a
    subset (e.g. one account) gets that subset's own concentration score.
    """
    if not weights_pct:
        raise ValueError("Cannot compute HHI: no weights given")
    return sum((w * w for w in weights_pct), start=ZERO)


# --- Portfolio risk: correlation, volatility (Sprint 12) --------------------


def daily_returns(closes: Sequence[Decimal]) -> list[Decimal]:
    """Simple (not log) day-over-day returns from a series of closing
    prices, oldest first: (p[i] - p[i-1]) / p[i-1]. One fewer value than
    the input. A zero or negative price in the series raises rather than
    silently skipping it — a bad price should be caught, not hidden inside
    an average."""
    if len(closes) < 2:
        raise ValueError("Cannot compute returns: need at least 2 prices")
    returns: list[Decimal] = []
    for prev, curr in itertools.pairwise(closes):
        if prev <= ZERO:
            raise ValueError(f"Cannot compute a return: non-positive price {prev}")
        returns.append((curr - prev) / prev)
    return returns


def mean(values: Sequence[Decimal]) -> Decimal:
    if not values:
        raise ValueError("Cannot compute mean: no values given")
    return sum(values, ZERO) / len(values)


def standard_deviation(values: Sequence[Decimal]) -> Decimal:
    """Sample standard deviation (n-1 denominator) — the usual convention
    for a historical-return volatility estimate. Needs at least 2 values."""
    if len(values) < 2:
        raise ValueError("Cannot compute standard deviation: need at least 2 values")
    m = mean(values)
    variance = sum(((v - m) ** 2 for v in values), ZERO) / (len(values) - 1)
    # Decimal has no native sqrt; float round-trip is fine for a volatility
    # estimate feeding a UI stress scenario, not a stored financial fact.
    return _decimal_sqrt(variance)


def _decimal_sqrt(value: Decimal) -> Decimal:
    if value < ZERO:
        raise ValueError("Cannot take the square root of a negative value")
    if value == ZERO:
        return ZERO
    return Decimal(str(float(value) ** 0.5))


def pearson_correlation(x: Sequence[Decimal], y: Sequence[Decimal]) -> Decimal:
    """Pearson correlation coefficient between two equal-length series
    (e.g. two holdings' daily returns over the same dates), in [-1, 1].

    Raises if the series differ in length, have fewer than 2 points, or
    either series has zero variance (a correlation with a constant series
    is undefined, not zero) — callers (app/services/risk/correlation.py)
    decide how to report "cannot be computed" for that pair.
    """
    if len(x) != len(y):
        raise ValueError(f"Cannot compute correlation: series lengths differ ({len(x)} vs {len(y)})")
    if len(x) < 2:
        raise ValueError("Cannot compute correlation: need at least 2 points")
    mx, my = mean(x), mean(y)
    cov = sum(((xi - mx) * (yi - my) for xi, yi in zip(x, y)), ZERO)
    var_x = sum(((xi - mx) ** 2 for xi in x), ZERO)
    var_y = sum(((yi - my) ** 2 for yi in y), ZERO)
    if var_x == ZERO or var_y == ZERO:
        raise ValueError("Cannot compute correlation: one series has zero variance")
    denom = _decimal_sqrt(var_x) * _decimal_sqrt(var_y)
    return cov / denom
