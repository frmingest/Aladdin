"""Siege Simulator read path (G13): the Fortress state plus stored betas,
run through the pure simulator in `siege.py`. Database only; no provider,
LLM or write."""
from __future__ import annotations

from collections.abc import Callable
from datetime import datetime
from decimal import Decimal

from sqlalchemy.orm import Session

from app.domain.game_mapping.siege_scenarios_v1 import SiegeScenarios
from app.domain.game_mapping.value_types import GameMapping
from app.schemas.game import GameStateOut, SiegeSimHoldingOut, SiegeSimOut
from app.services.game.siege import SiegeHolding, simulate
from app.services.market_data.beta import read_stored_beta

BetaLookup = Callable[[str], tuple[Decimal | None, datetime | None]]

LIMITS_NOTE = (
    "This is a what-if, not a forecast. It scales each holding by its stored beta, a historical, "
    "linear, single-factor estimate; a real market fall hits holdings unevenly and betas move."
)


def stored_beta_lookup(db: Session) -> BetaLookup:
    def lookup(ticker: str) -> tuple[Decimal | None, datetime | None]:
        found = read_stored_beta(db, ticker)
        return found.value, found.as_of

    return lookup


def build_siege_sim(
    state: GameStateOut,
    beta_lookup: BetaLookup,
    market_drop: Decimal,
    mapping: GameMapping,
    scenarios: SiegeScenarios,
) -> SiegeSimOut:
    inputs: list[SiegeHolding] = []
    for t in state.towers:
        beta, beta_at = beta_lookup(t.ticker)
        inputs.append(
            SiegeHolding(
                holding_id=t.holding_id, ticker=t.ticker, name=t.name, structure=t.structure,
                size_class=t.size_class, wall=t.wall, value_nok=t.value_nok, weight_pct=t.weight_pct,
                beta=beta, beta_as_of=beta_at, stored_shock_pct=t.siege_shock_pct,
            )
        )
    result = simulate(inputs, market_drop, mapping, scenarios)

    notes = [LIMITS_NOTE]
    unmodelled = [r.holding.ticker for r in result.holdings if not r.modelled]
    if unmodelled:
        shown = ", ".join(unmodelled[:6]) + (f" and {len(unmodelled) - 6} more" if len(unmodelled) > 6 else "")
        notes.append(
            f"Not modelled (no stored beta or no value): {shown}. They are left out of the total, "
            "not given a default. Open the holding or the Watchlist once so its beta is stored."
        )
    if not state.towers:
        notes.append("There are no holdings to simulate yet.")

    return SiegeSimOut(
        scenarios_version=scenarios.version,
        mapping_version=mapping.version,
        demo=state.demo,
        market_drop=market_drop,
        drop_min=scenarios.drop_min,
        drop_max=scenarios.drop_max,
        drop_step=scenarios.drop_step,
        level=result.level,  # type: ignore[arg-type]
        level_reason=result.level_reason,
        portfolio_shock_pct=result.portfolio_shock_pct,
        portfolio_loss_nok=result.portfolio_loss_nok,
        covered_value_nok=result.covered_value_nok,
        total_value_nok=result.total_value_nok,
        coverage=result.coverage,
        weighted_beta=result.weighted_beta,
        gathering_line=mapping.gathering_portfolio_shock,
        besieged_line=mapping.besieged_portfolio_shock,
        drop_to_gathering=result.drop_to_gathering,
        drop_to_besieged=result.drop_to_besieged,
        reach_note_gathering=result.reach_note_gathering,
        reach_note_besieged=result.reach_note_besieged,
        counts=result.counts,
        oldest_beta_at=result.oldest_beta_at,
        holdings=[
            SiegeSimHoldingOut(
                holding_id=r.holding.holding_id, ticker=r.holding.ticker, name=r.holding.name,
                structure=r.holding.structure, size_class=r.holding.size_class, wall=r.holding.wall,  # type: ignore[arg-type]
                value_nok=r.holding.value_nok, weight_pct=r.holding.weight_pct, beta=r.holding.beta,
                beta_as_of=r.holding.beta_as_of, modelled=r.modelled, shock_pct=r.shock_pct,
                loss_nok=r.loss_nok, exposure=r.exposure if r.modelled else "unmodelled",  # type: ignore[arg-type]
                stored_shock_pct=r.holding.stored_shock_pct, reason=r.reason,
            )
            for r in result.holdings
        ],
        notes=notes,
    )
