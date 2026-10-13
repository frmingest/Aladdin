"""Siege back-test (game mode C1, 2026-10-13). Pure arithmetic, so answers are exact."""
from __future__ import annotations

import uuid
from dataclasses import replace
from datetime import date, timedelta
from decimal import Decimal

from app.domain.game_mapping.backtest_v1 import BACKTEST_V1 as RULES
from app.domain.game_mapping.siege_scenarios_v3 import SIEGE_SCENARIOS_V3 as S3
from app.services.game.backtest import (
    VERDICT_CLOSE,
    VERDICT_FELL_MORE,
    BacktestHoldingIn,
    check_holding,
    run_backtest,
    worst_episode,
)
from app.services.game.sensitivity import estimate_downside_beta

D = Decimal
START = date(2025, 1, 6)
UP = [D("-0.01"), D("0.02"), D("-0.005"), D("0.015")]  # drifts up, 100 down days in 200


def _days(n):
    out, d = [], START
    while len(out) < n:
        if d.weekday() < 5:
            out.append(d)
        d += timedelta(days=1)
    return out


def _series(returns, start=None):
    start = D("100") if start is None else start
    days = _days(len(returns) + 1)
    price, out = start, [(days[0], start)]
    for day, r in zip(days[1:], returns, strict=True):
        price = price * (1 + r)
        out.append((day, price))
    return out


def _bench_returns(n=200, crash=10, after=20):
    return [UP[i % 4] for i in range(n)] + [D("-0.02")] * crash + [D("0.01")] * after


def _h(ticker, points, value=500, reason=None):
    return BacktestHoldingIn(uuid.uuid4(), ticker, ticker, D(value), None, points, reason)


def test_worst_episode_is_the_deepest_peak_to_trough_fall():
    bench = _series(_bench_returns())
    ep = worst_episode(bench, RULES)
    days = _days(len(bench))
    assert ep is not None
    assert ep.peak_date == days[200] and ep.trough_date == days[210]
    assert ep.fall == (D("0.98") ** 10 - 1).quantize(D("0.0001"))
    assert ep.trading_days == 11 and ep.significant is True
    assert ep.recovered is False  # 20 days of +1% do not regain an 18% fall


def test_a_benchmark_that_only_rises_has_no_episode():
    assert worst_episode(_series([D("0.01")] * 150), RULES) is None


def test_small_fall_is_marked_not_significant():
    bench = _series([D("0.01")] * 150 + [D("-0.02")] * 2 + [D("0.01")] * 10)
    ep = worst_episode(bench, RULES)
    assert ep is not None and ep.significant is False


def test_exclude_leaves_out_the_returns_inside_the_range():
    br = _bench_returns()
    bench = _series(br)
    asset = _series([r * D("0.5") for r in br])
    days = _days(len(bench))
    kw = {"min_observations": 120, "min_down_days": 40}
    full, _ = estimate_downside_beta(asset, bench, **kw)
    cut, _ = estimate_downside_beta(asset, bench, exclude=(days[200], days[210]), **kw)
    assert full is not None and cut is not None
    assert cut.observations == full.observations - 10  # the crash days are not in the second fit
    assert cut.beta == D("0.5")


def test_a_holding_that_follows_its_beta_is_close():
    br = _bench_returns()
    bench = _series(br)
    ep = worst_episode(bench, RULES)
    r = check_holding(_h("A", _series([x * D("0.5") for x in br])), bench, ep, S3, RULES)
    assert r.tested and r.beta == D("0.5") and r.beta_basis == "without_episode"
    assert r.verdict == VERDICT_CLOSE and abs(r.error) <= RULES.close_points
    assert r.predicted == (ep.fall * D("0.5")).quantize(D("0.0001"))
    assert r.caution is None


def test_a_holding_that_fell_harder_in_the_episode_is_flagged_and_signed():
    br = _bench_returns()
    bench = _series(br)
    ep = worst_episode(bench, RULES)
    held = [x * D("0.5") for x in br[:200]] + [D("-0.04")] * 10 + [x * D("0.5") for x in br[210:]]
    r = check_holding(_h("B", _series(held)), bench, ep, S3, RULES)
    assert r.verdict == VERDICT_FELL_MORE
    assert r.error < D("-0.2") and r.actual < r.predicted  # fell more than the page would have said


def test_a_holding_whose_prices_start_after_the_fall_began_is_not_tested():
    br = _bench_returns()
    bench = _series(br)
    ep = worst_episode(bench, RULES)
    late = _series([D("0.01")] * 40)[0:]
    shifted = [(d + timedelta(days=400), p) for d, p in late]
    r = check_holding(_h("L", shifted), bench, ep, S3, RULES)
    assert not r.tested and "start after" in r.reason


def test_no_history_is_not_tested_with_the_reason_given():
    br = _bench_returns()
    bench = _series(br)
    ep = worst_episode(bench, RULES)
    r = check_holding(_h("N", None, reason="no price history stored for this holding"), bench, ep, S3, RULES)
    assert not r.tested and r.reason == "no price history stored for this holding" and r.predicted is None


def test_too_few_other_falling_days_falls_back_to_all_days_with_a_caution():
    small = replace(S3, min_observations=30, min_down_days=10)
    br = [D("0.01")] * 40 + [D("-0.01")] * 5 + [D("-0.02")] * 10 + [D("0.01")] * 5
    bench = _series(br)
    ep = worst_episode(bench, RULES)
    r = check_holding(_h("S", _series([x * D("0.5") for x in br])), bench, ep, small, RULES)
    assert r.tested and r.beta_basis == "all_days" and "includes it" in r.caution


def test_run_backtest_replays_the_book_and_counts_days_under_water():
    br = _bench_returns()
    bench = _series(br)
    a = _series([x * D("0.5") for x in br])
    b = _series([x * D("1.0") for x in br])
    res = run_backtest([_h("A", a), _h("B", b), _h("N", None, reason="no price history")], bench, S3, RULES)
    assert res.tested_count == 2 and res.close_count == 2
    assert res.tested_value_share == D("0.6667")
    assert res.mean_abs_error is not None and res.mean_abs_error <= RULES.close_points
    assert [t.tested for t in res.holdings] == [True, True, False]  # untested last
    book = res.book
    assert book is not None and book.holdings_used == 2
    # constant weights 50/50 of beta 0.5 and 1.0 -> about 0.75 x the benchmark's fall
    assert D("-0.17") < book.actual_fall < D("-0.10")
    assert abs(book.error) < D("0.03")
    assert book.max_drawdown <= book.actual_fall + D("0.001")
    assert book.under_water_now_days > 0 and book.longest_under_water_days >= book.under_water_now_days


def test_one_testable_holding_gives_no_book_and_says_why():
    br = _bench_returns()
    bench = _series(br)
    res = run_backtest([_h("A", _series([x * D("0.5") for x in br]))], bench, S3, RULES)
    assert res.tested_count == 1 and res.book is None and "fewer than 2" in res.book_reason


def test_no_episode_returns_an_empty_result():
    res = run_backtest([], _series([D("0.01")] * 150), S3, RULES)
    assert res.episode is None and res.holdings == [] and res.book is None
