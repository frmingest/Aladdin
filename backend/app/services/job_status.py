"""Background jobs for the System status page (2026-10-07).

Aladdin has several jobs nobody opens a page to start. This module answers,
for each one: where does it run, when is it supposed to run, when did it
last run, and is it late?

* The three daily jobs (tripwire check, snapshot refresh, game-state
  history) run on the PC worker once per UTC day after a configured hour,
  and only while the analysis queue is idle (worker/runner.py, 2026-10-05),
  so a busy day can delay them. A daily job is "late" only after a grace
  period past its hour (`DAILY_GRACE`).
* Warm-up and keep-warm are event-driven, not scheduled: they have no
  deadline, so they never warn — they only report when they last did work.
* The macro refresh runs inside the Railway backend every N hours.

Read-only and database-only, like the rest of the status page: nothing here
calls a provider. The two event-driven jobs leave a run record through
`record_job_run` (generic `app_settings` keys, no migration).
"""
from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timedelta, timezone

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.config.settings import Settings
from app.models.app_setting import AppSetting
from app.models.macro import MacroSeriesStatus
from app.models.snapshot import ComputedSnapshot

OK, WARN, OFF = "ok", "warn", "off"

# A full snapshot refresh has taken 13+ minutes and the daily jobs wait for
# an idle queue, so "after the hour" is not "at the hour".
DAILY_GRACE = timedelta(hours=3)

_RUN_KEY = "job_last_run:"
_SUMMARY_KEY = "job_last_summary:"
_MAX_VALUE = 255  # app_settings.value is String(255)

WORKER = "PC worker"
BACKEND = "Railway backend"


@dataclass
class JobItem:
    key: str
    label: str
    runs_on: str
    schedule: str
    last_at: datetime | None
    status: str
    detail: str = ""


def _aware(value: datetime | None) -> datetime | None:
    if value is None:
        return None
    return value if value.tzinfo is not None else value.replace(tzinfo=timezone.utc)


def _set(db: Session, key: str, value: str) -> None:
    row = db.get(AppSetting, key)
    if row is None:
        db.add(AppSetting(key=key, value=value[:_MAX_VALUE]))
    else:
        row.value = value[:_MAX_VALUE]
        row.updated_at = datetime.now(timezone.utc)


def _get(db: Session, key: str) -> str | None:
    try:
        row = db.get(AppSetting, key)
    except Exception:  # noqa: BLE001 - a missing table must not break the page
        db.rollback()
        return None
    return row.value if row is not None else None


def record_job_run(db: Session, job: str, summary: str, *, now: datetime | None = None) -> None:
    """Remember that `job` did work just now (and a one-line summary).
    Commits; never raises — a failed record must not break the job."""
    now = now or datetime.now(timezone.utc)
    try:
        _set(db, _RUN_KEY + job, now.isoformat())
        _set(db, _SUMMARY_KEY + job, summary)
        db.commit()
    except Exception:  # noqa: BLE001
        db.rollback()


def read_job_run(db: Session, job: str) -> tuple[datetime | None, str | None]:
    raw = _get(db, _RUN_KEY + job)
    when: datetime | None = None
    if raw:
        try:
            when = _aware(datetime.fromisoformat(raw))
        except ValueError:
            when = None
    return when, _get(db, _SUMMARY_KEY + job)


def expected_daily_run(now: datetime, hour_utc: int) -> datetime:
    """The most recent moment the daily job became due (today's hour, or
    yesterday's while today's hour has not come yet)."""
    now = now.astimezone(timezone.utc)
    today = now.replace(hour=hour_utc, minute=0, second=0, microsecond=0)
    return today if now >= today else today - timedelta(days=1)


def _daily(
    key: str,
    label: str,
    *,
    enabled: bool,
    hour_utc: int,
    last_at: datetime | None,
    summary: str | None,
    worker_online: bool,
    now: datetime,
    never_hint: str = "",
) -> JobItem:
    schedule = f"daily after {hour_utc:02d}:00 UTC, when the queue is idle"
    if not enabled:
        return JobItem(key, label, WORKER, schedule, last_at, OFF, "Switched off in settings.")
    last_at = _aware(last_at)
    due = expected_daily_run(now, hour_utc)
    if last_at is not None and last_at >= due:
        return JobItem(key, label, WORKER, schedule, last_at, OK, summary or "")
    if now < due + DAILY_GRACE:
        waiting = f"Due since {due:%H:%M} UTC; waits for an idle queue."
        return JobItem(key, label, WORKER, schedule, last_at, OK, " ".join(p for p in (waiting, never_hint) if p))
    cause = (
        "The PC worker is online but the job did not finish: check the worker log."
        if worker_online
        else "The PC worker is offline, so no daily job runs."
    )
    since = f"Last ran {last_at:%Y-%m-%d %H:%M} UTC. " if last_at else "Has not run yet. "
    return JobItem(key, label, WORKER, schedule, last_at, WARN, f"Overdue. {since}{cause}")


def _event(key: str, label: str, schedule: str, *, enabled: bool, last_at: datetime | None,
           summary: str | None, off_text: str = "") -> JobItem:
    if not enabled:
        return JobItem(key, label, WORKER, schedule, last_at, OFF, off_text or "Switched off in settings.")
    if last_at is None:
        return JobItem(key, label, WORKER, schedule, None, OFF, "Has not needed to do any work yet.")
    return JobItem(key, label, WORKER, schedule, _aware(last_at), OK, summary or "")


def build_background_jobs(
    db: Session, settings: Settings, *, worker_online: bool, now: datetime | None = None
) -> list[JobItem]:
    from app.services import snapshot_refresh
    from app.services.thesis import nightly

    now = (now or datetime.now(timezone.utc)).astimezone(timezone.utc)

    trip_at, trip_summary = nightly.last_check(db)
    snap_at, snap_summary = snapshot_refresh.last_run(db)
    game_at = db.scalar(
        select(func.max(ComputedSnapshot.computed_at)).where(ComputedSnapshot.key.like("game_state:%"))
    )
    warm_at, warm_summary = read_job_run(db, "warmup")
    keep_at, keep_summary = read_job_run(db, "keepwarm")

    jobs = [
        _daily("tripwire_check", "Tripwire check", enabled=settings.tripwire_check_enabled,
               hour_utc=settings.tripwire_check_hour_utc, last_at=trip_at, summary=trip_summary,
               worker_online=worker_online, now=now),
        _daily("snapshot_refresh", "Page snapshot refresh (Risk, Performance, Margin of safety, Watchlist)",
               enabled=settings.snapshot_refresh_enabled, hour_utc=settings.snapshot_refresh_hour_utc,
               last_at=snap_at, summary=snap_summary, worker_online=worker_online, now=now),
        _daily("game_state_history", "Fortress history frame", enabled=settings.game_state_history_enabled,
               hour_utc=settings.game_state_history_hour_utc, last_at=game_at,
               summary="Today's frame is stored." if game_at else "", worker_online=worker_online, now=now,
               never_hint="Not stored while demo mode is on."),
        _event("warmup", "Holding warm-up", "when a holding has no price yet", enabled=True,
               last_at=warm_at, summary=warm_summary),
        _event("keepwarm", "Keep pages warm", "when inputs change, at most every "
               f"{settings.snapshot_keepwarm_min_interval_seconds // 60} min", enabled=settings.snapshot_keepwarm_enabled,
               last_at=keep_at, summary=keep_summary),
    ]
    jobs.append(_macro(db, settings, now))
    return jobs


def _macro(db: Session, settings: Settings, now: datetime) -> JobItem:
    hours = settings.macro_refresh_interval_hours
    schedule = f"every {hours} h" if hours > 0 else "off"
    enabled = hours > 0 and settings.macro_data_provider == "live"
    last = _aware(db.scalar(select(func.max(MacroSeriesStatus.last_success_at))))
    if not enabled:
        return JobItem("macro_refresh", "Macro data refresh", BACKEND, schedule, last, OFF,
                       "Switched off (interval 0 or macro provider is not live).")
    if last is None:
        return JobItem("macro_refresh", "Macro data refresh", BACKEND, schedule, None, WARN,
                       "No successful fetch yet.")
    if now - last > timedelta(hours=max(hours, settings.macro_stale_after_hours) * 2):
        return JobItem("macro_refresh", "Macro data refresh", BACKEND, schedule, last, WARN,
                       "Overdue. The backend has not fetched successfully for a long time.")
    return JobItem("macro_refresh", "Macro data refresh", BACKEND, schedule, last, OK, "")
