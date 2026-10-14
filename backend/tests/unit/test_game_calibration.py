"""C2 calibration ledger: pure counting (game mode, 2026-10-14)."""
from __future__ import annotations

import uuid
from decimal import Decimal

from app.domain.game_mapping.calibration_v1 import CALIBRATION_V1 as R
from app.services.game.calibration import CallInput, RunInput, build_calls, build_oracle


def call(action="buy", conf=3, ret="10", months=12):
    return CallInput(uuid.uuid4(), action, conf, None if ret is None else Decimal(ret), months if ret is not None else None)


def test_below_the_gate_gives_a_count_and_no_ratio():
    res = build_calls([call() for _ in range(R.min_n - 1)], R)
    assert (res.n, res.is_open) == (7, False)
    assert res.as_expected is None and res.against is None and res.flat is None
    assert all(not b.shown for b in res.bands)


def test_gate_opens_at_min_n_and_counts_direction():
    calls = [call("buy", 3, "10")] * 5 + [call("sell", 3, "-5")] + [call("buy", 3, "-4")] + [call("buy", 3, "0")]
    res = build_calls(calls, R)
    assert res.n == 8 and res.is_open
    assert (res.as_expected, res.against, res.flat) == (6, 1, 1)


def test_sell_that_rose_is_against():
    res = build_calls([call("trim", 2, "12")] * 8, R)
    assert (res.as_expected, res.against) == (0, 8)


def test_hold_and_missing_confidence_are_left_out_not_counted():
    res = build_calls([call("hold", 3, "5"), call("buy", None, "5")] + [call()] * 8, R)
    assert res.n == 8 and res.left_out == 2


def test_no_outcome_yet_is_waiting():
    res = build_calls([call(ret=None)] * 3 + [call()] * 2, R)
    assert (res.n, res.waiting) == (2, 3)


def test_band_needs_three_decisions_and_an_open_gate():
    calls = [call(conf=5)] * 5 + [call(conf=1)] * 2 + [call(conf=3)] * 1
    res = build_calls(calls, R)
    by = {b.confidence: b for b in res.bands}
    assert by[5].shown and by[5].n == 5 and by[5].as_expected == 5
    assert not by[1].shown and by[1].as_expected is None and by[1].n == 2
    closed = build_calls([call(conf=5)] * 5, R)
    assert not any(b.shown for b in closed.bands)


def run(low="100", high="150", price="120", months=6):
    return RunInput(uuid.uuid4(), Decimal(low), Decimal(high), None if price is None else Decimal(price), months)


def test_oracle_below_inside_above_and_gate():
    few = build_oracle([run()] * 7, R)
    assert not few.is_open and few.inside is None and few.n == 7
    res = build_oracle([run(price="90"), run(price="120"), run(price="150"), run(price="151")] + [run()] * 4, R)
    assert res.is_open and (res.below, res.inside, res.above) == (1, 6, 1)


def test_oracle_run_without_price_waits_and_bad_range_is_ignored():
    res = build_oracle([run(price=None, months=None), run(low="200", high="100")], R)
    assert (res.n, res.waiting) == (0, 1)
