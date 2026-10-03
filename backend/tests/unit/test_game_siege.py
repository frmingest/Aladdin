"""Siege Simulator maths and rules (game mode G13, 2026-10-03)."""
from __future__ import annotations

import uuid
from decimal import Decimal

import pytest

from app.domain.game_mapping.siege_scenarios_v1 import (
    SIEGE_SCENARIOS_V1,
    get_siege_scenarios,
)
from app.domain.game_mapping.v1 import GAME_MAPPING_V1 as M
from app.services.game.siege import SiegeHolding, holding_shock, simulate

D = Decimal
S = SIEGE_SCENARIOS_V1


def _h(ticker, value, beta, **kw):
    return SiegeHolding(
        holding_id=uuid.uuid4(), ticker=ticker, name=ticker, structure="keep", size_class="medium",
        wall="granite", value_nok=None if value is None else D(value),
        weight_pct=None, beta=None if beta is None else D(beta), **kw,
    )


def test_holding_shock_is_beta_times_fall_and_floored_at_total_loss():
    assert holding_shock(D("0.30"), D("1.0")) == D("-0.30")
    assert holding_shock(D("0.30"), D("0.5")) == D("-0.15")
    assert holding_shock(D("0.60"), D("2.0")) == D("-1")  # cannot lose more than everything
    assert holding_shock(D("0.60"), D("3.0")) == D("-1")


def test_negative_beta_gains_when_the_market_falls():
    assert holding_shock(D("0.20"), D("-0.5")) == D("0.10")


def test_portfolio_shock_is_value_weighted_over_modelled_holdings():
    r = simulate([_h("A", 600, "1.0"), _h("B", 400, "0.5")], D("0.20"), M, S)
    # A -20%, B -10% -> (-120 - 40) / 1000 = -16%
    assert r.portfolio_shock_pct == D("-0.1600")
    assert r.portfolio_loss_nok == D(-160)
    assert r.weighted_beta == D("0.80")
    assert r.level == "calm"
    assert r.coverage == D("1.0000")


@pytest.mark.parametrize(
    "drop,level",
    [("0.20", "calm"), ("0.25", "gathering"), ("0.30", "gathering"), ("0.39", "gathering"), ("0.40", "besieged"), ("0.60", "besieged")],
)
def test_level_thresholds_use_the_game_mapping_lines_at_beta_one(drop, level):
    # With beta 1 the book falls exactly as much as the market, so the lines are hit at 25% and 40%.
    r = simulate([_h("A", 1000, "1.0")], D(drop), M, S)
    assert r.level == level


def test_exposure_per_holding_uses_the_fortress_lines():
    r = simulate([_h("SHELT", 100, "0.5"), _h("EXPO", 100, "1.0"), _h("BREACH", 100, "2.0")], D("0.20"), M, S)
    by = {x.holding.ticker: x for x in r.holdings}
    assert by["SHELT"].exposure == "sheltered"   # -10%
    assert by["EXPO"].exposure == "exposed"      # -20% hits the 20% line
    assert by["BREACH"].exposure == "breach_risk"  # -40% hits the 40% line
    assert r.counts == {"sheltered": 1, "exposed": 1, "breach_risk": 1, "unmodelled": 0}


def test_unknown_beta_is_unmodelled_never_defaulted():
    r = simulate([_h("A", 800, "1.0"), _h("NOBETA", 200, None)], D("0.20"), M, S)
    nobeta = next(x for x in r.holdings if x.holding.ticker == "NOBETA")
    assert nobeta.modelled is False and nobeta.shock_pct is None and nobeta.loss_nok is None
    assert nobeta.exposure == "unsurveyed" and "no stored beta" in (nobeta.reason or "")
    assert r.coverage == D("0.8000")
    # the total covers the modelled 800 only: -20%
    assert r.portfolio_shock_pct == D("-0.2000")
    assert r.counts["unmodelled"] == 1
    assert r.holdings[-1].holding.ticker == "NOBETA"  # unmodelled sorts last


def test_coverage_below_the_floor_is_unsurveyed_not_a_number():
    r = simulate([_h("A", 400, "1.0"), _h("B", 600, None)], D("0.30"), M, S)  # 40% covered < 50%
    assert r.level == "unsurveyed"
    assert r.portfolio_shock_pct is None and r.portfolio_loss_nok is None
    assert r.drop_to_gathering is None and r.drop_to_besieged is None
    assert "40.0%" in r.level_reason and "50.0%" in r.level_reason


def test_coverage_exactly_at_the_floor_is_modelled():
    r = simulate([_h("A", 500, "1.0"), _h("B", 500, None)], D("0.30"), M, S)
    assert r.level == "gathering" and r.portfolio_shock_pct == D("-0.3000")


def test_no_holdings_and_no_values_are_unsurveyed():
    assert simulate([], D("0.2"), M, S).level == "unsurveyed"
    r = simulate([_h("A", None, "1.0"), _h("B", 0, "1.0")], D("0.2"), M, S)
    assert r.level == "unsurveyed" and r.coverage is None
    assert all(not x.modelled for x in r.holdings)


def test_reverse_search_finds_the_fall_that_reaches_each_line():
    r = simulate([_h("A", 1000, "1.0")], D("0.10"), M, S)
    assert r.drop_to_gathering == D("0.250")
    assert r.drop_to_besieged == D("0.400")
    assert "25.0%" in r.reach_note_gathering and "gathering" in r.reach_note_gathering


def test_reverse_search_scales_with_beta():
    r = simulate([_h("A", 1000, "0.5")], D("0.10"), M, S)
    assert r.drop_to_gathering == D("0.500")  # half the market's move: needs a 50% fall for -25%
    assert r.drop_to_besieged == D("0.800")


def test_reverse_search_is_none_when_a_line_is_never_reached():
    r = simulate([_h("A", 1000, "0.2")], D("0.10"), M, S)  # even -100% market = -20% < 25%
    assert r.drop_to_gathering is None and r.drop_to_besieged is None
    assert "No market fall up to 100%" in r.reach_note_gathering


def test_negative_weighted_beta_never_reaches_a_line():
    r = simulate([_h("GOLD", 1000, "-0.3")], D("0.30"), M, S)
    assert r.portfolio_shock_pct == D("0.0900")
    assert r.level == "calm" and r.drop_to_gathering is None


def test_simulation_does_not_mutate_inputs():
    items = [_h("A", 500, "1.0"), _h("B", 500, None)]
    before = [(h.ticker, h.value_nok, h.beta) for h in items]
    simulate(items, D("0.3"), M, S)
    assert [(h.ticker, h.value_nok, h.beta) for h in items] == before


def test_worst_hit_sorts_first():
    r = simulate([_h("SMALL", 100, "0.5"), _h("BIG", 900, "1.0"), _h("MID", 300, "1.0")], D("0.20"), M, S)
    assert [x.holding.ticker for x in r.holdings] == ["BIG", "MID", "SMALL"]


def test_scenarios_file_is_versioned_and_loader_rejects_unknown():
    assert get_siege_scenarios("v1") is SIEGE_SCENARIOS_V1
    with pytest.raises(ValueError):
        get_siege_scenarios("v9")
    assert S.drop_min <= S.drop_default <= S.drop_max
