"""How far each holding falls when the market falls (Siege Simulator v2,
2026-10-07). Pure: no database, provider, model or clock.

The question the simulator asks is "if the benchmark falls X%, what happens to
this holding?". The answer used here is measured from the holding's own stored
daily closes, converted to NOK, against the benchmark's closes, looking only at
the days the benchmark fell:

    sensitivity = covariance(holding return, benchmark return)
                  / variance(benchmark return)        over the benchmark's down days

It is the same arithmetic for a stock, an ETF, a fund and a gold ETC, so the
numbers are comparable across the book. It is not a forecast: it is how the
holding behaved on past down days. A gold ETC can come out near zero or
negative (it did not fall with the benchmark), and that is the point.

CLAUDE.md Rule 1: all arithmetic is here, in code. Unknown stays unknown: too
little history gives no number and a stated reason, never a default.
"""
from __future__ import annotations

import bisect
import itertools
from dataclasses import dataclass
from datetime import date, datetime
from decimal import Decimal

ZERO = Decimal(0)
_BETA_Q = Decimal("0.001")
_R2_Q = Decimal("0.0001")

METHOD_PRICE_HISTORY = "price_history"
METHOD_VENDOR_BETA = "vendor_beta"
METHOD_DEMO = "demo"
METHOD_NONE = "none"

Points = list[tuple[date, Decimal]]  # oldest first


@dataclass(frozen=True)
class Sensitivity:
    """One holding's beta for the simulator and where it came from."""

    beta: Decimal | None
    method: str
    as_of: datetime | None = None
    observations: int | None = None  # aligned daily returns used (down days only)
    r_squared: Decimal | None = None
    caution: str | None = None
    reason: str | None = None  # why there is no beta, or why a fallback was used


@dataclass(frozen=True)
class HistoryEstimate:
    beta: Decimal
    observations: int  # down-day returns in the regression
    total_returns: int  # all aligned daily returns in the window
    r_squared: Decimal
    flat_share: Decimal  # share of the holding's daily returns that were exactly zero


def to_nok(points: Points, fx: Points | None) -> Points:
    """Closes in NOK. `fx` is the NOK price of one unit of the closes' currency
    (None when they are already NOK). Each close uses the latest FX rate on or
    before its date; closes before the first FX rate are dropped, not guessed."""
    if fx is None:
        return list(points)
    if not fx:
        return []
    fx_days = [d for d, _ in fx]
    out: Points = []
    for day, close in points:
        i = bisect.bisect_right(fx_days, day) - 1
        if i < 0:
            continue
        out.append((day, close * fx[i][1]))
    return out


def _aligned_returns(asset: Points, bench: Points) -> list[tuple[Decimal, Decimal]]:
    """(holding return, benchmark return) between consecutive days that both
    series have a close for, so two exchanges' different holidays do not
    shift one series against the other."""
    a = dict(asset)
    b = dict(bench)
    days = sorted(set(a) & set(b))
    pairs: list[tuple[Decimal, Decimal]] = []
    for prev, cur in itertools.pairwise(days):
        pa, pb = a[prev], b[prev]
        if pa <= ZERO or pb <= ZERO:
            continue  # a bad close is skipped, not turned into a return
        pairs.append(((a[cur] - pa) / pa, (b[cur] - pb) / pb))
    return pairs


def estimate_downside_beta(
    asset: Points,
    bench: Points,
    *,
    min_observations: int,
    min_down_days: int,
) -> tuple[HistoryEstimate | None, str | None]:
    """(estimate, None) or (None, why there is none)."""
    pairs = _aligned_returns(asset, bench)
    if len(pairs) < min_observations:
        return None, (
            f"only {len(pairs)} days of price history overlap the benchmark; at least {min_observations} are needed"
        )
    down = [(y, x) for y, x in pairs if x < ZERO]
    if len(down) < min_down_days:
        return None, (
            f"only {len(down)} days in the window on which the benchmark fell; at least {min_down_days} are needed"
        )
    n = Decimal(len(down))
    mx = sum((x for _, x in down), ZERO) / n
    my = sum((y for y, _ in down), ZERO) / n
    sxx = sum(((x - mx) ** 2 for _, x in down), ZERO)
    syy = sum(((y - my) ** 2 for y, _ in down), ZERO)
    sxy = sum(((x - mx) * (y - my) for y, x in down), ZERO)
    if sxx == ZERO:
        return None, "the benchmark's down days do not vary, so no slope can be measured"
    r2 = (sxy * sxy / (sxx * syy)) if syy > ZERO else ZERO
    flat = sum(1 for y, _ in pairs if y == ZERO)
    return (
        HistoryEstimate(
            beta=(sxy / sxx).quantize(_BETA_Q),
            observations=len(down),
            total_returns=len(pairs),
            r_squared=r2.quantize(_R2_Q),
            flat_share=(Decimal(flat) / Decimal(len(pairs))).quantize(_R2_Q),
        ),
        None,
    )


def _pct(value: Decimal) -> str:
    return f"{(value * 100).quantize(Decimal(1))}%"


def caution_for(est: HistoryEstimate, *, weak_fit_r_squared: Decimal, flat_share_warning: Decimal) -> str | None:
    notes: list[str] = []
    if est.r_squared < weak_fit_r_squared:
        notes.append(
            f"The benchmark explains only {_pct(est.r_squared)} of this holding's moves on those days, "
            "so the number is a rough guide."
        )
    if est.flat_share >= flat_share_warning:
        notes.append(
            f"{_pct(est.flat_share)} of its daily prices did not change, which usually means a slowly "
            "updating price; the measured beta may read too low."
        )
    return " ".join(notes) or None


def sensitivity_from_history(
    asset: Points,
    bench: Points,
    *,
    min_observations: int,
    min_down_days: int,
    weak_fit_r_squared: Decimal,
    flat_share_warning: Decimal,
    as_of: datetime | None,
) -> tuple[Sensitivity | None, str | None]:
    est, why = estimate_downside_beta(
        asset, bench, min_observations=min_observations, min_down_days=min_down_days
    )
    if est is None:
        return None, why
    return (
        Sensitivity(
            beta=est.beta,
            method=METHOD_PRICE_HISTORY,
            as_of=as_of,
            observations=est.observations,
            r_squared=est.r_squared,
            caution=caution_for(
                est, weak_fit_r_squared=weak_fit_r_squared, flat_share_warning=flat_share_warning
            ),
        ),
        None,
    )
