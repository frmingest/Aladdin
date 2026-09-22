"""Per-holding Oslo Børs Newsweb announcements, cached through the same
research_runs/research_items machinery as Sprint 2 research
(app/services/research/common.py) under run type ANNOUNCEMENTS — so it
gets the same staleness cache, FAILED-run recording and stale-fallback
behaviour for free, with no new table/migration.
"""
from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy.orm import Session

from app.models.holding import Holding
from app.providers.newsweb_provider import NewswebAnnouncementsProvider
from app.services.filings.eligibility import newsweb_applies
from app.services.research.common import ResearchSnapshot, get_or_refresh

ANNOUNCEMENTS_RUN_TYPE = "ANNOUNCEMENTS"
ANNOUNCEMENTS_METHODOLOGY_VERSION = "newsweb-v1"


def get_holding_announcements(
    db: Session,
    provider: NewswebAnnouncementsProvider | None,
    *,
    holding: Holding,
    force: bool = False,
) -> ResearchSnapshot:
    if not newsweb_applies(holding):
        return ResearchSnapshot(
            available=False,
            as_of=None,
            reason=f"Newsweb covers Oslo Børs issuers only — '{holding.ticker}' is not an .OL/NOK holding",
        )
    if provider is None:
        return ResearchSnapshot(available=False, as_of=None, reason="announcements provider is disabled")
    snapshot = get_or_refresh(
        db,
        type_=ANNOUNCEMENTS_RUN_TYPE,
        sector=None,
        holding_id=holding.id,
        fetch=lambda: provider.get_announcements(holding.ticker),
        methodology_version=ANNOUNCEMENTS_METHODOLOGY_VERSION,
        force=force,
    )
    epoch = datetime.min.replace(tzinfo=timezone.utc)

    def _key(item):
        published = item.published_at
        if published is not None and published.tzinfo is None:  # SQLite drops tz
            published = published.replace(tzinfo=timezone.utc)
        return published or epoch

    snapshot.items.sort(key=_key, reverse=True)
    return snapshot
