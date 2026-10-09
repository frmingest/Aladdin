"""The local analysis worker loop (Sprint 5B: F8 local LLM from Railway +
F5 overnight queue).

Runs on Faiz's PC next to Ollama, against the same database as Railway.
Each iteration:

1. release runs whose worker went silent (any worker's, lease expired);
2. check the local LLM is reachable (a stopped Ollama must not burn a run);
3. look at the oldest queued run and check today's Gemini budget covers
   its research refreshes — otherwise wait (the queue resumes after
   00:00 UTC; this is the F5 "overnight queue" behaviour);
4. claim it and run the normal pipeline on it: research (Gemini, from the
   PC), evidence packet, blind pass and reconciliation pass (local LLM).

Safety (CLAUDE.md Rule 5): the worker opens no port and accepts no input
except rows in the shared database. It only reads a holding's inputs and
writes research caches and the analysis run, exactly like the web
server's own run endpoint. An LLM output is a stored record; nothing acts
on it.
"""
from __future__ import annotations

import logging
import threading
import time
import traceback
import uuid
from collections.abc import Callable
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone

from sqlalchemy.orm import Session

from app.config.settings import Settings
from app.models.holding import Holding
from app.providers.base import (
    LLMProvider,
    MarketDataProvider,
    ResearchProvider,
    RiskFreeRateProvider,
)
from app.providers.budget import DailyBudgetGuard
from app.providers.macro_data_providers import MacroDataProvider
from app.providers.newsweb_provider import NewswebAnnouncementsProvider
from app.services.analysis import queue
from app.services.analysis.pipeline import (
    STAGE_PROGRESS,
    NotEquityAnalyzableError,
    run_full_analysis,
)
from app.services.analysis.readiness import research_refreshes_needed
from app.services.job_status import record_job_run

log = logging.getLogger("aladdin.worker")

# Outcomes of one iteration.
RAN = "ran"
IDLE = "idle"
WAITING_QUOTA = "waiting_quota"
LLM_UNAVAILABLE = "llm_unavailable"
# Heartbeat state (not a run_once outcome): no run is being analysed, but the
# housekeeping thread is busy with a background job. The queue is still polled.
BACKGROUND_JOB = "background_job"
# A background job slower than this gets a warning in the log, with its name.
SLOW_JOB_SECONDS = 60.0

# Display text for each pipeline._report_stage() marker (queue progress UI,
# Sprint 15). Percentages come from pipeline.STAGE_PROGRESS so the backend
# has one definition of "how far along is this stage".
STAGE_LABELS: dict[str, str] = {
    "evidence_packet": "Building evidence packet",
    "blind_pass": "Running blind pass (LLM)",
    "reconciliation_pass": "Running reconciliation pass (LLM)",
    "finalizing": "Finalizing",
}


@dataclass(frozen=True)
class LLMHealth:
    ok: bool
    detail: str


@dataclass
class WorkerProviders:
    llm: LLMProvider
    llm_fallback: LLMProvider | None
    market_data: MarketDataProvider
    risk_free_rate: RiskFreeRateProvider
    research: ResearchProvider
    announcements: NewswebAnnouncementsProvider | None
    budget_guard: DailyBudgetGuard | None
    # Numeric macro data (2026-09-24): stale series are re-fetched on the
    # PC before a run. Default None keeps older call sites/tests working.
    macro_data: MacroDataProvider | None = None


class AnalysisWorker:
    def _research_fallback_ready(self) -> bool:
        st = self.settings
        provider = (st.research_fallback_provider or "none").lower()
        if provider == "none":
            return False
        if provider == "tavily":
            return bool(st.tavily_api_key)
        return True

    def __init__(
        self,
        *,
        session_factory: Callable[[], Session],
        settings: Settings,
        providers: WorkerProviders,
        worker_id: str,
        hostname: str | None = None,
        model_name: str | None = None,
        llm_health_check: Callable[[], LLMHealth] | None = None,
    ) -> None:
        self.session_factory = session_factory
        self.settings = settings
        self.providers = providers
        self.worker_id = worker_id
        self.hostname = hostname
        self.model_name = model_name
        self.llm_health_check = llm_health_check or (lambda: LLMHealth(True, "no health check"))
        self._lock = threading.Lock()
        self._state = IDLE
        self._detail: str | None = None
        self._current_run_id: uuid.UUID | None = None
        self._stop = threading.Event()
        # Sprint 20: warm-up retry bookkeeping and the keep-warm throttle.
        self._warm_attempts: dict[uuid.UUID, float] = {}
        self._last_keepwarm = float("-inf")
        self._last_siege_history = float("-inf")
        # 2026-10-07: the housekeeping jobs run on their own thread so a slow
        # one (a snapshot refresh took 13+ minutes) can never stop the queue
        # from being polled. `_bg_job` is (name, started_at) while one runs.
        self._bg_job: tuple[str, datetime] | None = None
        self._analysis_active = threading.Event()
        self._last_outcome: str | None = None

    # --- heartbeat ---------------------------------------------------------

    def _set_state(self, state: str, detail: str | None = None, run_id: uuid.UUID | None = None) -> None:
        with self._lock:
            changed = (state, detail, run_id) != (self._state, self._detail, self._current_run_id)
            self._state, self._detail, self._current_run_id = state, detail, run_id
        if changed:
            self.beat()

    def _effective_state(self) -> tuple[str, str | None, uuid.UUID | None]:
        """What the heartbeat reports. The analysis loop's own state wins;
        only an otherwise idle worker reports that it is busy with a
        background job, so the Queue page never shows a false "Idle"."""
        with self._lock:
            state, detail, run_id = self._state, self._detail, self._current_run_id
            job = self._bg_job
        if state == IDLE and job is not None:
            name, since = job
            return BACKGROUND_JOB, f"Background job: {name} (since {since:%H:%M} UTC)", None
        return state, detail, run_id

    def _set_bg_job(self, job: tuple[str, datetime] | None) -> None:
        with self._lock:
            self._bg_job = job
        self.beat()

    def _on_stage(self, label: str, run_id: uuid.UUID, stage: str) -> None:
        """Called from inside run_full_analysis (same thread) at each
        pipeline stage boundary. The percentage is baked into `detail` as
        `(NN%)` at the end — the frontend parses it back out rather than
        the API carrying a separate field, so this needed no DB migration
        or schema change."""
        pct = STAGE_PROGRESS.get(stage, 0)
        stage_label = STAGE_LABELS.get(stage, stage)
        self._set_state(queue.RUNNING.lower(), f"Analyzing {label} — {stage_label} ({pct}%)", run_id)

    def beat(self, *, started: bool = False) -> None:
        state, detail, run_id = self._effective_state()
        try:
            with self.session_factory() as db:
                queue.record_heartbeat(
                    db,
                    self.worker_id,
                    state=state,
                    detail=detail,
                    current_run_id=run_id,
                    hostname=self.hostname,
                    llm_provider=self.providers.llm.name,
                    model_name=self.model_name,
                    started=started,
                )
        except Exception:  # a missed heartbeat must never kill the worker
            log.exception("heartbeat failed")

    def _heartbeat_loop(self) -> None:
        while not self._stop.wait(self.settings.worker_heartbeat_seconds):
            self.beat()

    # --- one iteration -----------------------------------------------------

    def run_once(self) -> str:
        with self.session_factory() as db:
            released = queue.release_stale_runs(
                db,
                lease=timedelta(minutes=self.settings.worker_lease_minutes),
                max_attempts=self.settings.worker_max_attempts,
            )
            for run_id, action in released:
                log.warning("run %s from a silent worker: %s", run_id, action)

        health = self.llm_health_check()
        if not health.ok:
            self._set_state(LLM_UNAVAILABLE, health.detail)
            return LLM_UNAVAILABLE

        with self.session_factory() as db:
            nxt = queue.peek_next_run(db)
            if nxt is None:
                self._set_state(IDLE, None)
                return IDLE
            guard = self.providers.budget_guard
            # 2026-09-30: with a configured research fallback (Tavily) an
            # exhausted Gemini budget is not a reason to wait -- the research
            # step falls through to the fallback on its own.
            if guard is not None and not self._research_fallback_ready():
                holding = db.get(Holding, nxt.holding_id)
                needed = research_refreshes_needed(db, holding) if holding is not None else 0
                if needed and guard.remaining_today() < needed:
                    detail = (
                        f"Gemini budget left today: {guard.remaining_today()}; the next run needs {needed} "
                        "research call(s). Resumes after 00:00 UTC."
                    )
                    self._set_state(WAITING_QUOTA, detail)
                    return WAITING_QUOTA

        with self.session_factory() as db:
            run = queue.claim_next_run(db, self.worker_id)
            if run is None:
                self._set_state(IDLE, None)
                return IDLE
            run_id = run.id
            holding = db.get(Holding, run.holding_id)
            label = holding.ticker if holding is not None else str(run.holding_id)
            self._analysis_active.set()
            self._set_state(queue.RUNNING.lower(), f"Analyzing {label} — Starting (0%)", run_id)
            log.info("claimed run %s (%s), attempt %s", run_id, label, run.attempts)
            try:
                if holding is None:
                    raise NotEquityAnalyzableError("the holding no longer exists")
                finished = run_full_analysis(
                    db,
                    holding,
                    llm_provider=self.providers.llm,
                    llm_fallback_provider=self.providers.llm_fallback,
                    market_data_provider=self.providers.market_data,
                    risk_free_rate_provider=self.providers.risk_free_rate,
                    research_provider=self.providers.research,
                    announcements_provider=self.providers.announcements,
                    macro_data_provider=self.providers.macro_data,
                    run=run,
                    on_stage=lambda stage: self._on_stage(label, run_id, stage),
                )
                log.info("run %s finished: %s", run_id, finished.status)
            except KeyboardInterrupt:
                db.rollback()
                with self.session_factory() as db2:
                    queue.requeue_interrupted_run(
                        db2, run_id, reason="The worker was stopped mid-run; re-queued."
                    )
                raise
            except NotEquityAnalyzableError as exc:
                db.rollback()
                self._fail(run_id, f"not analyzable: {exc}")
            except Exception as exc:  # fail visibly on the run, keep the worker alive
                db.rollback()
                log.exception("run %s crashed", run_id)
                tb = traceback.format_exception_only(type(exc), exc)
                self._fail(run_id, f"worker error: {''.join(tb).strip()}")
            finally:
                self._analysis_active.clear()
                self._set_state(IDLE, None)
        return RAN

    def maybe_check_tripwires(self) -> None:
        """Sprint 15 #5: the nightly tripwire check, at most once per UTC
        day. Runs between analysis runs on this PC (home IP, so the price
        refresh isn't blocked like Railway's). Never raises — a failed
        check must not stop the analysis queue."""
        if not self.settings.tripwire_check_enabled:
            return
        try:
            from app.services.thesis.nightly import run_check_if_due

            with self.session_factory() as db:
                run_check_if_due(
                    db,
                    market_data_provider=self.providers.market_data,
                    hour_utc=self.settings.tripwire_check_hour_utc,
                )
        except Exception:
            log.exception("nightly tripwire check failed")

    def maybe_refresh_snapshots(self) -> None:
        """2026-09-30 page-load work: rebuild the stored Risk / Performance /
        Margin-of-safety / Watchlist snapshots once per UTC day (after
        `snapshot_refresh_hour_utc`). Never raises."""
        if not self.settings.snapshot_refresh_enabled:
            return
        try:
            from app.services.snapshot_refresh import run_if_due

            with self.session_factory() as db:
                run_if_due(
                    db,
                    market_data_provider=self.providers.market_data,
                    risk_free_rate_provider=self.providers.risk_free_rate,
                    hour_utc=self.settings.snapshot_refresh_hour_utc,
                )
        except Exception:
            log.exception("nightly snapshot refresh failed")

    def maybe_store_game_state(self) -> None:
        """Sprint 24 (G14a): store today's Fortress frame once per UTC day
        (after `game_state_history_hour_utc`), so the Chronicle has history.
        Database only; never raises."""
        if not self.settings.game_state_history_enabled:
            return
        try:
            from app.services.game.history import run_if_due

            with self.session_factory() as db:
                run_if_due(
                    db,
                    hour_utc=self.settings.game_state_history_hour_utc,
                    version=self.settings.active_game_mapping_version,
                )
        except Exception:
            log.exception("game-state history failed")

    def maybe_warm_cold_holdings(self) -> None:
        """Sprint 20: first price / FX / share count / beta for holdings that
        have none (a GET no longer fetches them). A few per pass, a failing
        ticker waits `warmup_retry_seconds`. Never raises."""
        market_data = self.providers.market_data
        if market_data is None:
            return
        try:
            from app.services.warmup import warm_cold_holdings

            with self.session_factory() as db:
                results = warm_cold_holdings(
                    db, market_data, self.providers.risk_free_rate, attempts=self._warm_attempts
                )
            if any(r.fetched for r in results):
                self._last_keepwarm = float("-inf")  # new prices: rebuild the pages now
                with self.session_factory() as db:
                    record_job_run(db, "warmup", "; ".join(r.summary() for r in results if r.fetched))
        except Exception:
            log.exception("holding warm-up failed")

    def maybe_refresh_siege_history(self) -> None:
        """2026-10-07: store daily price history for every holding you own, the
        benchmark and the FX pairs, so the Siege Simulator can measure betas
        for funds, ETFs and metal ETCs too. At most once per
        `siege_history_refresh_interval_seconds`. Never raises."""
        market_data = self.providers.market_data
        if market_data is None or not self.settings.siege_history_refresh_enabled:
            return
        now = time.monotonic()
        if now - self._last_siege_history < self.settings.siege_history_refresh_interval_seconds:
            return
        self._last_siege_history = now
        try:
            from app.domain.game_mapping.siege_scenarios_v1 import get_siege_scenarios
            from app.services.risk.sensitivity_history import (
                refresh_sensitivity_history,
            )

            scenarios = get_siege_scenarios(self.settings.active_siege_scenarios_version)
            with self.session_factory() as db:
                result = refresh_sensitivity_history(db, market_data, scenarios)
                if result.fetched or result.problems:
                    record_job_run(db, "siege_history", result.summary())
        except Exception:
            log.exception("siege price history refresh failed")

    def maybe_keep_snapshots_warm(self) -> None:
        """Sprint 20: rebuild stored pages whose inputs changed (an import, a
        finished analysis, a watchlist change), at most once per
        `snapshot_keepwarm_min_interval_seconds`, and only when the queue is
        idle (the caller checks). Never raises."""
        if not self.settings.snapshot_keepwarm_enabled:
            return
        now = time.monotonic()
        if now - self._last_keepwarm < self.settings.snapshot_keepwarm_min_interval_seconds:
            return
        self._last_keepwarm = now
        try:
            from app.services.snapshot_refresh import rebuild_stale_snapshots

            with self.session_factory() as db:
                rebuilt = rebuild_stale_snapshots(
                    db,
                    market_data_provider=self.providers.market_data,
                    risk_free_rate_provider=self.providers.risk_free_rate,
                )
                if rebuilt:
                    record_job_run(db, "keepwarm", f"rebuilt {', '.join(rebuilt)}")
        except Exception:
            log.exception("keep-warm snapshot rebuild failed")

    def _fail(self, run_id: uuid.UUID, message: str) -> None:
        with self.session_factory() as db:
            queue.fail_run(db, run_id, message=message)

    # --- background jobs ---------------------------------------------------

    def _background_jobs(self) -> list[tuple[str, Callable[[], None]]]:
        return [
            ("tripwire check", self.maybe_check_tripwires),
            ("snapshot refresh", self.maybe_refresh_snapshots),
            ("Fortress history", self.maybe_store_game_state),
            ("holding warm-up", self.maybe_warm_cold_holdings),
            ("siege price history", self.maybe_refresh_siege_history),
            ("keep pages warm", self.maybe_keep_snapshots_warm),
        ]

    def _may_start_background_job(self) -> bool:
        """Jobs only start while the queue is not being worked (2026-10-05
        rule, kept). After a finished run more may be queued, so wait for the
        analysis loop to say it is idle, waiting or without an LLM."""
        if self._stop.is_set() or self._analysis_active.is_set():
            return False
        return self._last_outcome != RAN

    def run_background_jobs(self) -> None:
        """One pass over the housekeeping jobs. Starts no new job once the
        analysis loop has work. Each job already catches its own errors; this
        also times it, so a slow one is named in the log."""
        for name, job in self._background_jobs():
            if not self._may_start_background_job():
                return
            started = time.monotonic()
            self._set_bg_job((name, datetime.now(timezone.utc)))
            try:
                job()
            except Exception:  # defence in depth: the jobs never raise
                log.exception("background job %s crashed", name)
            finally:
                self._set_bg_job(None)
            took = time.monotonic() - started
            if took >= SLOW_JOB_SECONDS:
                log.warning("background job '%s' took %.0f s (the queue was polled meanwhile)", name, took)
            else:
                log.debug("background job '%s' took %.1f s", name, took)

    def _background_loop(self) -> None:
        while not self._stop.is_set():
            self.run_background_jobs()
            self._stop.wait(self.settings.worker_poll_seconds)

    # --- main loop ---------------------------------------------------------

    def stop(self) -> None:
        self._stop.set()

    def run_forever(self, *, once: bool = False) -> None:
        with self.session_factory() as db:
            for run_id, action in queue.recover_own_runs(
                db, self.worker_id, max_attempts=self.settings.worker_max_attempts
            ):
                log.warning("run %s was interrupted by the last shutdown: %s", run_id, action)
        self.beat(started=True)
        heartbeat = threading.Thread(target=self._heartbeat_loop, name="worker-heartbeat", daemon=True)
        heartbeat.start()
        if not once:
            # 2026-10-07: the jobs run on their own thread. Run inline, one
            # slow job (a snapshot refresh took 13+ minutes) held up a run
            # queued while it was going, and the Queue page still said "Idle".
            threading.Thread(target=self._background_loop, name="worker-background", daemon=True).start()
        try:
            while not self._stop.is_set():
                outcome = self.run_once()
                self._last_outcome = outcome
                if once:
                    if outcome != RAN:
                        self.run_background_jobs()  # tests and --once: inline
                    break
                if outcome != RAN:
                    self._stop.wait(self.settings.worker_poll_seconds)
        except KeyboardInterrupt:
            log.info("stopping (Ctrl+C)")
        finally:
            self._stop.set()
            self._set_state("stopped", None)
