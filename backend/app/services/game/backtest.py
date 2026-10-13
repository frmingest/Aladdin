"""Siege back-test (game mode C1, 2026-10-13). Pure: no database, provider,
model or clock.

The question: in the worst fall of the benchmark inside the stored price
history, would the Siege Simulator's method have been close to what each
holding really did? It checks the page, it does not forecast and it never
says what to do with money.

- Episode: the benchmark's worst peak-to-trough fall in the window.
- Per holding: the Siege beta is measured WITHOUT the days of that episode
  (so the method is not marked on days it already saw); the predicted fall is
  `siege.holding_shock(benchmark fall, beta)`; the actual fall is the holding's
  stored NOK close at the trough date over its close at the peak date.
- Book: today's weights replayed at constant weights through the stored
  history (a backcast, not what was held): its worst fall and its days under
  water, and predicted against actual over the episode.

CLAUDE.md Rule 1: all arithmetic is here, in code. Unknown stays unknown:
no history, history that starts after the fall began, or too few days to
measure a beta means "not tested", with the reason, never a default.
"""
from __future__ import annotations

import bisect
import itertools
import uuid
from dataclasses import dataclass, field
from datetime import date
from decimal import Decimal

from app.domain.game_mapping.backtest_v1 import BacktestRules
from app.domain.game_mapping.siege_scenarios_v1 import SiegeScenarios
from app.services.game.sensitivity import Points, estimate_downside_beta
from app.services.game.siege import holding_shock

ZERO = Decimal(0)
ONE = Decimal(1)
_Q = Decimal("0.0001")
_BETA_Q = Decimal("0.001")

VERDICT_CLOSE = "close"
VERDICT_FELL_MORE = "fell_more"
VERDICT_FELL_LESS = "fell_less"
VERDICT_NOT_TESTED = "not_tested"


@dataclass(frozen=True)
class Episode:
    peak_date: date
    trough_date: date
    fall: Decimal  # negative fraction, e.g. -0.18
    trading_days: int  # benchmark closes from peak to trough, trough included
    recovered: bool  # did the benchmark later close at or above the peak
    significant: bool


@dataclass
class BacktestHoldingIn:
    holding_id: uuid.UUID
    ticker: str
    name: str
    value_nok: Decimal | None
    weight_pct: Decimal | None
    points: Points | None  # NOK closes, oldest first; None = unusable
    reason: str | None = None  # why points is None


@dataclass
class HoldingBacktest:
    holding: BacktestHoldingIn
    tested: bool
    verdict: str = VERDICT_NOT_TESTED
    beta: Decimal | None = None
    beta_basis: str | None = None  # "without_episode" | "all_days"
    predicted: Decimal | None = None
    actual: Decimal | None = None
    error: Decimal | None = None  # actual - predicted; negative = fell more than predicted
    reason: str | None = None
    caution: str | None = None


@dataclass
class BookBackcast:
    holdings_used: int
    value_share: Decimal  # share of total portfolio value these holdings carry
    days: int
    predicted_fall: Decimal
    actual_fall: Decimal | None
    error: Decimal | None
    max_drawdown: Decimal  # negative fraction
    max_drawdown_peak: date
    max_drawdown_trough: date
    longest_under_water_days: int
    under_water_now_days: int


@dataclass
class BacktestResult:
    episode: Episode | None = None
    holdings: list[HoldingBacktest] = field(default_factory=list)
    tested_count: int = 0
    tested_value_share: Decimal | None = None
    close_count: int = 0
    fell_more_count: int = 0
    fell_less_count: int = 0
    mean_abs_error: Decimal | None = None
    book: BookBackcast | None = None
    book_reason: str | None = None


def worst_episode(bench: Points, rules: BacktestRules) -> Episode | None:
    """The benchmark's largest peak-to-trough fall, or None if it never fell."""
    peak_i = 0
    worst = ZERO
    worst_peak = worst_trough = 0
    for i, (_, close) in enumerate(bench):
        if close <= ZERO:
            continue
        if close > bench[peak_i][1]:
            peak_i = i
        if bench[peak_i][1] <= ZERO:
            continue
        dd = close / bench[peak_i][1] - ONE
        if dd < worst:
            worst, worst_peak, worst_trough = dd, peak_i, i
    if worst >= ZERO:
        return None
    peak_close = bench[worst_peak][1]
    recovered = any(c >= peak_close for _, c in bench[worst_trough + 1 :])
    return Episode(
        peak_date=bench[worst_peak][0],
        trough_date=bench[worst_trough][0],
        fall=worst.quantize(_Q),
        trading_days=worst_trough - worst_peak + 1,
        recovered=recovered,
        significant=-worst >= rules.significant_fall,
    )


def _close_on_or_before(points: Points, day: date) -> tuple[date, Decimal] | None:
    days = [d for d, _ in points]
    i = bisect.bisect_right(days, day) - 1
    return points[i] if i >= 0 else None


def check_holding(
    h: BacktestHoldingIn,
    bench: Points,
    episode: Episode,
    scenarios: SiegeScenarios,
    rules: BacktestRules,
) -> HoldingBacktest:
    if h.points is None:
        return HoldingBacktest(h, False, reason=h.reason or "no usable price history")
    at_peak = _close_on_or_before(h.points, episode.peak_date)
    at_trough = _close_on_or_before(h.points, episode.trough_date)
    if at_peak is None or at_trough is None or at_peak[1] <= ZERO:
        return HoldingBacktest(h, False, reason="its stored prices start after the benchmark's fall began")
    exclude = (episode.peak_date, episode.trough_date)
    est, _ = estimate_downside_beta(
        h.points, bench,
        min_observations=scenarios.min_observations, min_down_days=scenarios.min_down_days, exclude=exclude,
    )
    basis = "without_episode"
    caution = None
    if est is None:
        est, why = estimate_downside_beta(
            h.points, bench, min_observations=scenarios.min_observations, min_down_days=scenarios.min_down_days
        )
        basis = "all_days"
        if est is None:
            return HoldingBacktest(h, False, reason=why or "too little price history to measure a beta")
        caution = (
            "Too few other falling days to measure its beta without this fall, so the beta here "
            "includes it and the check is easier to pass than it should be."
        )
    predicted = holding_shock(-episode.fall, est.beta).quantize(_Q)
    actual = (at_trough[1] / at_peak[1] - ONE).quantize(_Q)
    error = (actual - predicted).quantize(_Q)
    if abs(error) <= rules.close_points:
        verdict = VERDICT_CLOSE
    elif error < ZERO:
        verdict = VERDICT_FELL_MORE
    else:
        verdict = VERDICT_FELL_LESS
    return HoldingBacktest(
        h, True, verdict=verdict, beta=est.beta.quantize(_BETA_Q), beta_basis=basis,
        predicted=predicted, actual=actual, error=error, caution=caution,
    )


def backcast_book(
    tested: list[HoldingBacktest],
    episode: Episode,
    total_value: Decimal,
    rules: BacktestRules,
    min_days: int,
) -> tuple[BookBackcast | None, str | None]:
    """Constant-weight replay of the tested holdings through their common days."""
    valued = [t for t in tested if t.holding.value_nok and t.holding.value_nok > ZERO and t.holding.points]
    if len(valued) < rules.min_book_holdings:
        return None, f"fewer than {rules.min_book_holdings} holdings could be tested, so there is no book to replay"
    value = sum((t.holding.value_nok for t in valued), ZERO)  # type: ignore[misc]
    weights = [t.holding.value_nok / value for t in valued]  # type: ignore[operator]
    series = [dict(t.holding.points) for t in valued]  # type: ignore[arg-type]
    days = sorted(set.intersection(*(set(s) for s in series)))
    if len(days) < min_days:
        return None, (
            f"the tested holdings share only {len(days)} days of stored prices; at least {min_days} are needed"
        )
    index = ONE
    series_idx: list[tuple[date, Decimal]] = [(days[0], index)]
    for prev, cur in itertools.pairwise(days):
        r = ZERO
        for w, s in zip(weights, series, strict=True):
            if s[prev] <= ZERO:
                continue
            r += w * (s[cur] / s[prev] - ONE)
        index = index * (ONE + r)
        series_idx.append((cur, index))

    peak_i = 0
    worst = ZERO
    wp = wt = 0
    longest = run = 0
    for i, (_, v) in enumerate(series_idx):
        if v >= series_idx[peak_i][1]:
            peak_i = i
            run = 0
        else:
            run += 1
            longest = max(longest, run)
        dd = v / series_idx[peak_i][1] - ONE
        if dd < worst:
            worst, wp, wt = dd, peak_i, i

    ep_peak = _close_on_or_before(series_idx, episode.peak_date)
    ep_trough = _close_on_or_before(series_idx, episode.trough_date)
    actual = error = None
    if ep_peak is not None and ep_trough is not None and episode.peak_date >= days[0]:
        actual = (ep_trough[1] / ep_peak[1] - ONE).quantize(_Q)
    predicted = sum((w * t.predicted for w, t in zip(weights, valued, strict=True)), ZERO).quantize(_Q)  # type: ignore[operator]
    if actual is not None:
        error = (actual - predicted).quantize(_Q)
    return (
        BookBackcast(
            holdings_used=len(valued),
            value_share=(value / total_value).quantize(_Q) if total_value > ZERO else ZERO,
            days=len(days),
            predicted_fall=predicted,
            actual_fall=actual,
            error=error,
            max_drawdown=worst.quantize(_Q),
            max_drawdown_peak=series_idx[wp][0],
            max_drawdown_trough=series_idx[wt][0],
            longest_under_water_days=longest,
            under_water_now_days=run,
        ),
        None,
    )


def run_backtest(
    holdings: list[BacktestHoldingIn],
    bench: Points,
    scenarios: SiegeScenarios,
    rules: BacktestRules,
) -> BacktestResult:
    result = BacktestResult()
    episode = worst_episode(bench, rules)
    result.episode = episode
    if episode is None:
        return result
    result.holdings = [check_holding(h, bench, episode, scenarios, rules) for h in holdings]
    tested = [t for t in result.holdings if t.tested]
    result.tested_count = len(tested)
    total = sum((h.value_nok for h in holdings if h.value_nok and h.value_nok > ZERO), ZERO)
    if total > ZERO:
        tv = sum((t.holding.value_nok for t in tested if t.holding.value_nok and t.holding.value_nok > ZERO), ZERO)
        result.tested_value_share = (tv / total).quantize(_Q)
    result.close_count = sum(1 for t in tested if t.verdict == VERDICT_CLOSE)
    result.fell_more_count = sum(1 for t in tested if t.verdict == VERDICT_FELL_MORE)
    result.fell_less_count = sum(1 for t in tested if t.verdict == VERDICT_FELL_LESS)
    if tested:
        result.mean_abs_error = (sum((abs(t.error) for t in tested), ZERO) / len(tested)).quantize(_Q)  # type: ignore[arg-type]
    # Worst-missed first; untested last.
    result.holdings.sort(key=lambda t: (not t.tested, t.error if t.error is not None else ZERO))
    result.book, result.book_reason = backcast_book(tested, episode, total, rules, scenarios.min_observations)
    return result
