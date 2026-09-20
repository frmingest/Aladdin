"""Shared helpers for the research refresh/read services (macro.py, sector.py)
— architecture §2.7 "cache aggressively": a research_runs row's own
completed_at is the cache, so "is a refresh due" is one query, not a
separate cache layer (matching the Phase 2 valuation service's per-run
_FxCache precedent for the same principle at a smaller scale)."""

from datetime import datetime, timedelta, timezone
from uuid import UUID

from sqlalchemy.orm import Session

from app.models.research import ResearchRun, ResearchRunStatus, ResearchRunType


def latest_completed_run(
    db: Session,
    run_type: ResearchRunType,
    sector: str | None = None,
    holding_id: "UUID | None" = None,
) -> ResearchRun | None:
    query = db.query(ResearchRun).filter(
        ResearchRun.type == run_type.value,
        ResearchRun.status.in_([ResearchRunStatus.COMPLETED.value, ResearchRunStatus.PARTIAL.value]),
    )
    if run_type is ResearchRunType.SECTOR:
        query = query.filter(ResearchRun.sector == sector)
    elif run_type is ResearchRunType.COMPANY:
        # Phase 11 Sprint 2 — a COMPANY run is scoped to one holding the same
        # way a SECTOR run is scoped to one sector; a stale-check for holding
        # A must never be satisfied by holding B's fresh run.
        query = query.filter(ResearchRun.holding_id == holding_id)
    return query.order_by(ResearchRun.completed_at.desc()).first()


def is_stale(run: ResearchRun | None, max_age: timedelta) -> bool:
    if run is None or run.completed_at is None:
        return True
    completed_at = run.completed_at
    if completed_at.tzinfo is None:  # SQLite loses tz-awareness on round-trip
        completed_at = completed_at.replace(tzinfo=timezone.utc)
    return datetime.now(timezone.utc) - completed_at > max_age
