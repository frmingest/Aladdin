"""A1 Knife-edge: distances to the neighbouring wall tiers (margins_v1)."""
from decimal import Decimal as D

from app.domain.game_mapping import get_game_mapping
from app.domain.game_mapping.margins_v1 import MARGINS_V1, wall_margins
from app.services.game import rules

M = get_game_mapping("v2")


def by(ms, direction):
    return [m for m in ms if m.direction == direction and m.metric != "interest_coverage"]


def test_brick_just_inside_the_line_is_near_the_weaker_tier():
    ms = wall_margins({"net_debt_to_ebitda": D("2.4")}, financial=False, mapping=M)
    weaker = by(ms, "weaker")[0]
    assert weaker.to_tier == "timber" and weaker.boundary == D("2.5")
    assert weaker.distance == D("0.1") and weaker.near is True
    stronger = by(ms, "stronger")[0]
    assert stronger.to_tier == "granite" and stronger.distance == D("1.4") and stronger.near is False


def test_comfortably_inside_a_tier_is_not_near():
    ms = wall_margins({"net_debt_to_ebitda": D("1.8")}, financial=False, mapping=M)
    assert by(ms, "weaker")[0].near is False


def test_exactly_on_the_boundary_stays_in_the_stronger_tier_with_zero_room():
    # wall_for_stock uses <=, so 2.5 is still brick: zero room, and near.
    wall, _, inputs = rules.wall_for_stock(
        rules.WallFacts(period="FY2025", net_debt=D(250), ebitda=D(100)), financial=False, mapping=M
    )
    assert wall == "brick"
    weaker = by(wall_margins(inputs, financial=False, mapping=M), "weaker")[0]
    assert weaker.distance == D(0) and weaker.near is True


def test_granite_looks_toward_basalt_and_rotted_has_no_weaker_side():
    g = wall_margins({"net_debt_to_ebitda": D("0.5")}, financial=False, mapping=M)
    assert by(g, "stronger")[0].to_tier == "basalt"
    r = wall_margins({"net_debt_to_ebitda": D(5)}, financial=False, mapping=M)
    assert by(r, "weaker") == [] and by(r, "stronger")[0].to_tier == "timber"
    assert not any(m.near for m in r)


def test_interest_cover_near_the_penalty_line():
    cover_line = M.weak_interest_coverage
    ms = wall_margins(
        {"net_debt_to_ebitda": D("1.5"), "interest_coverage": cover_line * D("1.05")}, financial=False, mapping=M
    )
    cov = next(m for m in ms if m.metric == "interest_coverage")
    assert cov.direction == "weaker" and cov.near is True
    below = wall_margins(
        {"net_debt_to_ebitda": D("1.5"), "interest_coverage": cover_line * D("0.5")}, financial=False, mapping=M
    )
    cov2 = next(m for m in below if m.metric == "interest_coverage")
    assert cov2.direction == "stronger" and cov2.near is False


def test_rotted_leverage_ignores_cover():
    ms = wall_margins({"net_debt_to_ebitda": D(6), "interest_coverage": D(9)}, financial=False, mapping=M)
    assert not [m for m in ms if m.metric == "interest_coverage"]


def test_bank_equity_ratio_both_sides():
    ms = wall_margins({"equity_to_assets": D("0.072")}, financial=True, mapping=M)
    w, s = by(ms, "weaker")[0], by(ms, "stronger")[0]
    assert w.to_tier == "timber" and w.boundary == D("0.07") and w.near is True
    assert s.to_tier == "granite" and s.boundary == D("0.10") and s.near is False
    top = wall_margins({"equity_to_assets": D("0.14")}, financial=True, mapping=M)
    assert by(top, "stronger") == [] and by(top, "weaker")[0].to_tier == "brick"


def test_nothing_to_measure_without_a_ratio():
    assert wall_margins({}, financial=False, mapping=M) == []
    assert wall_margins({"net_debt": D(-5)}, financial=False, mapping=M) == []
    assert wall_margins({}, financial=True, mapping=M) == []


def test_band_is_a_versioned_rule():
    assert MARGINS_V1.version == "v1" and MARGINS_V1.near_band == D("0.10")


def test_text_has_no_advice_and_states_the_room():
    views = rules.wall_margin_views({"net_debt_to_ebitda": D("2.4")}, financial=False, mapping=M)
    text = " ".join(v.text for v in views).lower()
    assert "timber begins above 2.5x" in text and "0.1x of room" in text
    for banned in ("buy", "sell", "should", "improve", "reward", "progress"):
        assert banned not in text
