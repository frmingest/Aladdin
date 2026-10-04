"""Guard for the provider holdings fetches (Xtrackers, L&G).

A holding stores no ISIN of its own, so "does this fund ISIN belong to this
holding?" cannot be answered from the holding. What the app does know is
every feed it has already stored: the fetch writes a `fund_holdings`
document named ``xtrackers-<ISIN>-holdings-<date>.csv`` /
``lgim-<ISIN>-holdings-<date>.csv`` on the holding. That is enough to
refuse the two mix-ups that actually happened (2026-10-03: Xtrackers
Defence's basket was imported onto L&G Gold Mining):

* this ISIN was already fetched onto a *different* holding;
* this holding already carries a feed from a *different* fund ISIN.

Nothing is stored when the guard refuses. To replace a list on purpose,
delete the old holdings document on the fund first (the guard only reads
documents that still exist).
"""
from __future__ import annotations

import re

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.domain.document_types import DOCUMENT_TYPE_FUND_HOLDINGS
from app.models.document import Document
from app.models.holding import Holding

_FEED_FILE = re.compile(r"^(?:xtrackers|lgim)-([A-Z]{2}[A-Z0-9]{9}\d)-holdings-", re.IGNORECASE)


class WrongFundFeedError(Exception):
    """The fetch looks like the wrong fund for this holding — safe to show."""


def feed_isin_of(filename: str) -> str | None:
    match = _FEED_FILE.match(filename or "")
    return match.group(1).upper() if match else None


def check_feed_matches_holding(db: Session, holding: Holding, isin: str) -> None:
    isin = (isin or "").strip().upper()
    if not isin:
        return
    stored = db.execute(
        select(Document.holding_id, Document.original_filename).where(
            Document.type == DOCUMENT_TYPE_FUND_HOLDINGS,
            Document.holding_id.is_not(None),
        )
    ).all()
    own_other_isins: set[str] = set()
    other_holding_ids = set()
    for holding_id, filename in stored:
        feed_isin = feed_isin_of(filename)
        if feed_isin is None:
            continue
        if holding_id == holding.id and feed_isin != isin:
            own_other_isins.add(feed_isin)
        elif holding_id != holding.id and feed_isin == isin:
            other_holding_ids.add(holding_id)

    if other_holding_ids:
        other = db.get(Holding, next(iter(other_holding_ids)))
        label = f"{other.name} ({other.ticker})" if other is not None else "another holding"
        raise WrongFundFeedError(
            f"{isin} was already fetched for {label}, so it looks like the wrong fund for "
            f"{holding.name}. Nothing was imported. Check the fund's own ISIN and issuer."
        )
    if own_other_isins:
        listed = ", ".join(sorted(own_other_isins))
        raise WrongFundFeedError(
            f"{holding.name} already has a holdings list fetched for {listed}; {isin} is a different "
            "fund. Nothing was imported. If the old list was the wrong one, delete its holdings "
            "document on this fund first, then fetch again."
        )
