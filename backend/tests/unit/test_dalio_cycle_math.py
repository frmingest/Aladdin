from __future__ import annotations

from datetime import date
from decimal import Decimal

from app.services.dalio.cycle_math import (
    monthly_changes,
    monthly_returns_pct,
    ols_beta,
    quadrant_tilt,
)

D = Decimal


def _months(n: int, start_year: int = 2023):
    for i in range(n):
        yield date(start_year + (i // 12), i % 12 + 1, 28)


def test_monthly_returns_from_month_end_closes():
    points = [(date(2026, 1, 5), D(90)), (date(2026, 1, 30), D(100)), (date(2026, 2, 27), D(110))]
    assert monthly_returns_pct(points) == {(2026, 2): D(10)}


def test_monthly_changes_with_sign():
    points = [(date(2026, 1, 31), D("4.0")), (date(2026, 2, 28), D("4.5"))]
    assert monthly_changes(points) == {(2026, 2): D("0.5")}
    assert monthly_changes(points, sign=-1) == {(2026, 2): D("-0.5")}


def test_ols_recovers_a_known_slope_with_noise():
    factor, returns = {}, {}
    noise = [D("0.3"), D("-0.2"), D("0.1"), D("-0.4"), D("0.2"), D("0")]
    for i, d in enumerate(_months(36)):
        x = D(i % 7 - 3) / 10
        factor[(d.year, d.month)] = x
        returns[(d.year, d.month)] = 2 * x + noise[i % 6]
    beta = ols_beta(returns, factor, factor_key="f", factor_label="F", min_months=24)
    assert beta.available and beta.n_months == 36
    assert abs(beta.beta - 2) < D("0.5")
    assert beta.significant


def test_min_history_guard_gives_no_number():
    factor = {(2026, m): D(m) for m in range(1, 11)}
    returns = {(2026, m): D(m) for m in range(1, 11)}
    beta = ols_beta(returns, factor, factor_key="f", factor_label="F", min_months=24)
    assert not beta.available
    assert "insufficient history" in beta.reason
    assert "insufficient history" in beta.describe()


def test_flat_factor_is_reported_not_divided_by_zero():
    factor = {(2020 + i // 12, i % 12 + 1): D(1) for i in range(30)}
    returns = {k: D(i) for i, k in enumerate(factor)}
    beta = ols_beta(returns, factor, factor_key="f", factor_label="F", min_months=24)
    assert beta.beta is None and "no variation" in beta.reason


def test_quadrant_tilt_only_from_significant_betas():
    factor, returns = {}, {}
    for i, d in enumerate(_months(30)):
        x = D(i % 5 - 2)
        factor[(d.year, d.month)] = x
        returns[(d.year, d.month)] = -x + (D("0.1") if i % 2 else D("-0.1"))
    growth = ols_beta(returns, factor, factor_key="growth", factor_label="G", min_months=24)
    weak = ols_beta({}, {}, factor_key="inflation", factor_label="I", min_months=24)
    assert quadrant_tilt(weak, growth) == "Historically did better in: falling growth."
