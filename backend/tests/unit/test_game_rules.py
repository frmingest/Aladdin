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
