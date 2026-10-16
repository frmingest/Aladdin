"""Winter Rehearsal (game mode E2, 2026-10-15). Pure arithmetic, so answers are exact."""
from __future__ import annotations

import pathlib
import uuid
from datetime import date, timedelta
from decimal import Decimal

from app.domain.game_mapping.winter_v1 import WINTER_V1 as RULES
from app.services.game.backtest import BacktestHoldingIn
from app.services.game.winter import (
    STATUS_NO_HISTORY,
    STATUS_NO_WINTER,
    STATUS_OK,
    replay_worst_fall,
)

D = Decimal
START = date(2025, 1, 6)


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


def _h(name, points, value=500, reason=None):
    return BacktestHoldingIn(uuid.uuid4(), name, name, None if value is None else D(value), None, points, reason)


def _crash(n=100, down=10, up=5):
    return [D("0.005")] * n + [D("-0.02")] * down + [D("0.01")] * up


def test_replays_the_worst_fall_from_peak_to_trough_in_kroner():
    r = _crash()
    res = replay_worst_fall([_h("A", _series(r), 600), _h("B", _series(r), 400)], RULES, 60)
    assert res.status == STATUS_OK
    days = _days(len(r) + 1)
    assert res.peak_date == days[100] and res.trough_date == days[110]
    assert len(res.points) == 11
    first, last = res.points[0], res.points[-1]
    assert first.value_nok == D("1000.00") and first.change_nok == D("0.00") and first.days_under_water == 0
    expected = D("0.98") ** 10 - 1
    assert last.change == expected.quantize(D("0.0001"))
    assert last.change_nok == (D(1000) * expected).quantize(D("0.01"))
    assert last.days_under_water == 10
    assert res.worst_fall == expected.quantize(D("0.0001"))


def test_kroner_scale_to_the_covered_value_not_the_whole_book():
    r = _crash()
    res = replay_worst_fall(
        [_h("A", _series(r), 600), _h("B", _series(r), 400), _h("Fog", None, 1000, "no history")], RULES, 60
    )
    assert res.status == STATUS_OK
    assert res.covered_value_nok == D("1000.00") and res.covered_value_share == D("0.5000")
    assert res.points[0].value_nok == D("1000.00")


def test_holdings_without_prices_are_fog_with_their_reason():
    r = _crash()
    res = replay_worst_fall(
        [_h("A", _series(r)), _h("B", _series(r)), _h("Fog", None, 100, "no price history stored"), _h("NoValue", _series(r), None)],
        RULES, 60,
    )
    rows = {c.name: c for c in res.coverage}
    assert res.covered_count == 2
    assert rows["Fog"].covered is False and rows["Fog"].reason == "no price history stored"
    assert rows["NoValue"].covered is False and "no value" in rows["NoValue"].reason
    assert rows["A"].covered is True and rows["A"].reason is None


def test_a_small_dip_is_not_dressed_up_as_a_winter():
    r = [D("0.005")] * 100 + [D("-0.02")] * 3 + [D("0.01")] * 20  # about -6%
    res = replay_worst_fall([_h("A", _series(r)), _h("B", _series(r))], RULES, 60)
    assert res.status == STATUS_NO_WINTER and res.points == []
    assert res.worst_fall is not None and D("-0.10") < res.worst_fall < 0
    assert "no real fall" in res.reason


def test_a_book_that_only_rises_has_no_winter_and_a_zero_fall():
    res = replay_worst_fall([_h("A", _series([D("0.01")] * 120)), _h("B", _series([D("0.01")] * 120))], RULES, 60)
    assert res.status == STATUS_NO_WINTER and res.worst_fall == D("0.0000")


def test_a_fall_exactly_at_the_line_counts_as_a_winter():
    # one -10% day from a flat start: the fall equals the line exactly
    r = [D("0")] * 80 + [D("-0.10")] + [D("0.01")] * 5
    res = replay_worst_fall([_h("A", _series(r)), _h("B", _series(r))], RULES, 60)
    assert res.status == STATUS_OK and res.worst_fall == D("-0.1000")


def test_fewer_than_two_covered_holdings_cannot_replay_a_book():
    res = replay_worst_fall([_h("A", _series(_crash())), _h("Fog", None, 100, "none")], RULES, 60)
    assert res.status == STATUS_NO_HISTORY and "at least 2" in res.reason and res.points == []


def test_too_few_shared_days_is_named_not_guessed():
    short = _series([D("-0.02")] * 20)
    res = replay_worst_fall([_h("A", short), _h("B", short)], RULES, 60)
    assert res.status == STATUS_NO_HISTORY and "21 days" in res.reason


def test_replay_is_deterministic():
    r = _crash()
    hs = [_h("A", _series(r), 600), _h("B", _series(r), 400)]
    assert replay_worst_fall(hs, RULES, 60).points == replay_worst_fall(hs, RULES, 60).points


def test_winter_code_is_imported_only_by_the_game_api():
    """Rule 6 (the blind pass never sees what you type here): the replay is read-only and nothing in
    analysis or journal code imports it."""
    root = pathlib.Path(__file__).resolve().parents[2] / "app"
    importers = sorted(
        str(p.relative_to(root)).replace("\\", "/")
        for p in root.rglob("*.py")
        if ("services.game.winter" in p.read_text(encoding="utf-8") or "winter_v1" in p.read_text(encoding="utf-8"))
        and p.name not in {"winter.py", "winter_v1.py"}
    )
    assert importers == ["api/game.py", "config/settings.py", "services/game/winter_view.py"]
