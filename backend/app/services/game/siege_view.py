"""Siege Simulator read path (G13): the Fortress state plus stored betas,
run through the pure simulator in `siege.py`. Database only; no provider,
LLM or write."""
from __future__ import annotations

from collections.abc import Callable
from datetime import datetime, timedelta, timezone
from decimal import Decimal

from sqlalchemy.orm import Session

from app.domain.game_mapping.siege_scenarios_v1 import SiegeScenarios
from app.domain.game_mapping.value_types import GameMapping
from app.schemas.game import GameStateOut, SiegeSimHoldingOut, SiegeSimOut
from app.services.game.sensitivity import (
    METHOD_NONE,
    METHOD_VENDOR_BETA,
    Sensitivity,
    sensitivity_from_history,
    to_nok,
)
from app.services.game.siege import SiegeHolding, simulate
from app.services.market_data.beta import read_stored_beta
from app.services.risk.price_history import TickerHistory, read_stored_history

SensitivityLookup = Callable[[str], Sensitivity]

LIMITS_NOTE = (
    "This is a what-if, not a forecast. It scales each holding by its stored beta, a historical, "
    "linear, single-factor estimate; a real market fall hits holdings unevenly and betas move."
)


def _vendor_lookup(db: Session) -> SensitivityLookup:
    """v1 behaviour: the stored vendor beta, nothing else."""

    def lookup(ticker: str) -> Sensitivity:
        found = read_stored_beta(db, ticker)
        if found.value is None:
            return Sensitivity(None, METHOD_NONE, reason="no stored beta, so it is not modelled")
        return Sensitivity(found.value, METHOD_VENDOR_BETA, as_of=found.as_of)

    return lookup


def stored_sensitivity_lookup(db: Session, scenarios: SiegeScenarios) -> SensitivityLookup:
    """Each holding's beta, read from the database only (no provider, no write).

    v2: measured from the holding's stored price history against the
    benchmark's; the stored vendor beta is the fallback where that history is
    too short or missing, and says so. v1 scenarios use the vendor beta alone."""
    if scenarios.sensitivity_method != "benchmark_downside_beta":
        return _vendor_lookup(db)

    since = datetime.now(timezone.utc).date() - timedelta(days=scenarios.history_lookback_days)
    bench = read_stored_history(db, scenarios.benchmark_ticker, since=since)
    fx_cache: dict[str, TickerHistory] = {}

    def fx_for(currency: str) -> TickerHistory:
        if currency not in fx_cache:
            fx_cache[currency] = read_stored_history(db, f"{currency}NOK=X", since=since)
        return fx_cache[currency]

    def lookup(ticker: str) -> Sensitivity:
        why: str | None
        estimate: Sensitivity | None = None
        history = read_stored_history(db, ticker, since=since)
        if not bench.available:
            why = f"no price history stored for the benchmark {scenarios.benchmark_ticker}"
        elif not history.available:
            why = "no price history stored for this holding"
        else:
            currency = (history.currency or "NOK").upper()
            fx = None
            why = None
            if currency != "NOK":
                fx_hist = fx_for(currency)
                if not fx_hist.available:
                    why = f"no {currency}/NOK history stored to convert its prices"
                else:
                    fx = fx_hist.points
            if why is None:
                estimate, why = sensitivity_from_history(
                    to_nok(history.points, fx),
                    bench.points,
                    min_observations=scenarios.min_observations,
                    min_down_days=scenarios.min_down_days,
                    weak_fit_r_squared=scenarios.weak_fit_r_squared,
                    flat_share_warning=scenarios.flat_share_warning,
                    as_of=history.as_of,
                )
        if estimate is not None:
            return estimate
        vendor = read_stored_beta(db, ticker)
        if vendor.value is not None:
            return Sensitivity(
                vendor.value,
                METHOD_VENDOR_BETA,
                as_of=vendor.as_of,
                caution=(
                    f"Price history could not be used ({why}), so this is Yahoo's beta, "
                    "measured against a different market."
                ),
            )
        return Sensitivity(None, METHOD_NONE, reason=f"not modelled: {why}, and no vendor beta is stored")

    return lookup


def build_siege_sim(
    state: GameStateOut,
    lookup: SensitivityLookup,
    market_drop: Decimal,
    mapping: GameMapping,
    scenarios: SiegeScenarios,
) -> SiegeSimOut:
    inputs: list[SiegeHolding] = []
    for t in state.towers:
        sens = lookup(t.ticker)
        inputs.append(
            SiegeHolding(
                holding_id=t.holding_id, ticker=t.ticker, name=t.name, structure=t.structure,
                size_class=t.size_class, wall=t.wall, value_nok=t.value_nok, weight_pct=t.weight_pct,
                beta=sens.beta, beta_as_of=sens.as_of, stored_shock_pct=t.siege_shock_pct,
                method=sens.method if sens.beta is not None else None, observations=sens.observations,
                r_squared=sens.r_squared, caution=sens.caution, unmodelled_reason=sens.reason,
            )
        )
    result = simulate(inputs, market_drop, mapping, scenarios)

    notes = [LIMITS_NOTE]
    if scenarios.sensitivity_method == "benchmark_downside_beta":
        notes.append(
            f"Each beta is measured from the holding's own stored prices (in NOK) against {scenarios.benchmark_ticker}, "
            "using only the days the benchmark fell. Where that history is too short, Yahoo's beta is used and marked. "
            f"A fall of the market here means a fall of {scenarios.benchmark_ticker}."
        )
    unmodelled = [r.holding.ticker for r in result.holdings if not r.modelled]
    if unmodelled:
        shown = ", ".join(unmodelled[:6]) + (f" and {len(unmodelled) - 6} more" if len(unmodelled) > 6 else "")
        fix = (
            "The worker fetches price history for every holding you own; once it has run, reload this page."
            if scenarios.sensitivity_method == "benchmark_downside_beta"
            else "Open the holding or the Watchlist once so its beta is stored."
        )
        notes.append(
            f"Not modelled (no usable beta or no value): {shown}. They are left out of the total, "
            f"not given a default. {fix}"
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
                method=r.holding.method, observations=r.holding.observations,
                r_squared=r.holding.r_squared, caution=r.holding.caution,
            )
            for r in result.holdings
        ],
        notes=notes,
        benchmark_ticker=scenarios.benchmark_ticker,
    )
