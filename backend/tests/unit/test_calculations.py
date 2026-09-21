"""Unit tests for app.services.calculations — CLAUDE.md Rule 1's deterministic
arithmetic module. Every function is exercised with a known-answer case, a
division-by-zero case (must raise ValueError, never return 0/None/inf), and
at least one "unusual but valid" case (negative margin/equity) to confirm
the module computes rather than judges.
"""
from decimal import Decimal

import pytest

from app.services import calculations as calc

D = Decimal


# --- margins -----------------------------------------------------------


def test_gross_margin():
    assert calc.gross_margin(D("1000"), D("600")) == D("0.4")


def test_operating_margin():
    assert calc.operating_margin(D("1000"), D("150")) == D("0.15")


def test_net_margin():
    assert calc.net_margin(D("1000"), D("80")) == D("0.08")


def test_net_margin_negative_is_computed_not_rejected():
    assert calc.net_margin(D("1000"), D("-50")) == D("-0.05")


def test_margin_raises_on_zero_revenue():
    with pytest.raises(ValueError, match="gross margin"):
        calc.gross_margin(D("0"), D("100"))


# --- capital efficiency --------------------------------------------------


def test_roic():
    assert calc.roic(D("120"), D("1000")) == D("0.12")


def test_roe():
    assert calc.roe(D("80"), D("500")) == D("0.16")


def test_roe_with_negative_equity_is_computed_not_rejected():
    """A negative-equity ROE is meaningful (and alarming) — the persona
    interprets it, this module just computes it correctly."""
    assert calc.roe(D("50"), D("-100")) == D("-0.5")


def test_roic_raises_on_zero_invested_capital():
    with pytest.raises(ValueError, match="ROIC"):
        calc.roic(D("120"), D("0"))


# --- cash flow -----------------------------------------------------------


def test_free_cash_flow():
    assert calc.free_cash_flow(D("200"), D("50")) == D("150")


def test_owner_earnings():
    result = calc.owner_earnings(
        net_income=D("80"),
        depreciation_and_amortization=D("30"),
        capex=D("50"),
        working_capital_change=D("10"),
    )
    assert result == D("50")


def test_owner_earnings_defaults_working_capital_change_to_zero():
    result = calc.owner_earnings(
        net_income=D("80"), depreciation_and_amortization=D("30"), capex=D("50")
    )
    assert result == D("60")


# --- balance-sheet health --------------------------------------------------


def test_net_debt():
    assert calc.net_debt(D("300"), D("50")) == D("250")


def test_net_debt_can_be_negative_for_a_net_cash_company():
    assert calc.net_debt(D("50"), D("200")) == D("-150")


def test_net_debt_to_ebitda():
    assert calc.net_debt_to_ebitda(D("250"), D("125")) == D("2")


def test_net_debt_to_fcf():
    assert calc.net_debt_to_fcf(D("250"), D("125")) == D("2")


def test_interest_coverage():
    assert calc.interest_coverage(D("150"), D("30")) == D("5")


def test_interest_coverage_raises_on_zero_interest_expense():
    with pytest.raises(ValueError, match="interest coverage"):
        calc.interest_coverage(D("150"), D("0"))


def test_debt_to_equity():
    assert calc.debt_to_equity(D("300"), D("500")) == D("0.6")


# --- valuation multiples ---------------------------------------------------


def test_price_to_earnings():
    assert calc.price_to_earnings(D("100"), D("5")) == D("20")


def test_price_to_earnings_raises_on_zero_eps():
    with pytest.raises(ValueError, match="P/E"):
        calc.price_to_earnings(D("100"), D("0"))


def test_price_to_book():
    assert calc.price_to_book(D("100"), D("25")) == D("4")


def test_price_to_sales():
    assert calc.price_to_sales(D("2000"), D("1000")) == D("2")


def test_ev_to_ebitda():
    assert calc.ev_to_ebitda(D("1250"), D("125")) == D("10")


def test_enterprise_value():
    assert calc.enterprise_value(D("1000"), D("300"), D("50")) == D("1250")


def test_enterprise_value_feeds_ev_to_ebitda_end_to_end():
    ev = calc.enterprise_value(market_cap=D("1000"), total_debt=D("300"), cash_and_equivalents=D("50"))
    assert calc.ev_to_ebitda(ev, D("125")) == D("10")


# --- portfolio concentration (HHI) -----------------------------------------


def test_hhi_three_holdings():
    # 50^2 + 30^2 + 20^2 = 2500 + 900 + 400 = 3800
    assert calc.herfindahl_hirschman_index([D("50"), D("30"), D("20")]) == D("3800")


def test_hhi_fully_concentrated_single_holding():
    assert calc.herfindahl_hirschman_index([D("100")]) == D("10000")


def test_hhi_raises_on_empty_weights():
    with pytest.raises(ValueError, match="HHI"):
        calc.herfindahl_hirschman_index([])


def test_hhi_does_not_require_weights_to_sum_to_100():
    # A caller may legitimately pass a subset (e.g. one account's weights).
    assert calc.herfindahl_hirschman_index([D("10"), D("10")]) == D("200")
