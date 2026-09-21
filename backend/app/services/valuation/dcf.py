"""Deterministic DCF, reverse DCF, and base/bull/bear scenario
construction (Sprint 3 — Brain Step 4).

Equity DCF: projects owner earnings (app/services/calculations.py's
Buffett-style owner_earnings, not raw net income) forward at a growth
rate, discounts each year plus a Gordon-growth terminal value back to
present at the cost of equity (discount_rate.py), and divides by shares
outstanding for a per-share intrinsic value. CLAUDE.md Rule 1: every
number here is plain arithmetic; the growth rate, discount rate, and
terminal growth rate are all supplied by the caller (growth.py,
discount_rate.py, app/domain/valuation_assumptions/) — nothing in this
module invents an assumption of its own.
"""
from __future__ import annotations

from dataclasses import dataclass
from decimal import Decimal

ZERO = Decimal(0)
ONE = Decimal(1)


def project_cash_flows(base_value: Decimal, growth_rate: Decimal, years: int) -> list[Decimal]:
    """`years` future values of `base_value` compounding at `growth_rate`,
    nearest year first (index 0 = year 1)."""
    if years < 1:
        raise ValueError("Cannot project cash flows: years must be >= 1")
    flows: list[Decimal] = []
    value = base_value
    for _ in range(years):
        value = value * (ONE + growth_rate)
        flows.append(value)
    return flows


def terminal_value(
    final_year_cash_flow: Decimal, discount_rate: Decimal, terminal_growth_rate: Decimal
) -> Decimal:
    """Gordon-growth terminal value, valued as of the end of the final
    projected year (not yet discounted back to present — the caller does
    that, since it needs the same `years` used for the explicit
    projection)."""
    spread = discount_rate - terminal_growth_rate
    if spread <= ZERO:
        raise ValueError(
            f"Cannot compute terminal value: discount rate ({discount_rate}) must exceed "
            f"terminal growth rate ({terminal_growth_rate})"
        )
    return final_year_cash_flow * (ONE + terminal_growth_rate) / spread


def present_value_of_cash_flows(cash_flows: list[Decimal], discount_rate: Decimal) -> Decimal:
    """Sum of each cash flow (index 0 = year 1) discounted back to present
    at `discount_rate`."""
    total = ZERO
    for year, flow in enumerate(cash_flows, start=1):
        total += flow / (ONE + discount_rate) ** year
    return total


def intrinsic_equity_value(
    *,
    base_owner_earnings: Decimal,
    growth_rate: Decimal,
    discount_rate: Decimal,
    terminal_growth_rate: Decimal,
    years: int,
) -> Decimal:
    """Total intrinsic equity value (not per-share) — present value of the
    explicit projection plus the discounted terminal value."""
    cash_flows = project_cash_flows(base_owner_earnings, growth_rate, years)
    pv_flows = present_value_of_cash_flows(cash_flows, discount_rate)
    tv = terminal_value(cash_flows[-1], discount_rate, terminal_growth_rate)
    pv_terminal = tv / (ONE + discount_rate) ** years
    return pv_flows + pv_terminal


def intrinsic_value_per_share(
    *,
    base_owner_earnings: Decimal,
    growth_rate: Decimal,
    discount_rate: Decimal,
    terminal_growth_rate: Decimal,
    years: int,
    shares_outstanding: Decimal,
) -> Decimal:
    if shares_outstanding <= ZERO:
        raise ValueError("Cannot compute per-share value: shares_outstanding must be positive")
    total = intrinsic_equity_value(
        base_owner_earnings=base_owner_earnings,
        growth_rate=growth_rate,
        discount_rate=discount_rate,
        terminal_growth_rate=terminal_growth_rate,
        years=years,
    )
    return total / shares_outstanding


@dataclass(frozen=True)
class DCFScenario:
    label: str  # "bear" | "base" | "bull"
    growth_rate: Decimal
    intrinsic_value_per_share: Decimal


@dataclass(frozen=True)
class DCFScenarioResult:
    scenarios: list[DCFScenario]
    discount_rate: Decimal
    terminal_growth_rate: Decimal
    current_price_per_share: Decimal | None = None

    def scenario(self, label: str) -> DCFScenario:
        for candidate in self.scenarios:
            if candidate.label == label:
                return candidate
        raise KeyError(f"No {label!r} scenario in this result")

    def margin_of_safety(self, label: str) -> Decimal | None:
        """(intrinsic - price) / intrinsic for the named scenario — the
        Brain's Step 4 "margin of safety". None when no current price was
        supplied (app/services/market_data/ couldn't get one) or the
        scenario's intrinsic value is exactly zero."""
        if self.current_price_per_share is None:
            return None
        value = self.scenario(label).intrinsic_value_per_share
        if value == ZERO:
            return None
        return (value - self.current_price_per_share) / value


def dcf_scenarios(
    *,
    base_owner_earnings: Decimal,
    base_growth_rate: Decimal,
    discount_rate: Decimal,
    terminal_growth_rate: Decimal,
    years: int,
    shares_outstanding: Decimal,
    bull_growth_offset: Decimal,
    bear_growth_offset: Decimal,
    current_price_per_share: Decimal | None = None,
) -> DCFScenarioResult:
    """Base/bull/bear intrinsic per-share values around one
    deterministically-computed base-case growth rate
    (app/services/valuation/growth.py's historical_cagr) plus versioned
    offsets (app/domain/valuation_assumptions/) — not three independent
    forecasts."""
    scenario_growth = {
        "bear": base_growth_rate - bear_growth_offset,
        "base": base_growth_rate,
        "bull": base_growth_rate + bull_growth_offset,
    }
    scenarios = [
        DCFScenario(
            label=label,
            growth_rate=growth_rate,
            intrinsic_value_per_share=intrinsic_value_per_share(
                base_owner_earnings=base_owner_earnings,
                growth_rate=growth_rate,
                discount_rate=discount_rate,
                terminal_growth_rate=terminal_growth_rate,
                years=years,
                shares_outstanding=shares_outstanding,
            ),
        )
        for label, growth_rate in scenario_growth.items()
    ]
    return DCFScenarioResult(
        scenarios=scenarios,
        discount_rate=discount_rate,
        terminal_growth_rate=terminal_growth_rate,
        current_price_per_share=current_price_per_share,
    )


_REVERSE_DCF_LOW_GROWTH = Decimal("-0.5")
_REVERSE_DCF_HIGH_GROWTH = Decimal("2.0")


def reverse_dcf_implied_growth(
    *,
    current_price_per_share: Decimal,
    base_owner_earnings: Decimal,
    discount_rate: Decimal,
    terminal_growth_rate: Decimal,
    years: int,
    shares_outstanding: Decimal,
    tolerance: Decimal = Decimal("0.0001"),
    max_iterations: int = 100,
) -> Decimal:
    """The constant explicit-period growth rate that makes
    intrinsic_value_per_share equal `current_price_per_share` — solved by
    bisection, since a multi-year DCF plus terminal value has no closed
    form. `intrinsic_value_per_share` is strictly increasing in
    growth_rate (holding everything else fixed), so bisection is safe.

    The search range (-50% to +200% explicit-period growth) is wide but
    bounded: a real implied growth rate outside that range means the
    current price itself is making an extraordinary claim, which is worth
    surfacing as "could not solve" (ValueError) rather than an answer
    nobody should trust.
    """
    if current_price_per_share <= ZERO:
        raise ValueError("Cannot reverse-solve DCF: current_price_per_share must be positive")

    def value_at(growth_rate: Decimal) -> Decimal:
        return intrinsic_value_per_share(
            base_owner_earnings=base_owner_earnings,
            growth_rate=growth_rate,
            discount_rate=discount_rate,
            terminal_growth_rate=terminal_growth_rate,
            years=years,
            shares_outstanding=shares_outstanding,
        )

    low, high = _REVERSE_DCF_LOW_GROWTH, _REVERSE_DCF_HIGH_GROWTH
    low_value, high_value = value_at(low), value_at(high)

    if not (low_value <= current_price_per_share <= high_value):
        raise ValueError(
            "Cannot reverse-solve DCF: current price is outside what any growth rate in "
            f"[{low}, {high}] would justify (implied value range: {low_value} to {high_value})"
        )

    for _ in range(max_iterations):
        mid = (low + high) / Decimal(2)
        mid_value = value_at(mid)
        if abs(mid_value - current_price_per_share) <= tolerance * current_price_per_share:
            return mid
        if mid_value < current_price_per_share:
            low = mid
        else:
            high = mid
    return (low + high) / Decimal(2)
