"""Fund look-through valuation maths: aggregate earnings yield, Gordon fair
P/E, coverage threshold, uncovered/loss-making lines, the price scale, and
the margin-of-safety convention."""
from __future__ import annotations

from decimal import Decimal

import pytest

from app.services.valuation.fund_look_through import (
    LookThroughUnavailable,
    compute_look_through,
    gordon_pe,
)

D = Decimal
KW = {"cost_of_equity": D("0.09"), "terminal_growth": D("0.025"), "bull_offset": D("0.03"), "bear_offset": D("0.03")}


def test_gordon_pe():
    assert gordon_pe(D("0.09"), D("0.025")) == D("1.025") / D("0.065")
    with pytest.raises(LookThroughUnavailable):
        gordon_pe(D("0.05"), D("0.05"))


def test_earnings_yield_is_the_weighted_harmonic_mean_and_value_scales_with_price():
    look = compute_look_through(constituents=[(D(50), D(20)), (D(50), D(10))], current_price=D(100), **KW)
    assert look.fund_earnings_yield == D("0.075")  # (2.5 + 5) / 100
    assert look.fund_pe.quantize(D("0.01")) == D("13.33")
    assert look.coverage_pct == D(100)
    base = look.scenario("base")
    assert base.fair_pe == D("1.025") / D("0.065")
    assert base.value_per_unit == D(100) * base.fair_pe * D("0.075")
    # doubling the price doubles the value: value = price x fair_pe x ey
    look2 = compute_look_through(constituents=[(D(50), D(20)), (D(50), D(10))], current_price=D(200), **KW)
    assert look2.scenario("base").value_per_unit == 2 * base.value_per_unit


def test_scenarios_order_bear_below_base_below_bull():
    look = compute_look_through(constituents=[(D(100), D(15))], current_price=D(50), **KW)
    bear, base, bull = (look.scenario(x).value_per_unit for x in ("bear", "base", "bull"))
    assert bear < base < bull
    assert look.scenario("bear").growth_rate == D("-0.005")


def test_margin_of_safety_convention():
    look = compute_look_through(constituents=[(D(100), D(15))], current_price=D(50), **KW)
    base = look.scenario("base").value_per_unit
    assert look.margin_of_safety("base") == (base - D(50)) / base


def test_uncovered_and_loss_making_lines_are_excluded_and_reduce_coverage():
    look = compute_look_through(
        constituents=[(D(60), D(20)), (D(20), None), (D(10), D(-5)), (D(10), D(10))], current_price=D(100), **KW
    )
    assert look.constituents_used == 2 and look.constituents_total == 4
    assert look.coverage_pct == D(70)  # (60 + 10) / 100
    assert look.fund_earnings_yield == (D(60) / D(20) + D(10) / D(10)) / D(70)


def test_low_coverage_is_withheld_not_extrapolated():
    with pytest.raises(LookThroughUnavailable, match="covers only 30%"):
        compute_look_through(constituents=[(D(30), D(12)), (D(70), None)], current_price=D(100), **KW)
    with pytest.raises(LookThroughUnavailable, match="no equity holdings"):
        compute_look_through(constituents=[], current_price=D(100), **KW)
    with pytest.raises(LookThroughUnavailable, match="no current price"):
        compute_look_through(constituents=[(D(100), D(12))], current_price=None, **KW)
