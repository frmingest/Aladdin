"""Background watch for new Oslo Børs Newsweb announcements (2026-10-28).

Every pass looks at the Oslo-listed holdings you own plus the ones on your
watchlist, fetches their recent Newsweb announcement metadata and stores any
message it has not seen before in `newsweb_announcements`. "New" is therefore a
fact in the database (first_seen_at, acknowledged_at), not a guess.

* First look at a holding = baseline: what Newsweb already lists is stored as
  acknowledged, so adding a holding never raises a year of false alarms.
* Read-only toward Newsweb; one failing issuer never stops the others.
* Nothing here runs an analysis or spends LLM quota. A new announcement is a
  signal for you to look at, never a trigger (CLAUDE.md Rule 5: titles are
  untrusted issuer text, stored and shown as data).
"""
from __future__ import annotations

import logging
import time
import uuid
from collections.abc import Callable
from dataclasses import dataclass, field
from datetime import datetime, timezone

from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.models.holding import Holding
from app.models.newsweb_announcement import NewswebAnnouncement
from app.models.watchlist import WatchlistItem
from app.providers.base import ResearchItem, ResearchUnavailableError
from app.providers.newsweb_provider import NewswebAnnouncementsProvider
from app.services.filings.eligibility import newsweb_applies
from app.services.job_status import record_job_run
from app.services.valuation.board import current_positions

log = logging.getLogger("aladdin.newsweb_watch")

JOB_KEY = "newsweb_watch"


@dataclass
class WatchResult:
    checked: int = 0
    new_items: int = 0
    baselined: int = 0
    failed: list[str] = field(default_factory=list)

    def summary(self) -> str:
        parts = [f"checked {self.checked} issuer(s)", f"{self.new_items} new"]
        if self.baselined:
            parts.append(f"{self.baselined} baselined")
        if self.failed:
            parts.append(f"failed: {', '.join(self.failed[:5])}")
        return "; ".join(parts)


def message_id_from_url(url: str) -> str:
    """The Newsweb message id is the last path segment of the message link."""
    return url.rstrip("/").rsplit("/", 1)[-1][:64]


def watched_holdings(db: Session) -> list[Holding]:
    """Newsweb-eligible holdings you own (latest snapshot of each account)
    plus those on the watchlist, each once."""
    ids = {p.holding_id for p in current_positions(db)}
    ids.update(db.scalars(select(WatchlistItem.holding_id)).all())
    if not ids:
        return []
    holdings = db.scalars(select(Holding).where(Holding.id.in_(ids))).all()
    return sorted((h for h in holdings if newsweb_applies(h)), key=lambda h: h.ticker)


def _store(
    db: Session, holding: Holding, items: list[ResearchItem], *, now: datetime, baseline: bool
) -> int:
    """Insert the messages not stored yet; returns how many were added."""
    existing = set(
        db.scalars(select(NewswebAnnouncement.message_id).where(NewswebAnnouncement.holding_id == holding.id))
    )
    added = 0
    for item in items:
        message_id = message_id_from_url(item.source_url)
        if not message_id or message_id in existing:
            continue
        existing.add(message_id)
        db.add(
            NewswebAnnouncement(
                holding_id=holding.id,
                message_id=message_id,
                title=item.title,
                summary=item.summary,
                source_url=item.source_url,
                published_at=item.published_at,
                first_seen_at=now,
                acknowledged_at=now if baseline else None,
            )
        )
        added += 1
    if added:
        try:
            db.commit()
        except IntegrityError:
            # A second process stored the same message first: harmless.
            db.rollback()
            return 0
    return added


def check_holding(
    db: Session, provider: NewswebAnnouncementsProvider, holding: Holding, *, now: datetime
) -> tuple[int, bool]:
    """Fetch and store one holding's announcements. Returns (added, was_baseline)."""
    has_rows = db.scalar(
        select(func.count()).select_from(NewswebAnnouncement).where(NewswebAnnouncement.holding_id == holding.id)
    )
    baseline = not has_rows
    items = provider.get_announcements(holding.ticker)
    return _store(db, holding, items, now=now, baseline=baseline), baseline


def run_watch(
    db: Session,
    provider: NewswebAnnouncementsProvider,
    *,
    pause_seconds: float = 0.0,
    now: datetime | None = None,
    sleep: Callable[[float], None] = time.sleep,
) -> WatchResult:
    """One pass over all watched holdings. Never raises for a single issuer."""
    now = now or datetime.now(timezone.utc)
    result = WatchResult()
    holdings = watched_holdings(db)
    for index, holding in enumerate(holdings):
        if index and pause_seconds > 0:
            sleep(pause_seconds)  # be polite to a public endpoint
        try:
            added, baseline = check_holding(db, provider, holding, now=now)
        except ResearchUnavailableError as exc:
            db.rollback()
            result.failed.append(holding.ticker)
            log.warning("newsweb watch: %s failed: %s", holding.ticker, exc)
            continue
        result.checked += 1
        if baseline:
            result.baselined += added
        else:
            result.new_items += added
    record_job_run(db, JOB_KEY, result.summary(), now=now)
    return result


def list_unread(db: Session, *, limit: int = 200) -> list[tuple[NewswebAnnouncement, Holding]]:
    rows = db.execute(
        select(NewswebAnnouncement, Holding)
        .join(Holding, Holding.id == NewswebAnnouncement.holding_id)
        .where(NewswebAnnouncement.acknowledged_at.is_(None))
        .order_by(NewswebAnnouncement.published_at.desc().nulls_last(), NewswebAnnouncement.first_seen_at.desc())
        .limit(limit)
    ).all()
    return [(a, h) for a, h in rows]


def acknowledge(db: Session, *, holding_id: uuid.UUID | None = None, now: datetime | None = None) -> int:
    """Mark unread announcements as seen (all, or one holding's). Returns the count."""
    now = now or datetime.now(timezone.utc)
    stmt = select(NewswebAnnouncement).where(NewswebAnnouncement.acknowledged_at.is_(None))
    if holding_id is not None:
        stmt = stmt.where(NewswebAnnouncement.holding_id == holding_id)
    rows = db.scalars(stmt).all()
    for row in rows:
        row.acknowledged_at = now
    db.commit()
    return len(rows)
