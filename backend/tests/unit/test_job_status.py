"""Unit tests for app.services.job_status (background jobs on the status page)."""
from __future__ import annotations

from datetime import datetime, timedelta, timezone

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import Session

from app.config.settings import Settings
from app.models import Base
from app.models.app_setting import AppSetting
from app.models.macro import MacroSeriesStatus
from app.models.snapshot import ComputedSnapshot
from app.providers.budget import DailyBudgetGuard
from app.services.job_status import (
    build_background_jobs,
    expected_daily_run,
    read_job_run,
    record_job_run,
)
from app.services.system_status import build_system_status

NOW = datetime(2026, 10, 7, 12, tzinfo=timezone.utc)  # tripwires 03, snapshots 04, game 05


@pytest.fixture()
def db():
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(engine)
    with Session(engine) as session:
        yield session


def _settings(**overrides) -> Settings:
    base = {"_env_file": None, "macro_data_provider": "none", "google_ai_studio_api_key": "k",
            "fred_api_key": "f", "sec_edgar_user_agent": "Aladdin test@example.com"}
    base.update(overrides)
    return Settings(**base)


def _jobs(db, *, online=False, now=NOW, **settings):
    return {j.key: j for j in build_background_jobs(db, _settings(**settings), worker_online=online, now=now)}


def _set(db, key, value):
    db.add(AppSetting(key=key, value=value))
    db.commit()


def test_expected_daily_run_is_the_latest_due_moment():
    assert expected_daily_run(NOW, 3) == datetime(2026, 10, 7, 3, tzinfo=timezone.utc)
    early = datetime(2026, 10, 7, 2, 30, tzinfo=timezone.utc)
    assert expected_daily_run(early, 3) == datetime(2026, 10, 6, 3, tzinfo=timezone.utc)


def test_never_ran_daily_job_is_overdue_and_names_the_offline_worker(db):
    job = _jobs(db)["tripwire_check"]
    assert job.status == "warn" and job.last_at is None
    assert "offline" in job.detail and "Has not run yet" in job.detail


def test_overdue_with_online_worker_points_at_the_worker_log(db):
    job = _jobs(db, online=True)["tripwire_check"]
    assert job.status == "warn" and "worker log" in job.detail


def test_daily_job_that_ran_today_is_ok_with_its_summary(db):
    _set(db, "tripwire_check_last_run", (NOW - timedelta(hours=8)).isoformat())
    _set(db, "tripwire_check_last_summary", "2 tripwire(s) on 1 holding(s), 0 newly fired, 0 cleared")
    job = _jobs(db)["tripwire_check"]
    assert job.status == "ok" and "0 newly fired" in job.detail


def test_yesterdays_run_is_fine_before_todays_hour(db):
    early = datetime(2026, 10, 7, 2, tzinfo=timezone.utc)
    _set(db, "snapshots_last_run", datetime(2026, 10, 6, 4, 20, tzinfo=timezone.utc).isoformat())
    assert _jobs(db, now=early)["snapshot_refresh"].status == "ok"


def test_inside_the_grace_period_is_not_a_warning(db):
    just_after = datetime(2026, 10, 7, 4, 30, tzinfo=timezone.utc)  # snapshots due 04:00, nothing yet
    job = _jobs(db, now=just_after)["snapshot_refresh"]
    assert job.status == "ok" and "idle queue" in job.detail


def test_disabled_job_is_off_not_overdue(db):
    assert _jobs(db, tripwire_check_enabled=False)["tripwire_check"].status == "off"


def test_game_state_reads_the_latest_stored_frame(db):
    db.add(ComputedSnapshot(key="game_state:2026-10-07", payload="{}", fingerprint="x",
                            computed_at=NOW - timedelta(hours=6)))
    db.commit()
    job = _jobs(db)["game_state_history"]
    assert job.status == "ok" and job.last_at is not None


def test_event_jobs_report_last_work_and_never_warn(db):
    jobs = _jobs(db)
    assert jobs["warmup"].status == "off" and jobs["keepwarm"].status == "off"
    assert jobs["siege_history"].status == "off" and "not needed" in jobs["siege_history"].detail
    record_job_run(db, "warmup", "AAPL: fetched price", now=NOW)
    when, summary = read_job_run(db, "warmup")
    assert when == NOW and summary == "AAPL: fetched price"
    job = _jobs(db)["warmup"]
    assert job.status == "ok" and job.detail == "AAPL: fetched price"


def test_macro_refresh_states(db):
    assert _jobs(db)["macro_refresh"].status == "off"
    live = {"macro_data_provider": "live", "macro_refresh_interval_hours": 12}
    assert _jobs(db, **live)["macro_refresh"].status == "warn"
    db.add(MacroSeriesStatus(series_key="x", provider="p", last_attempt_at=NOW, last_success_at=NOW - timedelta(hours=2)))
    db.commit()
    assert _jobs(db, **live)["macro_refresh"].status == "ok"
    assert _jobs(db, now=NOW + timedelta(days=5), **live)["macro_refresh"].status == "warn"


def test_never_run_jobs_do_not_flood_needs_attention_on_a_fresh_deployment(db):
    status = build_system_status(db, _settings(), DailyBudgetGuard(daily_limit=20), now=NOW)
    assert {j.key for j in status.jobs} >= {"tripwire_check", "snapshot_refresh", "game_state_history"}
    assert [j.status for j in status.jobs if j.key == "tripwire_check"] == ["warn"]
    assert status.issues == []


def test_a_job_that_ran_before_and_is_now_late_is_flagged(db):
    _set(db, "tripwire_check_last_run", (NOW - timedelta(days=2)).isoformat())
    status = build_system_status(db, _settings(), DailyBudgetGuard(daily_limit=20), now=NOW)
    assert any(i.startswith("Background job: Tripwire check. Overdue") for i in status.issues)
    assert not any("Page snapshot" in i for i in status.issues)  # never ran: row only


def test_worker_online_but_job_never_ran_is_flagged(db):
    from app.services.analysis import queue

    queue.record_heartbeat(db, "pc-1", state="idle", model_name="m", now=NOW - timedelta(seconds=20))
    status = build_system_status(db, _settings(), DailyBudgetGuard(daily_limit=20), now=NOW)
    assert any("worker log" in i for i in status.issues)
