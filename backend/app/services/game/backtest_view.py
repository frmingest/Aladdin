"""Siege back-test read path (C1): the Fortress state plus stored price
history, run through the pure back-test in `backtest.py`. Database only; no
provider, LLM or write."""
from __future__ import annotations

from collections.abc import Callable
from datetime import datetime, timedelta, timezone
from decimal import Decimal

from sqlalchemy.orm import Session

from app.domain.game_mapping.backtest_v1 import BacktestRules
from app.domain.game_mapping.siege_scenarios_v1 import SiegeScenarios
from app.schemas.game import (
    GameStateOut,
    SiegeBacktestBookOut,
    SiegeBacktestEpisodeOut,
    SiegeBacktestHoldingOut,
    SiegeBacktestOut,
)
from app.services.game.backtest import BacktestHoldingIn, BacktestResult, run_backtest
from app.services.game.sensitivity import Points, to_nok
from app.services.risk.price_history import TickerHistory, read_stored_history

LIMITS_NOTE = (
    "This checks the Siege page's own method on one past fall, the benchmark's worst in the stored prices. "
    "One episode is a small sample; it shows where the method was close and where it was not, and it says "
    "nothing about the next fall."
)
BACKCAST_NOTE = (
    "The book line replays today's weights at constant weights through the stored prices. It is not what "
    "was held, ignores buying, selling and costs, and leaves out holdings that could not be tested."
)


def _pct(value: Decimal) -> str:
    return f"{(abs(value) * 100).quantize(Decimal('0.1'))}%"


def _empty(
    scenarios: SiegeScenarios, rules: BacktestRules, status: str, reason: str, *, demo: bool = False, total: int = 0
) -> SiegeBacktestOut:
    return SiegeBacktestOut(
        backtest_version=rules.version, scenarios_version=scenarios.version, demo=demo,
        benchmark_ticker=scenarios.benchmark_ticker, status=status,  # type: ignore[arg-type]
        status_reason=reason, total_count=total, close_points=rules.close_points, notes=[LIMITS_NOTE],
    )


def demo_backtest(state: GameStateOut, scenarios: SiegeScenarios, rules: BacktestRules) -> SiegeBacktestOut:
    return _empty(
        scenarios, rules, "demo",
        "The sample data has no stored price history, so there is nothing to check against.",
        demo=True, total=len(state.towers),
    )


def stored_backtest_inputs(
    db: Session, state: GameStateOut, scenarios: SiegeScenarios
) -> tuple[TickerHistory, list[BacktestHoldingIn]]:
    since = datetime.now(timezone.utc).date() - timedelta(days=scenarios.history_lookback_days)
    bench = read_stored_history(db, scenarios.benchmark_ticker, since=since)
    fx_cache: dict[str, TickerHistory] = {}
    out: list[BacktestHoldingIn] = []
    for t in state.towers:
        history = read_stored_history(db, t.ticker, since=since)
        points: Points | None = None
        reason: str | None = None
        if not history.available:
            reason = "no price history stored for this holding"
        else:
            currency = (history.currency or "NOK").upper()
            fx: Points | None = None
            if currency != "NOK":
                if currency not in fx_cache:
                    fx_cache[currency] = read_stored_history(db, f"{currency}NOK=X", since=since)
                if not fx_cache[currency].available:
                    reason = f"no {currency}/NOK history stored to convert its prices"
                else:
                    fx = fx_cache[currency].points
            if reason is None:
                points = to_nok(history.points, fx) or None
                if points is None:
                    reason = "no prices could be converted to NOK"
        out.append(BacktestHoldingIn(
            holding_id=t.holding_id, ticker=t.ticker, name=t.name, value_nok=t.value_nok,
            weight_pct=t.weight_pct, points=points, reason=reason,
        ))
    return bench, out


def build_backtest(
    state: GameStateOut,
    bench: TickerHistory,
    holdings: list[BacktestHoldingIn],
    scenarios: SiegeScenarios,
    rules: BacktestRules,
    run: Callable[..., BacktestResult] = run_backtest,
) -> SiegeBacktestOut:
    total = len(holdings)
    if not holdings:
        return _empty(scenarios, rules, "no_history", "There are no holdings to check yet.", total=0)
    if not bench.available or len(bench.points) < scenarios.min_observations:
        return _empty(
            scenarios, rules, "no_history",
            f"Not enough stored prices for the benchmark {scenarios.benchmark_ticker} to find a fall in.",
            total=total,
        )
    result = run(holdings, bench.points, scenarios, rules)
    if result.episode is None:
        return _empty(
            scenarios, rules, "no_episode",
            f"{scenarios.benchmark_ticker} did not fall from any earlier high in the stored window, so there is no fall to check.",
            total=total,
        )
    ep = result.episode
    notes = [LIMITS_NOTE]
    if not ep.significant:
        notes.append(
            f"The worst fall in the window was only {_pct(ep.fall)}, under the {_pct(rules.significant_fall)} "
            "this check treats as a real test. The gaps below are mostly noise."
        )
    if not ep.recovered:
        notes.append("The benchmark had not regained that earlier high by the last stored day.")
    if result.book is not None:
        notes.append(BACKCAST_NOTE)
    if any(t.caution for t in result.holdings):
        notes.append("Rows marked with a caution used a beta that includes the fall being checked.")
    untested = [t for t in result.holdings if not t.tested]
    if untested:
        notes.append(f"{len(untested)} of {total} holdings could not be tested; each row says why.")

    return SiegeBacktestOut(
        backtest_version=rules.version,
        scenarios_version=scenarios.version,
        benchmark_ticker=scenarios.benchmark_ticker,
        status="ok",
        window_start=bench.points[0][0],
        window_end=bench.points[-1][0],
        episode=SiegeBacktestEpisodeOut(
            peak_date=ep.peak_date, trough_date=ep.trough_date, fall=ep.fall,
            trading_days=ep.trading_days, recovered=ep.recovered, significant=ep.significant,
        ),
        holdings=[
            SiegeBacktestHoldingOut(
                holding_id=t.holding.holding_id, ticker=t.holding.ticker, name=t.holding.name,
                weight_pct=t.holding.weight_pct, tested=t.tested, verdict=t.verdict,  # type: ignore[arg-type]
                beta=t.beta, beta_basis=t.beta_basis,  # type: ignore[arg-type]
                predicted=t.predicted, actual=t.actual, error=t.error, reason=t.reason, caution=t.caution,
            )
            for t in result.holdings
        ],
        tested_count=result.tested_count,
        total_count=total,
        tested_value_share=result.tested_value_share,
        close_count=result.close_count,
        fell_more_count=result.fell_more_count,
        fell_less_count=result.fell_less_count,
        mean_abs_error=result.mean_abs_error,
        close_points=rules.close_points,
        book=SiegeBacktestBookOut(**vars(result.book)) if result.book else None,
        book_reason=result.book_reason,
        notes=notes,
    )
