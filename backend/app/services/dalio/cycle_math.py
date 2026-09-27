"""Deterministic cycle math for Dalio mode (Epic F22, stories 22.3 and
22.9): how a holding's monthly returns have moved with growth, inflation
and interest-rate changes.

CLAUDE.md Rule 1: plain Decimal arithmetic; the LLM only ever sees the
results. Method, kept deliberately simple and stated in every output:

- Holding: month-end close -> monthly % return, in its trading currency.
- Factors, from stored macro observations (month-end values):
    inflation  = monthly change in 12-month CPI inflation (pp)
    growth     = minus the monthly change in the unemployment rate (pp),
                 so a positive value means "growth improving"
    rates      = monthly change in a 10-year government yield (pp)
- For each factor, a univariate OLS slope (beta) of return on the factor
  change, its t-statistic and the correlation, over the months both have.

ECON-F22-05 (min-history guard): fewer than `min_months` overlapping
months gives "insufficient history" and no number. A |t| below 2 is
reported as "not statistically distinguishable from zero" rather than as
a direction — a beta on 24-36 noisy monthly points is weak evidence, and
the output says so instead of letting it read as a finding.
"""
from __future__ import annotations

from dataclasses import dataclass
from datetime import date
from decimal import Decimal, getcontext

getcontext().prec = 28

YearMonth = tuple[int, int]

SIGNIFICANCE_T = Decimal(2)


def month_end_values(points: list[tuple[date, Decimal]]) -> dict[YearMonth, Decimal]:
    """Last value in each calendar month (points oldest first)."""
    out: dict[YearMonth, Decimal] = {}
    for observed, value in points:
        out[(observed.year, observed.month)] = value
    return out


def _prev(ym: YearMonth) -> YearMonth:
    year, month = ym
    return (year - 1, 12) if month == 1 else (year, month - 1)


def monthly_returns_pct(points: list[tuple[date, Decimal]]) -> dict[YearMonth, Decimal]:
    """% return from the previous month's last close to this month's."""
    closes = month_end_values(points)
    out: dict[YearMonth, Decimal] = {}
    for ym, close in closes.items():
        prev = closes.get(_prev(ym))
        if prev is not None and prev > 0:
            out[ym] = (close / prev - 1) * 100
    return out


def monthly_changes(points: list[tuple[date, Decimal]], *, sign: int = 1) -> dict[YearMonth, Decimal]:
    """Month-end level change vs the previous month-end (pp for a rate)."""
    levels = month_end_values(points)
    out: dict[YearMonth, Decimal] = {}
    for ym, value in levels.items():
        prev = levels.get(_prev(ym))
        if prev is not None:
            out[ym] = (value - prev) * sign
    return out


@dataclass(frozen=True)
class FactorBeta:
    factor_key: str
    factor_label: str
    n_months: int
    beta: Decimal | None = None  # % return per 1pp factor change
    t_stat: Decimal | None = None
    correlation: Decimal | None = None
    reason: str | None = None  # why beta is None

    @property
    def available(self) -> bool:
        return self.beta is not None

    @property
    def significant(self) -> bool:
        return self.t_stat is not None and abs(self.t_stat) >= SIGNIFICANCE_T

    def describe(self) -> str:
        if not self.available:
            return f"{self.factor_label}: {self.reason}."
        q = Decimal("0.01")
        text = (
            f"{self.factor_label}: beta {self.beta.quantize(q)}% monthly return per +1pp "
            f"(t = {self.t_stat.quantize(q)}, correlation {self.correlation.quantize(q)}, "
            f"{self.n_months} months)"
        )
        if self.significant:
            direction = "rose" if self.beta > 0 else "fell"
            text += f" — returns historically {direction} when this factor increased."
        else:
            text += " — not statistically distinguishable from zero (|t| < 2)."
        return text


def ols_beta(
    returns: dict[YearMonth, Decimal],
    factor: dict[YearMonth, Decimal],
    *,
    factor_key: str,
    factor_label: str,
    min_months: int,
) -> FactorBeta:
    months = sorted(set(returns) & set(factor))
    n = len(months)
    if n < min_months:
        return FactorBeta(
            factor_key, factor_label, n,
            reason=f"insufficient history — {n} overlapping months, {min_months} needed",
        )
    x = [factor[m] for m in months]
    y = [returns[m] for m in months]
    mean_x = sum(x) / n
    mean_y = sum(y) / n
    sxx = sum((xi - mean_x) ** 2 for xi in x)
    syy = sum((yi - mean_y) ** 2 for yi in y)
    sxy = sum((xi - mean_x) * (yi - mean_y) for xi, yi in zip(x, y, strict=True))
    if sxx == 0 or syy == 0:
        return FactorBeta(factor_key, factor_label, n, reason="no variation in the factor or the returns")
    beta = sxy / sxx
    alpha = mean_y - beta * mean_x
    residual_ss = sum((yi - alpha - beta * xi) ** 2 for xi, yi in zip(x, y, strict=True))
    correlation = sxy / (sxx * syy).sqrt()
    if residual_ss == 0:
        t_stat = Decimal(999)  # perfect fit; capped rather than infinite
    else:
        se = (residual_ss / (n - 2) / sxx).sqrt()
        t_stat = beta / se
    return FactorBeta(factor_key, factor_label, n, beta=beta, t_stat=t_stat, correlation=correlation)


def quadrant_tilt(inflation: FactorBeta, growth: FactorBeta) -> str:
    """Plain-language summary of which All-Weather environment the betas
    point to — only from statistically significant betas."""
    parts: list[str] = []
    if growth.available and growth.significant:
        parts.append("rising growth" if growth.beta > 0 else "falling growth")
    if inflation.available and inflation.significant:
        parts.append("rising inflation" if inflation.beta > 0 else "falling inflation")
    if parts:
        return "Historically did better in: " + " and ".join(parts) + "."
    if not (inflation.available or growth.available):
        return "No quadrant reading: not enough price or macro history."
    return "No statistically clear quadrant tilt in the available history."
