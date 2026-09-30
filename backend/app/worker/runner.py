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
import traceback
import uuid
from collections.abc import Callable
from dataclasses import dataclass
from datetime import timedelta

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

log = logging.getLogger("aladdin.worker")

# Outcomes of one iteration.
RAN = "ran"
IDLE = "idle"
WAITING_QUOTA = "waiting_quota"
LLM_UNAVAILABLE = "llm_unavailable"

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

    # --- heartbeat ---------------------------------------------------------

    def _set_state(self, state: str, detail: str | None = None, run_id: uuid.UUID | None = None) -> None:
        with self._lock:
            changed = (state, detail, run_id) != (self._state, self._detail, self._current_run_id)
            self._state, self._detail, self._current_run_id = state, detail, run_id
        if changed:
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
        with self._lock:
            state, detail, run_id = self._state, self._detail, self._current_run_id
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

    def _fail(self, run_id: uuid.UUID, message: str) -> None:
        with self.session_factory() as db:
            queue.fail_run(db, run_id, message=message)

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
        try:
            while not self._stop.is_set():
                outcome = self.run_once()
                self.maybe_check_tripwires()
                self.maybe_refresh_snapshots()
                if once:
                    break
                if outcome != RAN:
                    self._stop.wait(self.settings.worker_poll_seconds)
        except KeyboardInterrupt:
            log.info("stopping (Ctrl+C)")
        finally:
            self._stop.set()
            self._set_state("stopped", None)
