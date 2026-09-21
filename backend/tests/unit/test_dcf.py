"""Unit tests for app.services.valuation.dcf — CLAUDE.md Rule 1's
deterministic DCF/reverse-DCF/scenario arithmetic. Known-answer cases use
growth_rate == discount_rate deliberately: each explicit-year cash flow
then discounts to exactly its un-discounted base value (110/1.1 == 100),
which keeps the expected numbers hand-checkable instead of needing a
calculator to verify a decimal library's own division.
"""
from decimal import Decimal

import pytest

from app.services.valuation import dcf

D = Decimal


def test_project_cash_flows_known_answer():
    assert dcf.project_cash_flows(D("100"), D("0.10"), 3) == [D("110.00"), D("121.0000"), D("133.100000")]


def test_project_cash_flows_raises_on_zero_years():
    with pytest.raises(ValueError, match="years must be >= 1"):
        dcf.project_cash_flows(D("100"), D("0.10"), 0)


def test_terminal_value_known_answer():
    # 133.1 * 1.025 / (0.10 - 0.025) = 136.4275 / 0.075
    assert dcf.terminal_value(D("133.100000"), D("0.10"), D("0.025")) == D("1819.033333333333333333333333")


def test_terminal_value_raises_when_discount_rate_not_above_terminal_growth():
    with pytest.raises(ValueError, match="must exceed"):
        dcf.terminal_value(D("100"), D("0.02"), D("0.025"))


def test_terminal_value_raises_when_rates_equal():
    with pytest.raises(ValueError, match="must exceed"):
        dcf.terminal_value(D("100"), D("0.025"), D("0.025"))


def test_present_value_of_cash_flows_at_matching_growth_and_discount_rate():
    # Each year's flow discounts back to exactly its pre-growth value.
    flows = dcf.project_cash_flows(D("100"), D("0.10"), 3)
    assert dcf.present_value_of_cash_flows(flows, D("0.10")) == D("300")


def test_intrinsic_equity_value_known_answer():
    value = dcf.intrinsic_equity_value(
        base_owner_earnings=D("100"), growth_rate=D("0.10"), discount_rate=D("0.10"),
        terminal_growth_rate=D("0.025"), years=3,
    )
    assert value == D("1666.666666666666666666666666")


def test_intrinsic_value_per_share_divides_by_shares_outstanding():
    value = dcf.intrinsic_value_per_share(
        base_owner_earnings=D("100"), growth_rate=D("0.10"), discount_rate=D("0.10"),
        terminal_growth_rate=D("0.025"), years=3, shares_outstanding=D("10"),
    )
    assert value == D("166.6666666666666666666666666")


def test_intrinsic_value_per_share_raises_on_non_positive_shares():
    with pytest.raises(ValueError, match="shares_outstanding must be positive"):
        dcf.intrinsic_value_per_share(
            base_owner_earnings=D("100"), growth_rate=D("0.10"), discount_rate=D("0.10"),
            terminal_growth_rate=D("0.025"), years=3, shares_outstanding=D("0"),
        )


# --- scenarios -----------------------------------------------------------


def _base_kwargs() -> dict:
    return {
        "base_owner_earnings": D("100"),
        "base_growth_rate": D("0.10"),
        "discount_rate": D("0.10"),
        "terminal_growth_rate": D("0.025"),
        "years": 3,
        "shares_outstanding": D("10"),
        "bull_growth_offset": D("0.03"),
        "bear_growth_offset": D("0.03"),
    }


def test_dcf_scenarios_builds_bear_base_bull_around_the_offsets():
    result = dcf.dcf_scenarios(**_base_kwargs())
    labels = {s.label: s.growth_rate for s in result.scenarios}
    assert labels == {"bear": D("0.07"), "base": D("0.10"), "bull": D("0.13")}


def test_dcf_scenarios_bull_is_worth_more_than_base_is_worth_more_than_bear():
    result = dcf.dcf_scenarios(**_base_kwargs())
    bear = result.scenario("bear").intrinsic_value_per_share
    base = result.scenario("base").intrinsic_value_per_share
    bull = result.scenario("bull").intrinsic_value_per_share
    assert bear < base < bull


def test_dcf_scenarios_base_case_matches_the_known_answer():
    result = dcf.dcf_scenarios(**_base_kwargs())
    assert result.scenario("base").intrinsic_value_per_share == D("166.6666666666666666666666666")


def test_margin_of_safety_positive_when_price_below_intrinsic_value():
    result = dcf.dcf_scenarios(current_price_per_share=D("100"), **_base_kwargs())
    mos = result.margin_of_safety("base")
    assert mos is not None
    assert mos > D("0")


def test_margin_of_safety_negative_when_price_above_intrinsic_value():
    result = dcf.dcf_scenarios(current_price_per_share=D("500"), **_base_kwargs())
    mos = result.margin_of_safety("base")
    assert mos is not None
    assert mos < D("0")


def test_margin_of_safety_is_none_without_a_current_price():
    result = dcf.dcf_scenarios(**_base_kwargs())
    assert result.margin_of_safety("base") is None


def test_scenario_raises_on_unknown_label():
    result = dcf.dcf_scenarios(**_base_kwargs())
    with pytest.raises(KeyError):
        result.scenario("wild-guess")


# --- reverse DCF -----------------------------------------------------------


def test_reverse_dcf_recovers_the_growth_rate_used_to_build_the_price():
    known_price = dcf.intrinsic_value_per_share(
        base_owner_earnings=D("100"), growth_rate=D("0.10"), discount_rate=D("0.10"),
        terminal_growth_rate=D("0.025"), years=3, shares_outstanding=D("10"),
    )
    implied_growth = dcf.reverse_dcf_implied_growth(
        current_price_per_share=known_price, base_owner_earnings=D("100"),
        discount_rate=D("0.10"), terminal_growth_rate=D("0.025"), years=3,
        shares_outstanding=D("10"),
    )
    assert abs(implied_growth - D("0.10")) < D("0.0005")


def test_reverse_dcf_higher_price_implies_higher_growth():
    lower = dcf.reverse_dcf_implied_growth(
        current_price_per_share=D("100"), base_owner_earnings=D("100"),
        discount_rate=D("0.10"), terminal_growth_rate=D("0.025"), years=3,
        shares_outstanding=D("10"),
    )
    higher = dcf.reverse_dcf_implied_growth(
        current_price_per_share=D("200"), base_owner_earnings=D("100"),
        discount_rate=D("0.10"), terminal_growth_rate=D("0.025"), years=3,
        shares_outstanding=D("10"),
    )
    assert higher > lower


def test_reverse_dcf_raises_on_non_positive_price():
    with pytest.raises(ValueError, match="must be positive"):
        dcf.reverse_dcf_implied_growth(
            current_price_per_share=D("0"), base_owner_earnings=D("100"),
            discount_rate=D("0.10"), terminal_growth_rate=D("0.025"), years=3,
            shares_outstanding=D("10"),
        )


def test_reverse_dcf_raises_when_price_is_unjustifiable_by_any_growth_rate():
    with pytest.raises(ValueError, match="outside what any growth rate"):
        dcf.reverse_dcf_implied_growth(
            current_price_per_share=D("999999999"), base_owner_earnings=D("100"),
            discount_rate=D("0.10"), terminal_growth_rate=D("0.025"), years=3,
            shares_outstanding=D("10"),
        )
