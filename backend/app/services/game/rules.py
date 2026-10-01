"""Pure rules that turn stored values into fortress properties.

No database, no network, no LLM (CLAUDE.md Rule 1): each function takes
plain values and a `GameMapping` and returns a label plus the reason, so
every picture in game mode can be explained as one line of arithmetic.
Unknown stays unknown: missing inputs give "unsurveyed", never a guess.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, timezone
from decimal import Decimal

from app.domain.game_mapping.value_types import GameMapping
from app.domain.instrument_types import (
    BOND_FUND,
    COMMODITY_ETC,
    EQUITY_ETF,
    EQUITY_FUND,
    MONEY_MARKET_FUND,
    STOCK,
)

ZERO = Decimal(0)

_WALL_TIERS = ("basalt", "granite", "brick", "timber", "rotted")


@dataclass
class WallFacts:
    """The balance-sheet numbers a wall is decided from, for one holding.

    Filled from stored filing facts via app/services/metrics.py. Every field
    may be None: that means "not stored", and the wall is then unsurveyed.
    """

    period: str | None = None
    net_debt: Decimal | None = None
    ebitda: Decimal | None = None
    net_debt_to_ebitda: Decimal | None = None
    interest_coverage: Decimal | None = None
    total_equity: Decimal | None = None
    total_assets: Decimal | None = None
    missing_reason: str | None = None
    inputs: dict[str, Decimal] = field(default_factory=dict)


def structure_for(instrument_type: str) -> str:
    if instrument_type == STOCK:
        return "keep"
    if instrument_type in (EQUITY_ETF, EQUITY_FUND):
        return "outpost"
    if instrument_type == COMMODITY_ETC:
        return "bullion"
    if instrument_type in (BOND_FUND, MONEY_MARKET_FUND):
        return "granary"
    return "keep"


def moat_tier(moat_rating: str | None, *, analyzable: bool) -> str:
    if not analyzable:
        return "not_applicable"
    return {"Wide": "wide", "Narrow": "narrow", "None": "none"}.get(moat_rating or "", "unsurveyed")


def size_class(weight_pct: Decimal | None, mapping: GameMapping) -> str:
    if weight_pct is None:
        return "unknown"
    if weight_pct >= mapping.large_position_pct:
        return "great"
    if weight_pct >= mapping.medium_position_pct:
        return "medium"
    if weight_pct >= mapping.small_position_pct:
        return "small"
    return "tiny"


def freshness(
    analyzed_at: datetime | None, now: datetime, mapping: GameMapping, *, analyzable: bool
) -> tuple[str, int | None]:
    if not analyzable:
        return "not_applicable", None
    if analyzed_at is None:
        return "unsurveyed", None
    when = analyzed_at if analyzed_at.tzinfo is not None else analyzed_at.replace(tzinfo=timezone.utc)
    age = (now - when).days
    if age <= mapping.fresh_max_days:
        return "fresh", age
    if age <= mapping.weathered_max_days:
        return "weathered", age
    return "overgrown", age


def _tier_down(wall: str) -> str:
    index = _WALL_TIERS.index(wall)
    return _WALL_TIERS[min(index + 1, len(_WALL_TIERS) - 1)]


def wall_for_stock(
    facts: WallFacts | None, *, financial: bool, mapping: GameMapping
) -> tuple[str, str, dict[str, Decimal]]:
    """(wall material, reason, the inputs used). Banks and insurers are
    judged on equity / total assets; everything else on net debt / EBITDA,
    with weak interest cover pulling it down one tier."""
    if facts is None:
        return "unsurveyed", "no financial statements stored for this holding", {}
    if financial:
        return _wall_for_financial(facts, mapping)
    return _wall_for_non_financial(facts, mapping)


def _wall_for_financial(facts: WallFacts, mapping: GameMapping) -> tuple[str, str, dict[str, Decimal]]:
    if facts.total_equity is None or facts.total_assets is None or facts.total_assets <= ZERO:
        return "unsurveyed", facts.missing_reason or "equity or total assets not stored", {}
    ratio = facts.total_equity / facts.total_assets
    inputs = {"equity_to_assets": ratio}
    pct = f"{(ratio * 100).quantize(Decimal('0.1'))}%"
    if ratio >= mapping.financial_granite_min_equity_ratio:
        return "granite", f"equity is {pct} of assets (bank rule: 10% or more)", inputs
    if ratio >= mapping.financial_brick_min_equity_ratio:
        return "brick", f"equity is {pct} of assets (bank rule: 7% or more)", inputs
    if ratio >= mapping.financial_timber_min_equity_ratio:
        return "timber", f"equity is {pct} of assets (bank rule: 5% or more)", inputs
    return "rotted", f"equity is only {pct} of assets (bank rule: under 5%)", inputs


def _wall_for_non_financial(facts: WallFacts, mapping: GameMapping) -> tuple[str, str, dict[str, Decimal]]:
    if facts.net_debt is None:
        return "unsurveyed", facts.missing_reason or "debt and cash not stored", {}
    inputs: dict[str, Decimal] = {"net_debt": facts.net_debt}
    if facts.net_debt <= ZERO:
        return "basalt", "net cash: cash exceeds all debt", inputs
    if facts.ebitda is None:
        return "unsurveyed", facts.missing_reason or "EBITDA not stored", inputs
    inputs["ebitda"] = facts.ebitda
    if facts.ebitda <= ZERO:
        return "rotted", "debt but no positive EBITDA to service it", inputs
    ratio = facts.net_debt / facts.ebitda
    inputs["net_debt_to_ebitda"] = ratio
    shown = ratio.quantize(Decimal("0.1"))
    if ratio <= mapping.granite_max_net_debt_to_ebitda:
        wall, reason = "granite", f"net debt is {shown}x EBITDA (granite: 1x or less)"
    elif ratio <= mapping.brick_max_net_debt_to_ebitda:
        wall, reason = "brick", f"net debt is {shown}x EBITDA (brick: up to 2.5x)"
    elif ratio <= mapping.timber_max_net_debt_to_ebitda:
        wall, reason = "timber", f"net debt is {shown}x EBITDA (timber: up to 4x)"
    else:
        wall, reason = "rotted", f"net debt is {shown}x EBITDA (rotted: above 4x)"
    cover = facts.interest_coverage
    if cover is not None:
        inputs["interest_coverage"] = cover
        if cover < mapping.weak_interest_coverage and wall != "rotted":
            weaker = _tier_down(wall)
            reason += f"; interest cover only {cover.quantize(Decimal('0.1'))}x, so one tier weaker ({weaker})"
            wall = weaker
    return wall, reason, inputs


def wall_for_non_stock(instrument_type: str) -> tuple[str, str]:
    structure = structure_for(instrument_type)
    if structure == "outpost":
        return "not_applicable", "fund: no balance sheet of its own (look-through comes in a later phase)"
    if structure == "bullion":
        return "not_applicable", "physical-metal ETC: counted as bullion, not as a business"
    return "not_applicable", "bond or money-market fund: held as a granary, not a business"


def shantytown(
    weights_pct: list[Decimal | None], mapping: GameMapping
) -> tuple[int, str]:
    """(shack count, level). A shack is a position below `tiny_position_pct`."""
    shacks = sum(1 for w in weights_pct if w is not None and w < mapping.tiny_position_pct)
    if shacks >= mapping.heavy_shantytown_min_shacks:
        return shacks, "heavy"
    if shacks >= mapping.light_shantytown_min_shacks:
        return shacks, "light"
    return shacks, "none"


def vault_level(
    cash_nok: Decimal | None, portfolio_value_nok: Decimal, mapping: GameMapping
) -> tuple[str, Decimal | None]:
    """(level, cash share of cash + portfolio in percent)."""
    if cash_nok is None:
        return "unsurveyed", None
    total = cash_nok + portfolio_value_nok
    if total <= ZERO:
        return "empty", ZERO
    share = cash_nok / total * Decimal(100)
    if share >= mapping.deep_vault_min_pct:
        return "deep", share
    if share >= mapping.stocked_vault_min_pct:
        return "stocked", share
    if share >= mapping.thin_vault_min_pct:
        return "thin", share
    return "empty", share
