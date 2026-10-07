"""2026-10-07: the worker's housekeeping jobs run on their own thread, so a
slow job can never stop the queue from being polled, and the heartbeat says
what the worker is really doing (state `background_job`, not a false idle)."""
from __future__ import annotations

import threading
import time
from datetime import datetime, timezone

from app.models.analysis import AnalysisWorkerHeartbeat
from app.worker.runner import BACKGROUND_JOB, IDLE, RAN, WAITING_QUOTA
from tests.unit.test_sprint20_speed import _factory, _worker


def _stub_jobs(worker, monkeypatch, seen, *, slow=None):
    names = {
        "maybe_check_tripwires": "tripwires",
        "maybe_refresh_snapshots": "snapshots",
        "maybe_store_game_state": "game",
        "maybe_warm_cold_holdings": "warm",
        "maybe_refresh_siege_history": "siege",
        "maybe_keep_snapshots_warm": "keep",
    }
    for method, label in names.items():
        def job(label=label):
            seen.append(label)
            if slow is not None and label == "snapshots":
                slow()
        monkeypatch.setattr(worker, method, job)


def _heartbeat(factory) -> tuple[str, str | None]:
    with factory() as db:
        beat = db.get(AnalysisWorkerHeartbeat, "pc-1")
        return beat.state, beat.detail


def test_the_queue_is_polled_while_a_slow_job_is_running(monkeypatch):
    worker = _worker(_factory())
    release = threading.Event()
    in_job = threading.Event()
    polls: list[int] = []
    seen: list[str] = []

    def slow():
        in_job.set()
        release.wait(10)

    _stub_jobs(worker, monkeypatch, seen, slow=slow)

    def run_once():
        polls.append(1)
        return IDLE

    monkeypatch.setattr(worker, "run_once", run_once)
    loop = threading.Thread(target=worker.run_forever, daemon=True)
    loop.start()
    try:
        assert in_job.wait(5), "the snapshot job never started"
        before = len(polls)
        deadline = time.monotonic() + 5
        while len(polls) < before + 3 and time.monotonic() < deadline:
            time.sleep(0.01)
        assert len(polls) >= before + 3, "the queue was not polled while the job ran"
        assert not release.is_set()  # the job is still going
    finally:
        release.set()
        worker.stop()
        loop.join(5)
    assert seen[:2] == ["tripwires", "snapshots"]


def test_heartbeat_reports_the_background_job_not_idle():
    factory = _factory()
    worker = _worker(factory)
    worker._set_bg_job(("snapshot refresh", datetime(2026, 10, 7, 9, 41, tzinfo=timezone.utc)))
    state, detail = _heartbeat(factory)
    assert state == BACKGROUND_JOB
    assert detail == "Background job: snapshot refresh (since 09:41 UTC)"
    worker._set_bg_job(None)
    assert _heartbeat(factory)[0] == IDLE


def test_a_running_analysis_wins_over_a_background_job():
    factory = _factory()
    worker = _worker(factory)
    worker._set_state("running", "Analyzing EQNR — Blind pass (40%)")
    worker._set_bg_job(("keep pages warm", datetime.now(timezone.utc)))
    state, detail = _heartbeat(factory)
    assert state == "running"
    assert detail.startswith("Analyzing EQNR")


def test_no_job_starts_after_a_finished_run_or_while_a_run_is_active(monkeypatch):
    worker = _worker(_factory())
    seen: list[str] = []
    _stub_jobs(worker, monkeypatch, seen)
    worker._last_outcome = RAN
    worker.run_background_jobs()
    assert seen == []
    worker._last_outcome = IDLE
    worker._analysis_active.set()
    worker.run_background_jobs()
    assert seen == []
    worker._analysis_active.clear()
    worker.run_background_jobs()
    assert seen == ["tripwires", "snapshots", "game", "warm", "siege", "keep"]


def test_jobs_still_run_while_waiting_for_quota(monkeypatch):
    worker = _worker(_factory())
    seen: list[str] = []
    _stub_jobs(worker, monkeypatch, seen)
    worker._last_outcome = WAITING_QUOTA
    worker.run_background_jobs()
    assert len(seen) == 6


def test_a_pass_stops_starting_jobs_once_a_run_is_claimed(monkeypatch):
    worker = _worker(_factory())
    seen: list[str] = []
    _stub_jobs(worker, monkeypatch, seen, slow=worker._analysis_active.set)
    worker._last_outcome = IDLE
    worker.run_background_jobs()
    assert seen == ["tripwires", "snapshots"]  # no game / warm / siege / keep after the claim


def test_a_crashing_job_is_contained(monkeypatch):
    worker = _worker(_factory())
    seen: list[str] = []
    _stub_jobs(worker, monkeypatch, seen)

    def boom():
        raise RuntimeError("x")

    monkeypatch.setattr(worker, "maybe_refresh_snapshots", boom)
    worker.run_background_jobs()
    assert seen == ["tripwires", "game", "warm", "siege", "keep"]
    assert worker._bg_job is None
