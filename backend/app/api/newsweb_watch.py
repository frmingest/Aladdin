"""Endpoints for the Newsweb background watch (2026-10-28).

``GET /sources/newsweb/new`` lists announcements the watch found and you have
not acknowledged yet; ``POST /sources/newsweb/acknowledge`` marks them seen.
Both only touch the database - nothing here calls Newsweb or an LLM; the
backend's scheduler (services/filings/newsweb_watch_scheduler.py) does the
fetching.
"""
from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.config.database import get_db
from app.schemas.newsweb_watch import (
    AcknowledgeIn,
    AcknowledgeOut,
    NewAnnouncementOut,
    NewAnnouncementsOut,
)
from app.services.filings.newsweb_watch import JOB_KEY, acknowledge, list_unread
from app.services.job_status import read_job_run
from app.services.settings.demo_guard import require_not_demo
from app.services.settings.demo_mode import is_demo_mode

router = APIRouter(prefix="/sources/newsweb", tags=["newsweb-watch"])


@router.get("/new", response_model=NewAnnouncementsOut)
def get_new_announcements(db: Session = Depends(get_db)) -> NewAnnouncementsOut:
    last_at, last_summary = read_job_run(db, JOB_KEY)
    if is_demo_mode(db):
        return NewAnnouncementsOut(count=0, items=[], last_checked_at=None, last_summary=None)
    items = [
        NewAnnouncementOut(
            id=a.id,
            holding_id=h.id,
            ticker=h.ticker,
            holding_name=h.name,
            title=a.title,
            summary=a.summary,
            source_url=a.source_url,
            published_at=a.published_at,
            first_seen_at=a.first_seen_at,
        )
        for a, h in list_unread(db)
    ]
    return NewAnnouncementsOut(
        count=len(items), items=items, last_checked_at=last_at, last_summary=last_summary
    )


@router.post("/acknowledge", response_model=AcknowledgeOut)
def acknowledge_announcements(body: AcknowledgeIn, db: Session = Depends(get_db)) -> AcknowledgeOut:
    require_not_demo(db)
    return AcknowledgeOut(acknowledged=acknowledge(db, holding_id=body.holding_id))
