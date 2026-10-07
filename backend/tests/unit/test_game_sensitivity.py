"""Siege Simulator v2: a holding's fall-day beta measured from its own prices
against the benchmark (2026-10-07). Pure arithmetic, so the answers are exact."""
from __future__ import annotations

from datetime import date, timedelta
from decimal import Decimal

from app.services.game.sensitivity import (
    METHOD_PRICE_HISTORY,
    caution_for,
    estimate_downside_beta,
    sensitivity_from_history,
    to_nok,
)

D = Decimal
START = date(2025, 1, 6)

# A repeating benchmark pattern with plenty of down days of different sizes.
PATTERN = [D("-0.02"), D("0.01"), D("-0.01"), D("0.015"), D("-0.03"), D("0.005"), D("-0.005"), D("0.02")]


def _days(n):
    out, d = [], START
    while len(out) < n:
        if d.weekday() < 5:
            out.append(d)
        d += timedelta(days=1)
    return out


def _series(returns, *, start=None):
    """Closes from returns: one more close than returns."""
    start = D("100") if start is None else start
    days = _days(len(returns) + 1)
    price, out = start, [(days[0], start)]
    for day, r in zip(days[1:], returns, strict=True):
        price = price * (1 + r)
        out.append((day, price))
    return out


def _bench(n=200):
    return _series([PATTERN[i % len(PATTERN)] for i in range(n)])


def _asset_from(bench_returns, fn):
    return _series([fn(r) for r in bench_returns])


def _bench_returns(n=200):
    return [PATTERN[i % len(PATTERN)] for i in range(n)]


CFG = {"min_observations": 120, "min_down_days": 40}


def test_recovers_a_known_beta_exactly_on_down_days():
    br = _bench_returns()
    asset = _asset_from(br, lambda r: r * D("0.5"))
    est, why = estimate_downside_beta(asset, _bench(), **CFG)
    assert why is None and est is not None
    assert est.beta == D("0.500")
    assert est.r_squared == D("1.0000")
    assert est.observations == len([r for r in br if r < 0])


def test_only_down_days_count_so_an_up_day_overreaction_does_not_move_it():
    br = _bench_returns()
    # falls half as much as the benchmark on down days, but 3x on up days
    asset = _asset_from(br, lambda r: r * D("0.5") if r < 0 else r * 3)
    est, _ = estimate_downside_beta(asset, _bench(), **CFG)
    assert est is not None and est.beta == D("0.500")


def test_a_holding_that_gains_when_the_benchmark_falls_has_a_negative_beta():
    br = _bench_returns()
    asset = _asset_from(br, lambda r: r * D("-0.3"))
    est, _ = estimate_downside_beta(asset, _bench(), **CFG)
    assert est is not None and est.beta == D("-0.300")


def test_a_flat_price_gives_zero_beta_and_a_slow_price_caution():
    flat = _series([D(0)] * 200)
    est, _ = estimate_downside_beta(flat, _bench(), **CFG)
    assert est is not None
    assert est.beta == D("0.000") and est.flat_share == D("1.0000")
    text = caution_for(est, weak_fit_r_squared=D("0.10"), flat_share_warning=D("0.30"))
    assert text is not None and "did not change" in text and "too low" in text
    assert "explains only" in text  # no fit at all is also said


def test_a_good_fit_has_no_caution():
    br = _bench_returns()
    est, _ = estimate_downside_beta(_asset_from(br, lambda r: r), _bench(), **CFG)
    assert est is not None
    assert caution_for(est, weak_fit_r_squared=D("0.10"), flat_share_warning=D("0.30")) is None


def test_too_little_history_gives_a_reason_not_a_number():
    est, why = estimate_downside_beta(_series([D("0.01")] * 50), _bench(50), **CFG)
    assert est is None and why is not None and "only 50 days" in why and "120" in why


def test_too_few_down_days_gives_a_reason():
    up_only = _series([D("0.01")] * 200)
    est, why = estimate_downside_beta(_series([D("0.02")] * 200), up_only, **CFG)
    assert est is None and why is not None and "only 0 days" in why and "fell" in why


def test_returns_are_taken_between_days_both_series_have(monkeypatch):
    # The holding misses every 10th day (a holiday on its exchange): the benchmark's return is
    # then measured over the same two-day span, so the exact relationship survives.
    bench = _bench(300)
    asset_full = _asset_from(_bench_returns(300), lambda r: r)
    asset = [p for i, p in enumerate(asset_full) if i % 10 != 5]
    est, why = estimate_downside_beta(asset, bench, **CFG)
    assert why is None and est is not None
    assert est.beta == D("1.000") and est.r_squared == D("1.0000")


def test_to_nok_uses_the_latest_rate_on_or_before_each_day_and_drops_earlier_closes():
    days = _days(5)
    closes = [(d, D("10")) for d in days]
    fx = [(days[2], D("11")), (days[4], D("12"))]
    out = to_nok(closes, fx)
    assert out == [(days[2], D("110")), (days[3], D("110")), (days[4], D("120"))]
    assert to_nok(closes, None) == closes
    assert to_nok(closes, []) == []


def test_currency_matters_a_flat_euro_price_moves_with_the_krone_rate():
    br = _bench_returns()
    bench = _bench()
    days = [d for d, _ in bench]
    eur_flat = [(d, D("50")) for d in days]
    # EUR/NOK rises 0.4% on the benchmark's down days' amount: NOK value moves with the rate only.
    fx_returns = [r * D("-0.4") for r in br]
    fx = _series(fx_returns, start=D("11"))
    est, why = estimate_downside_beta(to_nok(eur_flat, fx), bench, **CFG)
    assert why is None and est is not None and est.beta == D("-0.400")
    # In local currency the same holding would have looked completely insensitive.
    local, _ = estimate_downside_beta(eur_flat, bench, **CFG)
    assert local is not None and local.beta == D("0.000")


def test_sensitivity_wrapper_labels_the_method_and_carries_the_fit():
    br = _bench_returns()
    s, why = sensitivity_from_history(
        _asset_from(br, lambda r: r * D("0.8")), _bench(),
        weak_fit_r_squared=D("0.10"), flat_share_warning=D("0.30"), as_of=None, **CFG,
    )
    assert why is None and s is not None
    assert s.method == METHOD_PRICE_HISTORY and s.beta == D("0.800")
    assert s.observations and s.r_squared == D("1.0000") and s.caution is None
