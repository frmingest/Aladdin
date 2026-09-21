"""Shared staleness-check + persistence logic behind macro/sector/company
research refresh.

A `ResearchRun`'s own `completed_at` is the cache (§2.7-style discipline
carried over from the pre-reset build): "is a refresh due" is one query
against the latest COMPLETED run of the right type/scope, not a separate
cache layer — matching app/services/documents/hashing.py's dedup-by-hash
precedent applied to research instead of documents.

On a provider failure (CLAUDE.md: fail visibly, never silently invent), a
FAILED run is always persisted with the real error message. If a prior
COMPLETED run still exists, its (now-stale) items are still returned, with
`reason` explaining why they're stale — a temporarily-down provider
shouldn't take working data off the page; but the caller can always tell
it's not fresh.
"""
from __future__ import annotations

from collections.abc import Callable
from dataclasses import dataclass, field
from datetime import datetime, timezone
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config.settings import get_settings
from app.models.research import ResearchItem as ResearchItemRow
from app.models.research import ResearchRun, ResearchRunStatus
from app.providers.base import ResearchItem, ResearchUnavailableError


@dataclass
class ResearchSnapshot:
    available: bool
    as_of: datetime | None
    items: list[ResearchItemRow] = field(default_factory=list)
    reason: str | None = None


def latest_completed_run(
    db: Session, *, type_: str, sector: str | None = None, holding_id: UUID | None = None
) -> ResearchRun | None:
    stmt = select(ResearchRun).where(
        ResearchRun.type == type_, ResearchRun.status == ResearchRunStatus.COMPLETED.value
    )
    if sector is not None:
        stmt = stmt.where(ResearchRun.sector == sector)
    if holding_id is not None:
        stmt = stmt.where(ResearchRun.holding_id == holding_id)
    stmt = stmt.order_by(ResearchRun.completed_at.desc()).limit(1)
    return db.scalar(stmt)


def is_stale(run: ResearchRun | None) -> bool:
    if run is None or run.completed_at is None:
        return True
    settings = get_settings()
    completed_at = run.completed_at
    if completed_at.tzinfo is None:  # SQLite in tests loses tz-awareness
        completed_at = completed_at.replace(tzinfo=timezone.utc)
    age_seconds = (datetime.now(timezone.utc) - completed_at).total_seconds()
    return age_seconds > settings.research_stale_after_hours * 3600


def items_for_run(db: Session, run: ResearchRun) -> list[ResearchItemRow]:
    stmt = (
        select(ResearchItemRow)
        .where(ResearchItemRow.research_run_id == run.id)
        .order_by(ResearchItemRow.retrieved_at.desc())
    )
    return list(db.scalars(stmt).all())


def _persist_completed_run(
    db: Session,
    *,
    type_: str,
    sector: str | None,
    holding_id: UUID | None,
    items: list[ResearchItem],
    methodology_version: str,
) -> ResearchRun:
    run = ResearchRun(
        type=type_,
        sector=sector,
        holding_id=holding_id,
        status=ResearchRunStatus.COMPLETED.value,
        completed_at=datetime.now(timezone.utc),
        methodology_version=methodology_version,
    )
    db.add(run)
    db.flush()  # assign run.id for the FK below

    for item in items:
        db.add(
            ResearchItemRow(
                research_run_id=run.id,
                holding_id=holding_id,
                source_url=item.source_url,
                source_name=item.source_name,
                title=item.title,
                summary=item.summary,
                source_type=item.source_type,
                published_at=item.published_at,
                retrieved_at=item.retrieved_at,
            )
        )
    db.commit()
    db.refresh(run)
    return run


def _persist_failed_run(
    db: Session,
    *,
    type_: str,
    sector: str | None,
    holding_id: UUID | None,
    methodology_version: str,
    error_message: str,
) -> ResearchRun:
    run = ResearchRun(
        type=type_,
        sector=sector,
        holding_id=holding_id,
        status=ResearchRunStatus.FAILED.value,
        completed_at=datetime.now(timezone.utc),
        methodology_version=methodology_version,
        error_message=error_message,
    )
    db.add(run)
    db.commit()
    db.refresh(run)
    return run


def get_or_refresh(
    db: Session,
    *,
    type_: str,
    sector: str | None,
    holding_id: UUID | None,
    fetch: Callable[[], list[ResearchItem]],
    methodology_version: str,
    force: bool = False,
) -> ResearchSnapshot:
    """The one entry point macro.py/sector.py/company.py call.

    Serves the cached run's items if it's still fresh (and `force` wasn't
    asked for); otherwise calls `fetch()` for real, persists a new
    COMPLETED run on success or a FAILED run on failure, and returns the
    freshest data actually available.
    """
    existing_run = latest_completed_run(db, type_=type_, sector=sector, holding_id=holding_id)
    if not force and not is_stale(existing_run):
        assert existing_run is not None  # is_stale(None) is always True
        return ResearchSnapshot(
            available=True, as_of=existing_run.completed_at, items=items_for_run(db, existing_run)
        )

    try:
        fresh_items = fetch()
    except ResearchUnavailableError as exc:
        _persist_failed_run(
            db,
            type_=type_,
            sector=sector,
            holding_id=holding_id,
            methodology_version=methodology_version,
            error_message=str(exc),
        )
        if existing_run is not None:
            return ResearchSnapshot(
                available=True,
                as_of=existing_run.completed_at,
                items=items_for_run(db, existing_run),
                reason=f"refresh failed, showing cached data from {existing_run.completed_at}: {exc}",
            )
        return ResearchSnapshot(available=False, as_of=None, items=[], reason=str(exc))

    new_run = _persist_completed_run(
        db,
        type_=type_,
        sector=sector,
        holding_id=holding_id,
        items=fresh_items,
        methodology_version=methodology_version,
    )
    return ResearchSnapshot(available=True, as_of=new_run.completed_at, items=items_for_run(db, new_run))
