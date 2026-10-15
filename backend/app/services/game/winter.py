"""Winter Rehearsal replay (game mode E2, 2026-10-15). Pure: no database,
provider, model or clock.

The question: in the worst fall of the book inside the stored price history,
what would today's book have lost, in kroner, and for how many days was it
below its earlier high? The answer is read off a constant-weight replay of the
holdings that have stored prices (a backcast, not what was held).

- Weights are today's value shares among the covered holdings, held constant.
- Kroner are scaled to what the covered holdings are worth today: at the
  peak the replayed book equals today's covered value, and every later day is
  that value times the index change since the peak.
- "Days under water" counts stored trading days since the peak (days all the
  covered holdings have a close on).

CLAUDE.md Rule 1: all arithmetic is here, in code. Unknown stays unknown: a
holding without usable stored prices is "not covered" with its reason, never
filled in. If the worst fall is under the versioned line, the result says
there was no real winter instead of showing a small dip as one.
"""
from __future__ import annotations

import itertools
from dataclasses import dataclass, field
from datetime import date
from decimal import Decimal

from app.domain.game_mapping.winter_v1 import WinterRules
from app.services.game.backtest import BacktestHoldingIn

ZERO = Decimal(0)
ONE = Decimal(1)
_Q = Decimal("0.0001")
_NOK_Q = Decimal("0.01")

STATUS_OK = "ok"
STATUS_NO_WINTER = "no_winter"
STATUS_NO_HISTORY = "no_history"


@dataclass(frozen=True)
class CoverageRow:
    holding_id: object
    name: str
    covered: bool
    reason: str | None = None


@dataclass(frozen=True)
class ReplayPoint:
    day: date
    value_nok: Decimal
    change_nok: Decimal  # against the peak, negative when lower
    change: Decimal  # fraction against the peak, negative when lower
    days_under_water: int


@dataclass
class ReplayResult:
    status: str
    reason: str = ""
    coverage: list[CoverageRow] = field(default_factory=list)
    covered_count: int = 0
    covered_value_nok: Decimal = ZERO
    covered_value_share: Decimal | None = None
    days_on_file: int = 0
    worst_fall: Decimal | None = None
    peak_date: date | None = None
    trough_date: date | None = None
    points: list[ReplayPoint] = field(default_factory=list)


def coverage_of(holdings: list[BacktestHoldingIn]) -> tuple[list[CoverageRow], list[BacktestHoldingIn]]:
    rows: list[CoverageRow] = []
    covered: list[BacktestHoldingIn] = []
    for h in holdings:
        if h.points is None or len(h.points) < 2:
            rows.append(CoverageRow(h.holding_id, h.name, False, h.reason or "no usable stored prices"))
        elif h.value_nok is None or h.value_nok <= ZERO:
            rows.append(CoverageRow(h.holding_id, h.name, False, "no value on file to weigh it by"))
        else:
            rows.append(CoverageRow(h.holding_id, h.name, True))
            covered.append(h)
    return rows, covered


def replay_worst_fall(holdings: list[BacktestHoldingIn], rules: WinterRules, min_days: int) -> ReplayResult:
    coverage, covered = coverage_of(holdings)
    result = ReplayResult(status=STATUS_NO_HISTORY, coverage=coverage, covered_count=len(covered))
    if len(covered) < rules.min_holdings:
        result.reason = (
            f"Only {len(covered)} of {len(holdings)} holdings have stored prices; "
            f"at least {rules.min_holdings} are needed to replay a book."
        )
        return result

    all_value = sum((h.value_nok for h in holdings if h.value_nok and h.value_nok > ZERO), ZERO)
    value = sum((h.value_nok for h in covered), ZERO)  # type: ignore[misc]
    result.covered_value_nok = value.quantize(_NOK_Q)
    if all_value > ZERO:
        result.covered_value_share = (value / all_value).quantize(_Q)

    weights = [h.value_nok / value for h in covered]  # type: ignore[operator]
    series = [dict(h.points) for h in covered]  # type: ignore[arg-type]
    days = sorted(set.intersection(*(set(s) for s in series)))
    result.days_on_file = len(days)
    if len(days) < min_days:
        result.reason = (
            f"The covered holdings share only {len(days)} days of stored prices; at least {min_days} are needed."
        )
        return result

    index = ONE
    idx: list[Decimal] = [index]
    for prev, cur in itertools.pairwise(days):
        r = ZERO
        for w, s in zip(weights, series, strict=True):
            if s[prev] <= ZERO:
                continue
            r += w * (s[cur] / s[prev] - ONE)
        index = index * (ONE + r)
        idx.append(index)

    peak_i = 0
    worst = ZERO
    wp = wt = 0
    for i, v in enumerate(idx):
        if v >= idx[peak_i]:
            peak_i = i
        dd = v / idx[peak_i] - ONE
        if dd < worst:
            worst, wp, wt = dd, peak_i, i

    result.worst_fall = worst.quantize(_Q)
    if worst >= ZERO or -worst < rules.real_winter_fall:
        result.status = STATUS_NO_WINTER
        result.reason = (
            "The stored prices hold no real fall for this book. "
            f"The worst dip was {(-worst * 100).quantize(Decimal('0.1'))}%."
        )
        return result

    peak_idx = idx[wp]
    points: list[ReplayPoint] = []
    for i in range(wp, wt + 1):
        change = idx[i] / peak_idx - ONE
        points.append(ReplayPoint(
            day=days[i],
            value_nok=(value * (idx[i] / peak_idx)).quantize(_NOK_Q),
            change_nok=(value * change).quantize(_NOK_Q),
            change=change.quantize(_Q),
            days_under_water=i - wp,
        ))
    result.status = STATUS_OK
    result.peak_date, result.trough_date = days[wp], days[wt]
    result.points = points
    return result
