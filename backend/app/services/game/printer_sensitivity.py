"""Measured rate and krone sensitivity per holding (Printer P1.5, 2026-11-15). Pure: no database,
provider, model or clock.

Ordinary least squares over weekly returns (see `printer_sensitivity_v1.py` for the rules):

    holding % = a + b_market x market % + b_rate x d(10-year yield, pp) + b_krone x krone strengthening %

Returns the two coefficients the Printer needs, each only when it is clearly measured: enough weeks,
at least `MIN_ABS_T` standard errors from zero, a plausible size and a fit that explains something.
Unknown stays unknown: a short history gives no number and a stated reason, never a default.

CLAUDE.md Rule 1: all arithmetic is here, in code.
"""
from __future__ import annotations

import itertools
from dataclasses import dataclass
from datetime import date
from decimal import Decimal

from app.domain.game_mapping import printer_sensitivity_v1 as R

ZERO = Decimal(0)
ONE = Decimal(1)
HUNDRED = Decimal(100)
_Q3 = Decimal("0.001")
_Q4 = Decimal("0.0001")
_PERFECT_T = Decimal(999)

Points = list[tuple[date, Decimal]]  # oldest first


@dataclass(frozen=True)
class Measured:
    """What the history says. A coefficient is None when it is not clearly measured."""

    long_rate: Decimal | None  # % price change per +1 pp long rate
    krone: Decimal | None  # % price change per +1% stronger krone against the dollar
    weeks: int
    r_squared: Decimal
    long_rate_t: Decimal | None = None
    krone_t: Decimal | None = None


def weekly_last(points: Points) -> dict[tuple[int, int], Decimal]:
    """Last value in each ISO week, keyed (iso year, iso week)."""
    out: dict[tuple[int, int], Decimal] = {}
    for day, value in points:  # oldest first, so the later day in a week wins
        iso = day.isocalendar()
        out[(iso[0], iso[1])] = value
    return out


def _weekly_rows(
    asset: Points, bench: Points, rate: Points, fx: Points
) -> list[tuple[Decimal, Decimal, Decimal, Decimal]]:
    """(holding %, market %, rate change pp, krone strengthening %) between consecutive weeks that
    all four series have a value for. A bad (non-positive) price is skipped, not turned into a return."""
    a, b, r, f = weekly_last(asset), weekly_last(bench), weekly_last(rate), weekly_last(fx)
    keys = sorted(set(a) & set(b) & set(r) & set(f))
    rows: list[tuple[Decimal, Decimal, Decimal, Decimal]] = []
    for prev, cur in itertools.pairwise(keys):
        if min(a[prev], a[cur], b[prev], b[cur], f[prev], f[cur]) <= ZERO:
            continue
        rows.append(
            (
                (a[cur] - a[prev]) / a[prev] * HUNDRED,
                (b[cur] - b[prev]) / b[prev] * HUNDRED,
                r[cur] - r[prev],
                # USD/NOK falling means the krone got stronger, so the sign is flipped.
                -(f[cur] - f[prev]) / f[prev] * HUNDRED,
            )
        )
    return rows


def _invert(m: list[list[Decimal]]) -> list[list[Decimal]] | None:
    """Gauss-Jordan inverse of a small square matrix; None when it is singular."""
    n = len(m)
    a = [row[:] + [ONE if i == j else ZERO for j in range(n)] for i, row in enumerate(m)]
    for col in range(n):
        pivot = max(range(col, n), key=lambda r: abs(a[r][col]))
        if abs(a[pivot][col]) < Decimal("1e-18"):
            return None
        a[col], a[pivot] = a[pivot], a[col]
        p = a[col][col]
        a[col] = [v / p for v in a[col]]
        for r in range(n):
            if r != col and a[r][col] != ZERO:
                k = a[r][col]
                a[r] = [v - k * w for v, w in zip(a[r], a[col], strict=True)]
    return [row[n:] for row in a]


def ols(rows: list[tuple[Decimal, Decimal, Decimal, Decimal]]) -> tuple[list[Decimal], list[Decimal], Decimal] | None:
    """Coefficients [a, b_market, b_rate, b_krone], their standard errors, and R squared; None when
    the regressors are collinear or there is no spread to measure."""
    n = len(rows)
    k = 4
    x = [[ONE, r[1], r[2], r[3]] for r in rows]
    y = [r[0] for r in rows]
    xtx = [[sum((x[i][p] * x[i][q] for i in range(n)), ZERO) for q in range(k)] for p in range(k)]
    xty = [sum((x[i][p] * y[i] for i in range(n)), ZERO) for p in range(k)]
    inv = _invert(xtx)
    if inv is None:
        return None
    beta = [sum((inv[p][q] * xty[q] for q in range(k)), ZERO) for p in range(k)]
    resid = [y[i] - sum((beta[p] * x[i][p] for p in range(k)), ZERO) for i in range(n)]
    sse = sum((e * e for e in resid), ZERO)
    mean_y = sum(y, ZERO) / n
    sst = sum(((v - mean_y) ** 2 for v in y), ZERO)
    if sst == ZERO:
        return None
    sigma2 = sse / (n - k)
    se = [(sigma2 * inv[p][p]).sqrt() if inv[p][p] > ZERO else ZERO for p in range(k)]
    return beta, se, ONE - sse / sst


def measure(asset_nok: Points, bench_nok: Points, rate: Points, usd_nok: Points) -> tuple[Measured | None, str | None]:
    """(measured, None) or (None, why nothing could be measured at all). A returned `Measured` may
    still carry None for one or both coefficients that were not clear enough to use."""
    rows = _weekly_rows(asset_nok, bench_nok, rate, usd_nok)
    if len(rows) < R.MIN_WEEKS:
        return None, f"only {len(rows)} weeks of history line up with the market, yields and krone; {R.MIN_WEEKS} are needed"
    fit = ols(rows)
    if fit is None:
        return None, "the market, yield and krone moves are too alike in this window to tell apart"
    beta, se, r2 = fit

    def use(i: int, bound: Decimal) -> tuple[Decimal | None, Decimal | None]:
        # A perfect fit has no error to divide by; it is as clear as a measurement gets.
        t = beta[i] / se[i] if se[i] > ZERO else (_PERFECT_T if beta[i] != ZERO else ZERO)
        ok = r2 >= R.MIN_R_SQUARED and abs(t) >= R.MIN_ABS_T and abs(beta[i]) <= bound
        return (beta[i].quantize(_Q3) if ok else None), t.quantize(_Q3)

    long_rate, t_rate = use(2, R.MAX_ABS_LONG_RATE)
    krone, t_krone = use(3, R.MAX_ABS_KRONE)
    return Measured(long_rate, krone, len(rows), r2.quantize(_Q4), t_rate, t_krone), None
