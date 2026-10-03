"""Siege Simulator (game mode G13, 2026-10-03). Pure: no database, provider,
model or clock.

What it does: applies a market fall chosen by the user to every holding
through that holding's stored beta, then reads the result with the same
exposure and portfolio lines the Fortress already uses (`rules.siege_exposure`
and the gathering / besieged thresholds of the game mapping).

    holding shock = max(-100%, -market fall x beta)

It is a what-if, not a forecast: beta is a historical, linear, single-factor
estimate, and a real fall hits holdings unevenly. The response says so.

CLAUDE.md Rule 1: all arithmetic is here, in code. Unknown stays unknown: a
holding with no stored beta (or no value) is listed as unmodelled, left out of
the total and never given a default beta; if less than `min_beta_coverage` of
the value has a beta the portfolio verdict is `unsurveyed`.
"""
from __future__ import annotations

import uuid
from dataclasses import dataclass, field
from datetime import datetime
from decimal import Decimal

from app.domain.game_mapping.siege_scenarios_v1 import SiegeScenarios
from app.domain.game_mapping.value_types import GameMapping
from app.services.game import rules

ZERO = Decimal(0)
ONE = Decimal(1)
_PCT4 = Decimal("0.0001")


@dataclass
class SiegeHolding:
    holding_id: uuid.UUID
    ticker: str
    name: str
    structure: str
    size_class: str
    wall: str
    value_nok: Decimal | None
    weight_pct: Decimal | None
    beta: Decimal | None
    beta_as_of: datetime | None = None
    # The Fortress's own stored scenario shock, shown beside the simulated one.
    stored_shock_pct: Decimal | None = None


@dataclass
class HoldingResult:
    holding: SiegeHolding
    modelled: bool
    shock_pct: Decimal | None = None
    loss_nok: Decimal | None = None
    exposure: str = "unsurveyed"
    reason: str | None = None


@dataclass
class SiegeResult:
    market_drop: Decimal
    holdings: list[HoldingResult] = field(default_factory=list)
    level: str = "unsurveyed"
    level_reason: str = ""
    portfolio_shock_pct: Decimal | None = None
    portfolio_loss_nok: Decimal | None = None
    covered_value_nok: Decimal = ZERO
    total_value_nok: Decimal = ZERO
    coverage: Decimal | None = None
    weighted_beta: Decimal | None = None
    drop_to_gathering: Decimal | None = None
    drop_to_besieged: Decimal | None = None
    reach_note_gathering: str = ""
    reach_note_besieged: str = ""
    counts: dict[str, int] = field(default_factory=dict)
    oldest_beta_at: datetime | None = None


def holding_shock(market_drop: Decimal, beta: Decimal) -> Decimal:
    """Fractional shock (negative = a loss), floored at losing everything."""
    return max(-ONE, -(market_drop * beta))


def _modelled_total(items: list[SiegeHolding], drop: Decimal) -> tuple[Decimal, Decimal]:
    """(total loss NOK, covered value NOK) for the holdings that can be modelled."""
    loss = ZERO
    covered = ZERO
    for h in items:
        if h.beta is None or h.value_nok is None or h.value_nok <= 0:
            continue
        covered += h.value_nok
        loss += h.value_nok * holding_shock(drop, h.beta)
    return loss, covered


def _first_drop_reaching(items: list[SiegeHolding], line: Decimal, step: Decimal) -> Decimal | None:
    """Smallest market fall (scanned in `step` increments up to 100%) at which
    the modelled book's loss reaches `line` (a negative fraction), or None."""
    drop = step
    while drop <= ONE:
        loss, covered = _modelled_total(items, drop)
        if covered > 0 and loss / covered <= line:
            return drop
        drop += step
    return None


def _pct(value: Decimal) -> str:
    return f"{(value * 100).quantize(Decimal('0.1'))}%"


def simulate(
    holdings: list[SiegeHolding],
    market_drop: Decimal,
    mapping: GameMapping,
    scenarios: SiegeScenarios,
) -> SiegeResult:
    result = SiegeResult(market_drop=market_drop)

    for h in holdings:
        if h.value_nok is None or h.value_nok <= 0:
            result.holdings.append(HoldingResult(h, False, reason="no value stored for this holding"))
            continue
        if h.beta is None:
            result.holdings.append(HoldingResult(h, False, reason="no stored beta, so it is not modelled"))
            continue
        shock = holding_shock(market_drop, h.beta).quantize(_PCT4)
        result.holdings.append(
            HoldingResult(
                h, True, shock_pct=shock, loss_nok=(h.value_nok * shock).quantize(Decimal(1)),
                exposure=rules.siege_exposure(shock, mapping),
            )
        )

    result.total_value_nok = sum((h.value_nok for h in holdings if h.value_nok and h.value_nok > 0), ZERO)
    modelled = [r for r in result.holdings if r.modelled]
    result.covered_value_nok = sum((r.holding.value_nok for r in modelled), ZERO)  # type: ignore[misc]
    if result.total_value_nok > 0:
        result.coverage = (result.covered_value_nok / result.total_value_nok).quantize(_PCT4)

    result.counts = {"sheltered": 0, "exposed": 0, "breach_risk": 0, "unmodelled": 0}
    for r in result.holdings:
        result.counts[r.exposure if r.modelled else "unmodelled"] += 1
    betas_at = [r.holding.beta_as_of for r in modelled if r.holding.beta_as_of is not None]
    result.oldest_beta_at = min(betas_at) if betas_at else None

    # Worst hit first; unmodelled last.
    result.holdings.sort(
        key=lambda r: (not r.modelled, r.loss_nok if r.loss_nok is not None else ZERO)
    )

    if not modelled or result.coverage is None or result.coverage < scenarios.min_beta_coverage:
        have = _pct(result.coverage) if result.coverage is not None else "none"
        result.level = "unsurveyed"
        result.level_reason = (
            f"only {have} of the portfolio value has a stored beta; at least "
            f"{_pct(scenarios.min_beta_coverage)} is needed before a portfolio result is shown"
        )
        return result

    loss, covered = _modelled_total(holdings, market_drop)
    result.portfolio_loss_nok = loss.quantize(Decimal(1))
    result.portfolio_shock_pct = (loss / covered).quantize(_PCT4)
    result.weighted_beta = (
        sum((r.holding.value_nok * r.holding.beta for r in modelled), ZERO) / covered  # type: ignore[operator]
    ).quantize(Decimal("0.01"))

    shock = result.portfolio_shock_pct
    if shock <= mapping.besieged_portfolio_shock:
        result.level = "besieged"
    elif shock <= mapping.gathering_portfolio_shock:
        result.level = "gathering"
    else:
        result.level = "calm"
    result.level_reason = (
        f"a {_pct(market_drop)} market fall costs the modelled book {_pct(-shock)}; "
        f"the gathering line is {_pct(-mapping.gathering_portfolio_shock)} and "
        f"the besieged line {_pct(-mapping.besieged_portfolio_shock)}"
    )

    for line, attr, note_attr, label in (
        (mapping.gathering_portfolio_shock, "drop_to_gathering", "reach_note_gathering", "gathering"),
        (mapping.besieged_portfolio_shock, "drop_to_besieged", "reach_note_besieged", "besieged"),
    ):
        drop = _first_drop_reaching(holdings, line, scenarios.reverse_search_step)
        setattr(result, attr, drop)
        setattr(
            result,
            note_attr,
            f"A market fall of about {_pct(drop)} reaches the {label} line (to the nearest 0.1 point)."
            if drop is not None
            else f"No market fall up to 100% reaches the {label} line with the stored betas.",
        )
    return result
