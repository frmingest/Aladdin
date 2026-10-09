"""v1 margins for the wall tiers (A1 Knife-edge, 2026-10-09).

A wall's tier is decided by `rules.wall_for_stock` from a few stored numbers.
This file does not change that decision. It only measures how far the same
numbers sit from the next tier boundary on each side, so the Fortress can say
"net debt is 2.4x EBITDA; timber begins above 2.5x" instead of showing a tier
as if it were a fact with no edges.

`near_band` is relative to the boundary: a number within 10% of the line it
would cross is "near". Only a move toward a *weaker* tier is flagged near (a
hairline crack); the distance to a stronger tier is shown as plain text and
never as progress. CLAUDE.md Rule 3: a change to the band is a new
`margins_v2.py`, not an edit of this file. Pure, deterministic, no LLM.
"""
from __future__ import annotations

from dataclasses import dataclass
from decimal import Decimal

from app.domain.game_mapping.value_types import GameMapping

ZERO = Decimal(0)


@dataclass(frozen=True)
class MarginRules:
    version: str
    near_band: Decimal  # share of the boundary value


MARGINS_V1 = MarginRules(version="v1", near_band=Decimal("0.10"))


@dataclass(frozen=True)
class Margin:
    metric: str  # key of the wall input it measures
    label: str
    value: Decimal
    boundary: Decimal
    direction: str  # "weaker" | "stronger"
    to_tier: str
    distance: Decimal  # always >= 0, in the metric's own unit
    near: bool  # only ever true for direction == "weaker"
    unit: str  # "x" or "%"


def _near(distance: Decimal, boundary: Decimal, rules: MarginRules) -> bool:
    return boundary > ZERO and distance <= boundary * rules.near_band


def leverage_margins(
    ratio: Decimal, cover: Decimal | None, mapping: GameMapping, rules: MarginRules = MARGINS_V1
) -> list[Margin]:
    """Net debt / EBITDA is lower-is-stronger. Tiers: granite <= g, brick <= b,
    timber <= t, rotted above. Also the interest-cover rule: cover below
    `weak_interest_coverage` pulls a non-rotted wall one tier down."""
    g, b, t = (
        mapping.granite_max_net_debt_to_ebitda,
        mapping.brick_max_net_debt_to_ebitda,
        mapping.timber_max_net_debt_to_ebitda,
    )
    label = "Net debt / EBITDA"
    out: list[Margin] = []
    if ratio <= g:
        tier, weaker, stronger = "granite", (g, "brick"), (ZERO, "basalt")
    elif ratio <= b:
        tier, weaker, stronger = "brick", (b, "timber"), (g, "granite")
    elif ratio <= t:
        tier, weaker, stronger = "timber", (t, "rotted"), (b, "brick")
    else:
        tier, weaker, stronger = "rotted", None, (t, "timber")
    if weaker is not None:
        d = weaker[0] - ratio
        out.append(Margin("net_debt_to_ebitda", label, ratio, weaker[0], "weaker", weaker[1], d, _near(d, weaker[0], rules), "x"))
    d = ratio - stronger[0]
    out.append(Margin("net_debt_to_ebitda", label, ratio, stronger[0], "stronger", stronger[1], d, False, "x"))
    if cover is not None and tier != "rotted":
        w = mapping.weak_interest_coverage
        if cover >= w:
            d = cover - w
            out.append(Margin("interest_coverage", "Interest cover", cover, w, "weaker", "one tier down", d, _near(d, w, rules), "x"))
        else:
            out.append(Margin("interest_coverage", "Interest cover", cover, w, "stronger", "no cover penalty", w - cover, False, "x"))
    return out


def financial_margins(ratio: Decimal, mapping: GameMapping, rules: MarginRules = MARGINS_V1) -> list[Margin]:
    """Equity / total assets is higher-is-stronger."""
    g = mapping.financial_granite_min_equity_ratio
    b = mapping.financial_brick_min_equity_ratio
    t = mapping.financial_timber_min_equity_ratio
    label = "Equity / assets"
    if ratio >= g:
        weaker, stronger = (g, "brick"), None
    elif ratio >= b:
        weaker, stronger = (b, "timber"), (g, "granite")
    elif ratio >= t:
        weaker, stronger = (t, "rotted"), (b, "brick")
    else:
        weaker, stronger = None, (t, "timber")
    out: list[Margin] = []
    if weaker is not None:
        d = ratio - weaker[0]
        out.append(Margin("equity_to_assets", label, ratio, weaker[0], "weaker", weaker[1], d, _near(d, weaker[0], rules), "%"))
    if stronger is not None:
        out.append(Margin("equity_to_assets", label, ratio, stronger[0], "stronger", stronger[1], stronger[0] - ratio, False, "%"))
    return out


def wall_margins(
    wall_inputs: dict[str, Decimal], *, financial: bool, mapping: GameMapping, rules: MarginRules = MARGINS_V1
) -> list[Margin]:
    """Margins for the numbers a stock's wall was decided from; empty when the
    wall is basalt (net cash), rotted for want of positive EBITDA, or
    unsurveyed, because there is then no ratio with a boundary to measure."""
    if financial:
        ratio = wall_inputs.get("equity_to_assets")
        return financial_margins(ratio, mapping, rules) if ratio is not None else []
    ratio = wall_inputs.get("net_debt_to_ebitda")
    if ratio is None:
        return []
    return leverage_margins(ratio, wall_inputs.get("interest_coverage"), mapping, rules)
