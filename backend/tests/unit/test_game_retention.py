"""B1 Long Memory: retention_v1 thins stored game-state frames by age tier (2026-10-09).
Pure, no database."""
from __future__ import annotations

from datetime import date, timedelta

from app.domain.game_mapping.retention_v1 import (
    RETENTION_V1,
    frames_to_keep,
    get_retention,
)

TODAY = date(2026, 10, 9)  # a Friday


def days_back(*ages: int) -> list[date]:
    return [TODAY - timedelta(days=a) for a in ages]


def test_every_recent_daily_frame_is_kept():
    days = days_back(*range(91))
    assert frames_to_keep(days, today=TODAY) == set(days)


def test_older_frames_keep_one_per_week_the_latest():
    # 2026-03-23 (Mon) .. 2026-03-27 (Fri): one ISO week, 200..196 days back.
    week = days_back(200, 199, 198, 197, 196)
    kept = frames_to_keep(week, today=TODAY)
    assert kept == {TODAY - timedelta(days=196)}


def test_beyond_two_years_only_the_month_end_frame_survives():
    jan = [date(2023, 1, d) for d in (3, 10, 17, 24, 31)]
    other = [date(2023, 2, 7), date(2023, 2, 28)]
    assert frames_to_keep([*jan, *other], today=TODAY) == {date(2023, 1, 31), date(2023, 2, 28)}


def test_pruning_twice_changes_nothing_and_the_newest_frame_always_survives():
    days = days_back(*range(0, 900, 3))
    once = frames_to_keep(days, today=TODAY)
    assert frames_to_keep(once, today=TODAY) == once
    assert max(days) in once and TODAY in once


def test_a_frame_dated_in_the_future_is_never_dropped():
    future = TODAY + timedelta(days=2)
    assert future in frames_to_keep([future], today=TODAY)


def test_no_frames_means_nothing_to_keep():
    assert frames_to_keep([], today=TODAY) == set()


def test_unknown_version_is_refused():
    assert get_retention("v1") is RETENTION_V1
    try:
        get_retention("v9")
    except ValueError:
        return
    raise AssertionError("expected ValueError")
