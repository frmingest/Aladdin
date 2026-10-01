"""Boundary tests for the game-mode rules (app/services/game/rules.py).

Every threshold in app/domain/game_mapping/v1.py is exercised on both sides
of its edge, because these numbers decide what Faiz sees about real holdings.
"""
from __future__ import annotations

from datetime import datetime, timedelta, timezone
from decimal import Decimal

import pytest

from app.domain.game_mapping import get_game_mapping
from app.services.game import rules
from app.services.game.rules import WallFacts

D = Decimal
M = get_game_mapping("v1")
NOW = datetime(2026, 10, 1, tzinfo=timezone.utc)


def _wall(net_debt, ebitda, cover=None, *, financial=False):
    return rules.wall_for_stock(
        WallFacts(period="FY2025", net_debt=D(net_debt), ebitda=D(ebitda) if ebitda is not None else None,
                  interest_coverage=D(cover) if cover is not None else None),
        financial=financial, mapping=M,
    )


def test_unknown_mapping_version_is_an_error():
    with pytest.raises(ValueError):
        get_game_mapping("v99")


def test_net_cash_is_basalt_even_without_ebitda():
    wall, reason, _ = _wall("-1", None)
    assert wall == "basalt" and "net cash" in reason


def test_zero_net_debt_counts_as_net_cash():
    assert _wall("0", "100")[0] == "basalt"


@pytest.mark.parametrize(
    ("net_debt", "ebitda", "expected"),
    [
        ("100", "100", "granite"),    # exactly 1.0x
        ("101", "100", "brick"),      # just over 1.0x
        ("250", "100", "brick"),      # exactly 2.5x
        ("251", "100", "timber"),
        ("400", "100", "timber"),     # exactly 4.0x
        ("401", "100", "rotted"),
    ],
)
def test_leverage_tiers_at_their_edges(net_debt, ebitda, expected):
    assert _wall(net_debt, ebitda)[0] == expected


def test_debt_with_non_positive_ebitda_is_rotted():
    assert _wall("10", "0")[0] == "rotted"
    assert _wall("10", "-5")[0] == "rotted"


def test_debt_without_ebitda_is_unsurveyed_not_guessed():
    wall, reason, _ = _wall("10", None)
    assert wall == "unsurveyed" and reason


def test_weak_interest_cover_drops_one_tier():
    wall, reason, inputs = _wall("100", "100", "2.9")   # granite -> brick
    assert wall == "brick" and "one tier weaker" in reason
    assert inputs["interest_coverage"] == D("2.9")


def test_interest_cover_at_the_limit_does_not_drop_a_tier():
    assert _wall("100", "100", "3")[0] == "granite"


def test_weak_cover_cannot_go_below_rotted():
    assert _wall("500", "100", "1")[0] == "rotted"


def test_basalt_is_not_downgraded_by_cover():
    assert _wall("-100", "100", "0.5")[0] == "basalt"


def test_missing_facts_object_is_unsurveyed():
    wall, reason, inputs = rules.wall_for_stock(None, financial=False, mapping=M)
    assert wall == "unsurveyed" and inputs == {} and "no financial statements" in reason


def test_missing_net_debt_uses_the_stored_reason():
    facts = WallFacts(period="FY2025", missing_reason="missing: cash_and_equivalents")
    wall, reason, _ = rules.wall_for_stock(facts, financial=False, mapping=M)
    assert wall == "unsurveyed" and reason == "missing: cash_and_equivalents"


@pytest.mark.parametrize(
    ("equity", "assets", "expected"),
    [
        ("10", "100", "granite"),   # exactly 10%
        ("9.9", "100", "brick"),
        ("7", "100", "brick"),      # exactly 7%
        ("6.9", "100", "timber"),
        ("5", "100", "timber"),     # exactly 5%
        ("4.9", "100", "rotted"),
    ],
)
def test_financial_walls_use_equity_to_assets(equity, assets, expected):
    facts = WallFacts(period="FY2025", total_equity=D(equity), total_assets=D(assets))
    assert rules.wall_for_stock(facts, financial=True, mapping=M)[0] == expected


def test_financials_never_get_basalt_and_ignore_net_debt():
    facts = WallFacts(period="FY2025", net_debt=D("-1000"), total_equity=D("90"), total_assets=D("100"))
    wall, _, inputs = rules.wall_for_stock(facts, financial=True, mapping=M)
    assert wall == "granite" and "net_debt" not in inputs


def test_financial_without_balance_sheet_is_unsurveyed():
    facts = WallFacts(period="FY2025")
    assert rules.wall_for_stock(facts, financial=True, mapping=M)[0] == "unsurveyed"
    zero = WallFacts(period="FY2025", total_equity=D(1), total_assets=D(0))
    assert rules.wall_for_stock(zero, financial=True, mapping=M)[0] == "unsurveyed"


@pytest.mark.parametrize(
    ("weight", "expected"),
    [(None, "unknown"), ("15", "great"), ("14.99", "medium"), ("7", "medium"),
     ("6.99", "small"), ("3", "small"), ("2.99", "tiny"), ("0", "tiny")],
)
def test_size_class_edges(weight, expected):
    assert rules.size_class(D(weight) if weight is not None else None, M) == expected


@pytest.mark.parametrize(
    ("days", "expected"),
    [(0, "fresh"), (90, "fresh"), (91, "weathered"), (180, "weathered"), (181, "overgrown")],
)
def test_freshness_edges_match_the_dashboard_stale_rule(days, expected):
    label, age = rules.freshness(NOW - timedelta(days=days), NOW, M, analyzable=True)
    assert (label, age) == (expected, days)


def test_freshness_without_a_run_and_for_non_analyzable():
    assert rules.freshness(None, NOW, M, analyzable=True) == ("unsurveyed", None)
    assert rules.freshness(NOW, NOW, M, analyzable=False) == ("not_applicable", None)


def test_freshness_accepts_naive_timestamps_as_utc():
    naive = (NOW - timedelta(days=10)).replace(tzinfo=None)
    assert rules.freshness(naive, NOW, M, analyzable=True) == ("fresh", 10)


def test_moat_tiers():
    assert rules.moat_tier("Wide", analyzable=True) == "wide"
    assert rules.moat_tier("Narrow", analyzable=True) == "narrow"
    assert rules.moat_tier("None", analyzable=True) == "none"
    assert rules.moat_tier(None, analyzable=True) == "unsurveyed"
    assert rules.moat_tier("Wide", analyzable=False) == "not_applicable"


def test_structures_by_instrument_type():
    assert rules.structure_for("stock") == "keep"
    assert rules.structure_for("equity_etf") == "outpost"
    assert rules.structure_for("equity_fund") == "outpost"
    assert rules.structure_for("commodity_etc") == "bullion"
    assert rules.structure_for("bond_fund") == "granary"
    assert rules.structure_for("money_market_fund") == "granary"


def test_non_stock_walls_are_not_applicable():
    for kind in ("equity_etf", "commodity_etc", "bond_fund"):
        wall, reason = rules.wall_for_non_stock(kind)
        assert wall == "not_applicable" and reason


@pytest.mark.parametrize(
    ("weights", "shacks", "level"),
    [
        ([D(50), D(50)], 0, "none"),
        ([D("1.9"), D(98)], 1, "none"),
        ([D("1.9"), D("1"), D(97)], 2, "light"),
        ([D("1")] * 4 + [D(96)], 4, "light"),
        ([D("1")] * 5 + [D(95)], 5, "heavy"),
        ([D("2")] * 6, 0, "none"),   # exactly 2% is not a shack
        ([None, D("1")], 1, "none"),
    ],
)
def test_shantytown_levels(weights, shacks, level):
    assert rules.shantytown(weights, M) == (shacks, level)


@pytest.mark.parametrize(
    ("cash", "portfolio", "level"),
    [
        (None, "100", "unsurveyed"),
        ("20", "80", "deep"),       # exactly 20%
        ("19", "81", "stocked"),
        ("10", "90", "stocked"),    # exactly 10%
        ("9", "91", "thin"),
        ("3", "97", "thin"),        # exactly 3%
        ("2", "98", "empty"),
        ("0", "100", "empty"),
    ],
)
def test_vault_levels(cash, portfolio, level):
    got, share = rules.vault_level(D(cash) if cash is not None else None, D(portfolio), M)
    assert got == level
    assert (share is None) == (cash is None)


def test_vault_with_nothing_at_all_is_empty_not_unsurveyed():
    assert rules.vault_level(D(0), D(0), M) == ("empty", D(0))


# --- G4: sieges, land for sale, breaches --------------------------------------


def _risk(regime="baseline", shock=None, complete=True, **kw):
    return rules.RiskFacts(
        regime=regime, regime_data_complete=complete,
        portfolio_shock_pct=D(shock) if shock is not None else None, **kw,
    )


def test_no_stored_risk_snapshot_is_unsurveyed_never_calm():
    level, reasons = rules.siege_level(None, M)
    assert level == "unsurveyed" and "no stored" in reasons[0]


def test_risk_snapshot_with_neither_regime_nor_stress_is_unsurveyed():
    assert rules.siege_level(_risk(regime=None, shock=None), M)[0] == "unsurveyed"


@pytest.mark.parametrize(
    ("regime", "shock", "expected"),
    [
        ("baseline", "-0.10", "calm"),
        ("baseline", "-0.2499", "calm"),          # just inside the gathering edge
        ("baseline", "-0.25", "gathering"),       # exactly at the edge
        ("baseline", "-0.3999", "gathering"),
        ("baseline", "-0.40", "besieged"),        # exactly at the edge
        ("baseline", "-0.80", "besieged"),
        ("stagflation", "-0.05", "gathering"),    # regime alone is enough
        ("stagflation", "-0.40", "besieged"),     # the worse signal wins
        ("crisis", "-0.01", "besieged"),
        ("crisis", None, "besieged"),
        ("baseline", None, "calm"),               # one known input, no warning sign
        (None, "-0.30", "gathering"),             # regime unknown, stress known
        (None, "-0.10", "calm"),
    ],
)
def test_siege_level_boundaries(regime, shock, expected):
    assert rules.siege_level(_risk(regime=regime, shock=shock), M)[0] == expected


def test_siege_reasons_say_what_is_missing_and_partial():
    _, reasons = rules.siege_level(_risk(regime=None, shock="-0.10"), M)
    assert "macro regime not available" in reasons
    _, reasons = rules.siege_level(_risk(regime="baseline", shock=None), M)
    assert "no portfolio stress result stored" in reasons
    _, reasons = rules.siege_level(_risk(regime="baseline", shock="-0.10", complete=False), M)
    assert any("partial reading" in r for r in reasons)


def test_siege_reason_for_a_losing_scenario_shows_the_percentage():
    _, reasons = rules.siege_level(_risk(regime="baseline", shock="-0.4321"), M)
    assert any("-43.2%" in r for r in reasons)


@pytest.mark.parametrize(
    ("shock", "expected"),
    [
        (None, "unsurveyed"),
        ("0.05", "sheltered"),      # a gain in the scenario
        ("-0.1999", "sheltered"),
        ("-0.20", "exposed"),
        ("-0.3999", "exposed"),
        ("-0.40", "breach_risk"),
        ("-0.90", "breach_risk"),
    ],
)
def test_siege_exposure_boundaries(shock, expected):
    assert rules.siege_exposure(D(shock) if shock is not None else None, M) == expected


def _land(zone, status="ok", mos=None, reason=None):
    return rules.LandFacts(zone=zone, valuation_status=status,
                           margin_of_safety_base=D(mos) if mos is not None else None, unavailable_reason=reason)


@pytest.mark.parametrize(
    ("zone", "expected"),
    [("below_bear", "bargain"), ("bear_to_base", "discount"),
     ("base_to_bull", "full_price"), ("above_bull", "overpriced")],
)
def test_land_maps_each_stored_zone(zone, expected):
    assert rules.land_for_sale(_land(zone))[0] == expected


def test_land_reason_includes_the_margin_of_safety_when_stored():
    land, reason = rules.land_for_sale(_land("bear_to_base", mos="0.1834"))
    assert land == "discount" and "18.3%" in reason


def test_land_is_fog_when_missing_withheld_or_unavailable_and_never_invents_a_number():
    assert rules.land_for_sale(None)[0] == "fog"
    land, reason = rules.land_for_sale(_land("below_bear", status="implausible", mos="0.9"))
    assert land == "fog" and "90" not in reason          # an implausible 90% margin is not shown
    land, reason = rules.land_for_sale(_land("unavailable", status="ok", reason="no price"))
    assert land == "fog" and reason == "no price"
    assert rules.land_for_sale(_land("sideways"))[0] == "fog"


@pytest.mark.parametrize(
    ("status", "fired", "expected"),
    [
        ("tripwire_fired", 2, ("breached", 2)),
        ("review", 0, ("review", 0)),
        ("intact", 0, ("intact", 0)),
        ("not_analyzed", 0, ("not_analyzed", 0)),
        ("something_new", 0, ("not_analyzed", 0)),
    ],
)
def test_thesis_state_mapping(status, fired, expected):
    assert rules.thesis_state(rules.ThesisFacts(status, fired), analyzable=True) == expected


def test_thesis_state_for_missing_monitor_row_and_non_analyzable():
    assert rules.thesis_state(None, analyzable=True) == ("not_analyzed", 0)
    assert rules.thesis_state(rules.ThesisFacts("tripwire_fired", 1), analyzable=False) == ("not_applicable", 0)


def test_shared_wall_partners_list_the_other_members_once():
    clusters = [
        rules.ClusterFact(["A", "B", "C"], ["Alpha", "Beta", "Gamma"], D("0.8"), D(30)),
        rules.ClusterFact(["A", "D"], ["Alpha", "Delta"], D("0.9"), D(20)),
    ]
    assert rules.shared_wall_partners("A", clusters) == ["Beta", "Gamma", "Delta"]
    assert rules.shared_wall_partners("D", clusters) == ["Alpha"]
    assert rules.shared_wall_partners("Z", clusters) == []
    assert rules.shared_wall_partners("A", []) == []


def test_snapshot_age_days():
    assert rules.snapshot_age_days(None, NOW) is None
    assert rules.snapshot_age_days(NOW - timedelta(days=3, hours=2), NOW) == 3
    assert rules.snapshot_age_days(NOW + timedelta(days=1), NOW) == 0     # never negative
    assert rules.snapshot_age_days(datetime(2026, 9, 28), NOW) == 3       # naive treated as UTC
