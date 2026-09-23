"""Analysis queue for the local worker (Sprint 5B: F8 local LLM from
Railway + F5 overnight queue).

Railway never calls the PC. "Run on my PC" only inserts an
`equity_analysis_runs` row with status QUEUED and engine "local"; the
worker on Faiz's PC (`python -m app.worker`) polls the same database,
claims the oldest queued run, and executes the normal pipeline on it
(app/services/analysis/pipeline.py, `run=` argument). If the PC is off,
the run simply waits.

Claiming is a compare-and-set UPDATE (`... WHERE status = 'QUEUED'`), so
two workers can never both claim one run; on Postgres the candidate row is
also selected FOR UPDATE SKIP LOCKED so concurrent workers don't queue up
behind each other.

Lease: the worker upserts its `analysis_worker_heartbeats` row every ~30 s
from a background thread. A RUNNING local run whose worker hasn't been
seen for `worker_lease_minutes` is released: back to QUEUED, or FAILED
once it has been claimed `worker_max_attempts` times. The lease lives on
the heartbeat table, not on the run row, because the pipeline keeps the
run row dirty in its own transaction during the long LLM calls; a
heartbeat UPDATE on that row from another session would block on its lock.

Nothing here calls an LLM or a network provider.
"""
from __future__ import annotations

import uuid
from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone

from sqlalchemy import select, update
from sqlalchemy.orm import Session

from app.config.settings import Settings
from app.domain.instrument_types import EQUITY_ANALYZABLE_TYPES
from app.models.analysis import (
    PENDING_RUN_STATUSES,
    AnalysisWorkerHeartbeat,
    EquityAnalysisEngine,
    EquityAnalysisRun,
    EquityAnalysisRunStatus,
)
from app.models.holding import Holding
from app.services.analysis.evidence_packet import EVIDENCE_PACKET_VERSION
from app.services.analysis.pipeline import NotEquityAnalyzableError
from app.services.analysis.readiness import check_analysis_readiness

QUEUED = EquityAnalysisRunStatus.QUEUED.value
RUNNING = EquityAnalysisRunStatus.RUNNING.value
FAILED = EquityAnalysisRunStatus.FAILED.value
CANCELLED = EquityAnalysisRunStatus.CANCELLED.value
LOCAL = EquityAnalysisEngine.LOCAL.value

# Readiness checks that decide whether "Queue all ready holdings" includes a
# holding. Provider, quota and local-LLM checks describe *this server's*
# configuration (Railway's), not the worker's, so they're ignored here; the
# worker checks its own LLM before claiming anything.
QUEUE_BLOCKING_CHECKS = frozenset({"instrument_type", "ticker", "financials"})


class RunNotCancellableError(Exception):
    """Only a QUEUED run (not yet claimed by a worker) can be cancelled."""


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _aware(value: datetime | None) -> datetime | None:
    if value is None:
        return None
    return value if value.tzinfo is not None else value.replace(tzinfo=timezone.utc)


# --------------------------------------------------------------------------
# Server side: queue, cancel, list
# --------------------------------------------------------------------------


def pending_run_for_holding(db: Session, holding_id: uuid.UUID) -> EquityAnalysisRun | None:
    """The holding's queued or running local run, if any."""
    return db.scalar(
        select(EquityAnalysisRun)
        .where(
            EquityAnalysisRun.holding_id == holding_id,
            EquityAnalysisRun.engine == LOCAL,
            EquityAnalysisRun.status.in_(PENDING_RUN_STATUSES),
        )
        .order_by(EquityAnalysisRun.started_at.desc())
        .limit(1)
    )


def enqueue_local_run(
    db: Session, holding: Holding, *, settings: Settings, now: datetime | None = None
) -> tuple[EquityAnalysisRun, bool]:
    """Queues a local run for `holding`. Returns (run, created); a holding
    that already has a queued/running local run gets that run back rather
    than a duplicate."""
    if holding.asset_class_raw not in EQUITY_ANALYZABLE_TYPES:
        raise NotEquityAnalyzableError(
            f"holding {holding.ticker!r} is tagged {holding.asset_class_raw!r}, not analyzable as "
            f"equity ({', '.join(sorted(EQUITY_ANALYZABLE_TYPES))} only)"
        )
    existing = pending_run_for_holding(db, holding.id)
    if existing is not None:
        return existing, False

    now = now or _now()
    run = EquityAnalysisRun(
        holding_id=holding.id,
        status=QUEUED,
        engine=LOCAL,
        queued_at=now,
        started_at=now,  # replaced with the claim time when a worker starts it
        # Placeholders: the worker overwrites these with its own code's
        # versions when it executes the run.
        schema_version=settings.active_analysis_schema_version,
        blind_prompt_version=settings.active_analysis_prompt_version,
        evidence_packet_version=EVIDENCE_PACKET_VERSION,
        evidence_packet_json={},
        evidence_unavailable_reasons=[],
        attempts=0,
    )
    db.add(run)
    db.commit()
    db.refresh(run)
    return run, True


def cancel_run(db: Session, run: EquityAnalysisRun) -> EquityAnalysisRun:
    if run.status != QUEUED:
        raise RunNotCancellableError(
            f"run is {run.status}; only a queued run that no worker has started can be cancelled"
        )
    result = db.execute(
        update(EquityAnalysisRun)
        .where(EquityAnalysisRun.id == run.id, EquityAnalysisRun.status == QUEUED)
        .values(status=CANCELLED, error_message="Cancelled before a worker picked it up.")
        .execution_options(synchronize_session=False)
    )
    if result.rowcount != 1:  # claimed between the read and the update
        db.rollback()
        db.refresh(run)
        raise RunNotCancellableError(f"run is {run.status}; a worker has already started it")
    db.commit()
    db.refresh(run)
    return run


def list_queue(db: Session) -> list[EquityAnalysisRun]:
    """Queued and running local runs, oldest first."""
    return list(
        db.scalars(
            select(EquityAnalysisRun)
            .where(EquityAnalysisRun.engine == LOCAL, EquityAnalysisRun.status.in_(PENDING_RUN_STATUSES))
            .order_by(EquityAnalysisRun.queued_at.asc())
        ).all()
    )


def recent_local_runs(db: Session, *, limit: int = 20) -> list[EquityAnalysisRun]:
    """Finished local runs (completed, failed, cancelled), newest first."""
    return list(
        db.scalars(
            select(EquityAnalysisRun)
            .where(EquityAnalysisRun.engine == LOCAL, EquityAnalysisRun.status.notin_(PENDING_RUN_STATUSES))
            .order_by(EquityAnalysisRun.started_at.desc())
            .limit(limit)
        ).all()
    )


@dataclass
class QueueAllResult:
    queued: list[EquityAnalysisRun] = field(default_factory=list)
    already_queued: list[EquityAnalysisRun] = field(default_factory=list)
    skipped: list[tuple[Holding, str]] = field(default_factory=list)


def queue_ready_holdings(db: Session, *, settings: Settings) -> QueueAllResult:
    """F5: queue every currently owned stock / equity ETF that passes the
    readiness checks in QUEUE_BLOCKING_CHECKS. Holdings that already have a
    pending local run are reported, not queued twice."""
    from app.services.valuation.board import current_positions  # avoid an import cycle

    holding_ids: list[uuid.UUID] = []
    for position in current_positions(db):
        if position.holding_id not in holding_ids:
            holding_ids.append(position.holding_id)

    result = QueueAllResult()
    holdings = [db.get(Holding, hid) for hid in holding_ids]
    for holding in sorted((h for h in holdings if h is not None), key=lambda h: (h.name or h.ticker or "")):
        if holding.asset_class_raw not in EQUITY_ANALYZABLE_TYPES:
            continue  # bonds, money market, commodities: never analyzable, not worth listing
        report = check_analysis_readiness(db, holding, settings=settings, budget_guard=None)
        blockers = [c for c in report.checks if c.status == "block" and c.key in QUEUE_BLOCKING_CHECKS]
        if blockers:
            result.skipped.append((holding, " ".join(f"{c.label}: {c.detail}" for c in blockers)))
            continue
        run, created = enqueue_local_run(db, holding, settings=settings)
        (result.queued if created else result.already_queued).append(run)
    return result


# --------------------------------------------------------------------------
# Worker side: claim, release, heartbeat
# --------------------------------------------------------------------------


def peek_next_run(db: Session) -> EquityAnalysisRun | None:
    """The run the next claim would take, without claiming it."""
    return db.scalar(
        select(EquityAnalysisRun)
        .where(EquityAnalysisRun.status == QUEUED, EquityAnalysisRun.engine == LOCAL)
        .order_by(EquityAnalysisRun.queued_at.asc())
        .limit(1)
    )


def claim_next_run(db: Session, worker_id: str, *, now: datetime | None = None) -> EquityAnalysisRun | None:
    """Atomically moves the oldest QUEUED local run to RUNNING for
    `worker_id`. Returns None when the queue is empty or another worker
    won the race."""
    now = now or _now()
    candidate = db.scalar(
        select(EquityAnalysisRun)
        .where(EquityAnalysisRun.status == QUEUED, EquityAnalysisRun.engine == LOCAL)
        .order_by(EquityAnalysisRun.queued_at.asc())
        .limit(1)
        .with_for_update(skip_locked=True)
    )
    if candidate is None:
        db.rollback()
        return None
    result = db.execute(
        update(EquityAnalysisRun)
        .where(EquityAnalysisRun.id == candidate.id, EquityAnalysisRun.status == QUEUED)
        .values(
            status=RUNNING,
            claimed_by=worker_id,
            claimed_at=now,
            started_at=now,
            attempts=EquityAnalysisRun.attempts + 1,
            error_message=None,
        )
        .execution_options(synchronize_session=False)
    )
    if result.rowcount != 1:
        db.rollback()
        return None
    db.commit()
    db.refresh(candidate)
    return candidate


def _release(run: EquityAnalysisRun, *, reason: str, max_attempts: int) -> str:
    if (run.attempts or 0) >= max_attempts:
        run.status = FAILED
        run.error_message = f"{reason} Gave up after {run.attempts} attempt(s)."
        return "failed"
    run.status = QUEUED
    run.claimed_by = None
    run.claimed_at = None
    run.error_message = f"{reason} Re-queued (attempt {run.attempts} of {max_attempts})."
    return "requeued"


def release_stale_runs(
    db: Session, *, lease: timedelta, max_attempts: int, now: datetime | None = None
) -> list[tuple[uuid.UUID, str]]:
    """Releases RUNNING local runs whose worker has been silent longer than
    `lease` (or has no heartbeat row at all). Returns (run_id, action)."""
    now = now or _now()
    running = db.scalars(
        select(EquityAnalysisRun).where(EquityAnalysisRun.status == RUNNING, EquityAnalysisRun.engine == LOCAL)
    ).all()
    if not running:
        return []
    beats = {b.worker_id: b for b in db.scalars(select(AnalysisWorkerHeartbeat)).all()}
    released: list[tuple[uuid.UUID, str]] = []
    for run in running:
        beat = beats.get(run.claimed_by or "")
        last_seen = _aware(beat.last_seen_at) if beat is not None else None
        if last_seen is not None and now - last_seen <= lease:
            continue
        silent = "never seen" if last_seen is None else f"silent since {last_seen:%Y-%m-%d %H:%M} UTC"
        action = _release(
            run,
            reason=f"Worker '{run.claimed_by}' stopped responding ({silent}).",
            max_attempts=max_attempts,
        )
        released.append((run.id, action))
    db.commit()
    return released


def recover_own_runs(db: Session, worker_id: str, *, max_attempts: int) -> list[tuple[uuid.UUID, str]]:
    """On worker start-up: runs this worker still holds as RUNNING were
    interrupted (crash, reboot, closed window). Release them now instead of
    waiting for the lease to expire."""
    runs = db.scalars(
        select(EquityAnalysisRun).where(
            EquityAnalysisRun.status == RUNNING,
            EquityAnalysisRun.engine == LOCAL,
            EquityAnalysisRun.claimed_by == worker_id,
        )
    ).all()
    released = [
        (run.id, _release(run, reason="The worker restarted while this run was in progress.", max_attempts=max_attempts))
        for run in runs
    ]
    db.commit()
    return released


def requeue_interrupted_run(db: Session, run_id: uuid.UUID, *, reason: str) -> None:
    """Worker shut down cleanly (Ctrl+C) mid-run: put the run back without
    counting the attempt against it."""
    run = db.get(EquityAnalysisRun, run_id)
    if run is None or run.status != RUNNING:
        return
    run.status = QUEUED
    run.claimed_by = None
    run.claimed_at = None
    run.attempts = max((run.attempts or 1) - 1, 0)
    run.error_message = reason
    db.commit()


def fail_run(db: Session, run_id: uuid.UUID, *, message: str) -> None:
    """An unexpected exception escaped the pipeline: record it on the run
    (fail visibly) instead of leaving it RUNNING until the lease expires."""
    run = db.get(EquityAnalysisRun, run_id)
    if run is None:
        return
    run.status = FAILED
    run.error_message = message[:4000]
    db.commit()


def record_heartbeat(
    db: Session,
    worker_id: str,
    *,
    state: str,
    detail: str | None = None,
    current_run_id: uuid.UUID | None = None,
    hostname: str | None = None,
    llm_provider: str | None = None,
    model_name: str | None = None,
    now: datetime | None = None,
    started: bool = False,
) -> AnalysisWorkerHeartbeat:
    now = now or _now()
    beat = db.get(AnalysisWorkerHeartbeat, worker_id)
    if beat is None:
        beat = AnalysisWorkerHeartbeat(worker_id=worker_id, started_at=now, state=state)
        db.add(beat)
    if started:
        beat.started_at = now
    beat.state = state
    beat.detail = detail
    beat.current_run_id = current_run_id
    beat.last_seen_at = now
    if hostname is not None:
        beat.hostname = hostname
    if llm_provider is not None:
        beat.llm_provider = llm_provider
    if model_name is not None:
        beat.model_name = model_name
    db.commit()
    return beat


@dataclass(frozen=True)
class WorkerStatus:
    worker_id: str
    hostname: str | None
    llm_provider: str | None
    model_name: str | None
    state: str
    detail: str | None
    current_run_id: uuid.UUID | None
    started_at: datetime
    last_seen_at: datetime
    online: bool


def worker_statuses(db: Session, *, settings: Settings, now: datetime | None = None) -> list[WorkerStatus]:
    now = now or _now()
    window = timedelta(seconds=settings.worker_online_seconds)
    beats = db.scalars(
        select(AnalysisWorkerHeartbeat).order_by(AnalysisWorkerHeartbeat.last_seen_at.desc())
    ).all()
    out: list[WorkerStatus] = []
    for beat in beats:
        last_seen = _aware(beat.last_seen_at)
        out.append(
            WorkerStatus(
                worker_id=beat.worker_id,
                hostname=beat.hostname,
                llm_provider=beat.llm_provider,
                model_name=beat.model_name,
                state=beat.state,
                detail=beat.detail,
                current_run_id=beat.current_run_id,
                started_at=_aware(beat.started_at),
                last_seen_at=last_seen,
                online=beat.state != "stopped" and now - last_seen <= window,
            )
        )
    return out
