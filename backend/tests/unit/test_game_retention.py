"""B1 Long Memory: retention_v1 thins stored game-state frames by age tier and
names the days the worker stored nothing (2026-10-09). Pure, no database."""
from __future__ import annotations

from datetime import date, timedelta

from app.domain.game_mapping.retention_v1 import (
    RETENTION_V1,
    Gap,
    frames_to_keep,
    get_retention,
    missing_ranges,
)
from app.domain.game_mapping.time_and_filings_v1 import TIME_AND_FILINGS_V1
from app.services.game.chronicle import build_chronicle_from
from tests.unit.test_game_time_and_filings import _state, tower

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


def test_no_frames_means_nothing_to_keep_and_no_gaps():
    assert frames_to_keep([], today=TODAY) == set()
    assert missing_ranges([], today=TODAY) == []


def test_missing_days_are_reported_only_after_the_record_started_and_never_today():
    stored = [TODAY - timedelta(days=9), TODAY - timedelta(days=8), TODAY - timedelta(days=4), TODAY - timedelta(days=3)]
    gaps = missing_ranges(stored, today=TODAY)
    # days -7..-5 are missing, and -2..-1 (yesterday); today is not a gap, and nothing before -9 is
    assert gaps == [
        Gap(TODAY - timedelta(days=7), TODAY - timedelta(days=5)),
        Gap(TODAY - timedelta(days=2), TODAY - timedelta(days=1)),
    ]
    assert gaps[0].days == 3


def test_thinned_old_days_are_not_reported_as_missing():
    old = date(2026, 2, 1)
    gaps = missing_ranges([old, TODAY], today=TODAY)
    assert gaps and gaps[0].first_day == TODAY - timedelta(days=RETENTION_V1.daily_days)


def test_unknown_version_is_refused():
    assert get_retention("v1") is RETENTION_V1
    try:
        get_retention("v9")
    except ValueError:
        return
    raise AssertionError("expected ValueError")


def test_chronicle_names_unrecorded_days_and_explains_thinning():
    state = _state([tower("Alpha", 100)])
    from datetime import datetime, timezone

    at = datetime(2026, 10, 9, 5, tzinfo=timezone.utc)
    stored = [
        (TODAY - timedelta(days=200), at, state),
        (TODAY - timedelta(days=3), at, state),
        (TODAY - timedelta(days=1), at, state),
    ]
    out = build_chronicle_from(stored, [], TIME_AND_FILINGS_V1, today=TODAY)
    texts = [g.text for g in out.gaps]
    assert out.gaps and out.gaps[0].first_day == TODAY - timedelta(days=90)
    assert all("not even that they were calm" in t for t in texts)
    assert any(g.first_day == g.last_day == TODAY - timedelta(days=2) for g in out.gaps)
    assert any("one per week" in n for n in out.notes)


def test_chronicle_without_today_reports_no_gaps():
    out = build_chronicle_from([], [], TIME_AND_FILINGS_V1)
    assert out.gaps == []
