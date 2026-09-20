from decimal import Decimal

from app.domain import calculations as calc


def D(s):
    return Decimal(s)


# --- growth / margins / returns --------------------------------------------


def test_growth_rate_basic():
    assert calc.growth_rate(D("110"), D("100")) == D("10")


def test_growth_rate_handles_decline():
    assert calc.growth_rate(D("80"), D("100")) == D("-20")


def test_growth_rate_none_on_missing_or_zero_base():
    assert calc.growth_rate(None, D("100")) is None
    assert calc.growth_rate(D("100"), None) is None
    assert calc.growth_rate(D("100"), D("0")) is None


def test_margin_pct_basic():
    assert calc.margin_pct(D("25"), D("100")) == D("25")


def test_margin_pct_none_on_zero_denominator():
    assert calc.margin_pct(D("25"), D("0")) is None


def test_roic_and_roe_are_margin_shaped():
    assert calc.return_on_invested_capital(D("15"), D("100")) == D("15")
    assert calc.return_on_equity(D("20"), D("200")) == D("10")


def test_dividend_yield_basic():
    assert calc.dividend_yield(D("5"), D("100")) == D("5")


def test_dividend_yield_none_on_zero_or_negative_price():
    assert calc.dividend_yield(D("5"), D("0")) is None
    assert calc.dividend_yield(D("5"), D("-10")) is None


def test_dividend_yield_none_on_negative_dividend():
    assert calc.dividend_yield(D("-1"), D("100")) is None


# --- owner earnings / cash generation --------------------------------------


def test_free_cash_flow_basic():
    assert calc.free_cash_flow(D("500"), D("120")) == D("380")


def test_free_cash_flow_none_on_missing_input():
    assert calc.free_cash_flow(None, D("120")) is None
    assert calc.free_cash_flow(D("500"), None) is None


def test_average_over_periods_basic():
    assert calc.average_over_periods([D("10"), D("20"), D("30")]) == D("20")


def test_average_over_periods_skips_none_rather_than_treating_as_zero():
    # Two real periods (15, 25) averaging to 20 -- a missing third period
    # must not silently drag this down to (15+25+0)/3.
    assert calc.average_over_periods([D("15"), None, D("25")]) == D("20")


def test_average_over_periods_none_when_nothing_usable():
    assert calc.average_over_periods([None, None]) is None
    assert calc.average_over_periods([]) is None


# --- valuation multiples -----------------------------------------------


def test_ratio_basic():
    assert calc.ratio(D("50"), D("10")) == D("5")


def test_ratio_none_on_non_positive_denominator():
    assert calc.ratio(D("50"), D("0")) is None
    assert calc.ratio(D("50"), D("-10")) is None


def test_net_debt():
    assert calc.net_debt(D("500"), D("120")) == D("380")


def test_net_debt_none_on_missing_input():
    assert calc.net_debt(None, D("120")) is None


# --- FX ----------------------------------------------------------------


def test_convert_currency():
    assert calc.convert_currency(D("100"), D("10.5")) == D("1050.0")


def test_convert_currency_none_on_missing_input():
    assert calc.convert_currency(None, D("10.5")) is None
    assert calc.convert_currency(D("100"), None) is None


# --- P&L -----------------------------------------------------------------


def test_unrealized_pnl():
    assert calc.unrealized_pnl(D("1200"), D("1000")) == D("200")


def test_unrealized_pnl_pct():
    assert calc.unrealized_pnl_pct(D("1200"), D("1000")) == D("20")


def test_unrealized_pnl_pct_none_on_non_positive_cost_basis():
    assert calc.unrealized_pnl_pct(D("1200"), D("0")) is None
    assert calc.unrealized_pnl_pct(D("1200"), D("-100")) is None


# --- concentration -------------------------------------------------------


def test_hhi_fully_concentrated():
    # One holding at 100% -> HHI = 100^2 = 10000 (max possible).
    assert calc.herfindahl_hirschman_index([D("100")]) == D("10000")


def test_hhi_evenly_split():
    weights = [D("25"), D("25"), D("25"), D("25")]
    assert calc.herfindahl_hirschman_index(weights) == D("2500")


def test_hhi_none_on_empty_input():
    assert calc.herfindahl_hirschman_index([]) is None


def test_largest_weight_pct():
    assert calc.largest_weight_pct([D("10"), D("55"), D("35")]) == D("55")


def test_largest_weight_pct_none_on_empty_input():
    assert calc.largest_weight_pct([]) is None


def test_weights_by_group_basic():
    values = {"NOK": D("120000"), "USD": D("30000")}
    weights = calc.weights_by_group(values)
    assert weights["NOK"] == D("80")
    assert weights["USD"] == D("20")


def test_weights_by_group_uses_explicit_total_when_given():
    # Groups present here don't cover the whole portfolio (e.g. some
    # holdings were excluded from valuation) — passing a larger total
    # should scale weights down accordingly rather than to 100%.
    values = {"NOK": D("50")}
    weights = calc.weights_by_group(values, total=D("200"))
    assert weights["NOK"] == D("25")


def test_weights_by_group_empty_on_non_positive_total():
    assert calc.weights_by_group({"NOK": D("100")}, total=D("0")) == {}
    assert calc.weights_by_group({}) == {}
