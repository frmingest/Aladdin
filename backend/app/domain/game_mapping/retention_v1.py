"""v1 retention for stored game-state frames (B1 Long Memory, 2026-10-09).

Stored frames cannot be rebuilt, so the worker must not throw history away
faster than it is useful. v1 thins old frames instead of cutting them off:

* the last `daily_days` days keep every daily frame;
* from there to `weekly_days` days old, the latest frame of each ISO week;
* for ever, the latest frame of each calendar month (the "month-end" frame).

These numbers decide only how much history is kept, not how anything is
judged. CLAUDE.md Rule 3: once used for real, a change is a new
`retention_v2.py`, not an edit of this file.

The functions are pure and idempotent: pruning twice keeps what pruning once
kept, because a surviving frame is always the latest of its week or month.
"""
from __future__ import annotations

from collections.abc import Iterable
from dataclasses import dataclass
from datetime import date, timedelta


@dataclass(frozen=True)
class RetentionRules:
    version: str
    daily_days: int
    weekly_days: int


RETENTION_V1 = RetentionRules(version="v1", daily_days=90, weekly_days=730)

_VERSIONS: dict[str, RetentionRules] = {"v1": RETENTION_V1}


def get_retention(version: str) -> RetentionRules:
    try:
        return _VERSIONS[version]
    except KeyError as exc:
        raise ValueError(f"unknown retention version {version!r}") from exc


def frames_to_keep(days: Iterable[date], *, today: date, rules: RetentionRules = RETENTION_V1) -> set[date]:
    """The subset of stored frame `days` that survives pruning today."""
    ordered = sorted(set(days))
    keep: set[date] = set()
    weekly: dict[tuple[int, int], date] = {}
    monthly: dict[tuple[int, int], date] = {}
    for d in ordered:  # oldest first, so a later day overwrites its week/month
        age = (today - d).days
        if age <= rules.daily_days:  # also keeps any frame dated in the future
            keep.add(d)
        elif age <= rules.weekly_days:
            iso = d.isocalendar()
            weekly[(iso.year, iso.week)] = d
        monthly[(d.year, d.month)] = d
    keep.update(weekly.values())
    keep.update(monthly.values())
    return keep


@dataclass(frozen=True)
class Gap:
    first_day: date
    last_day: date

    @property
    def days(self) -> int:
        return (self.last_day - self.first_day).days + 1


def missing_ranges(stored: Iterable[date], *, today: date, rules: RetentionRules = RETENTION_V1) -> list[Gap]:
    """Runs of days inside the daily window, after the first stored frame and
    before today, that have no stored frame. Today is never a gap (the worker
    may not have run yet), and nothing before the first stored frame is: the
    record had not started. Older days are thinned by design, not missing."""
    have = set(stored)
    if not have:
        return []
    start = max(min(have), today - timedelta(days=rules.daily_days))
    gaps: list[Gap] = []
    run_start: date | None = None
    day = start
    while day < today:
        if day in have:
            if run_start is not None:
                gaps.append(Gap(run_start, day - timedelta(days=1)))
                run_start = None
        elif run_start is None:
            run_start = day
        day += timedelta(days=1)
    if run_start is not None:
        gaps.append(Gap(run_start, today - timedelta(days=1)))
    return gaps
