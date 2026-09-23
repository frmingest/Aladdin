"""Decision journal outcomes (feature F6).

For each entry: how the price has moved since the decision, whether that
move is in the decision's favour, and whether its 6- and 12-month reviews
are due. Database-only: prices are the MarketObservation rows the app
already stores (every valuation, board or watchlist view adds one), so
opening the journal never calls a provider. CLAUDE.md Rule 1: all of this
is plain arithmetic here, never the LLM.
"""
from __future__ import annotations

import uuid
from dataclasses import dataclass
from datetime import date, datetime, timedelta, timezone
from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.journal import DecisionJournalEntry
from app.models.market import MarketObservation

HUNDRED = Decimal(100)
REVIEW_6M_DAYS = 182
REVIEW_12M_DAYS = 365
BULLISH = {"buy", "add"}
BEARISH = {"sell", "trim", "pass"}


@dataclass
class PricePoint:
    price: Decimal
    observed_at: datetime


@dataclass
class Outcome:
    days_since: int
    latest_price: Decimal | None = None
    latest_price_at: datetime | None = None
    return_pct: Decimal | None = None
    """Price change since the decision, 0-100 scale."""
    in_favour: bool | None = None
    """Buy/add: the price rose. Sell/trim/pass: it fell. Hold: None."""
    price_6m: Decimal | None = None
    return_6m_pct: Decimal | None = None
    price_12m: Decimal | None = None
    return_12m_pct: Decimal | None = None
    review_6m_due: bool = False
    review_12m_due: bool = False
    note: str | None = None


def _aware(value: datetime) -> datetime:
    return value if value.tzinfo is not None else value.replace(tzinfo=timezone.utc)


def _change(now_price: Decimal, then_price: Decimal) -> Decimal:
    return (now_price / then_price - 1) * HUNDRED


def _observations(db: Session, holding_ids: list[uuid.UUID]) -> dict[uuid.UUID, list[MarketObservation]]:
    if not holding_ids:
        return {}
    rows = db.scalars(
        select(MarketObservation)
        .where(MarketObservation.holding_id.in_(holding_ids))
        .order_by(MarketObservation.observed_at)
    ).all()
    by_holding: dict[uuid.UUID, list[MarketObservation]] = {}
    for row in rows:
        by_holding.setdefault(row.holding_id, []).append(row)
    return by_holding


def _first_on_or_after(obs: list[MarketObservation], day: date, currency: str | None) -> MarketObservation | None:
    for o in obs:
        if _aware(o.observed_at).date() >= day and (currency is None or o.currency == currency):
            return o
    return None


def compute_outcome(
    entry: DecisionJournalEntry, observations: list[MarketObservation], *, today: date
) -> Outcome:
    outcome = Outcome(days_since=(today - entry.decided_on).days)
    outcome.review_6m_due = outcome.days_since >= REVIEW_6M_DAYS and not (entry.review_6m or "").strip()
    outcome.review_12m_due = outcome.days_since >= REVIEW_12M_DAYS and not (entry.review_12m or "").strip()

    matching = [o for o in observations if entry.currency is None or o.currency == entry.currency]
    if observations and not matching:
        outcome.note = f"Stored prices are not in {entry.currency}; no return computed."
    if not matching:
        return outcome
    latest = matching[-1]
    outcome.latest_price, outcome.latest_price_at = latest.price, latest.observed_at
    if entry.price is None or entry.price <= 0:
        return outcome

    outcome.return_pct = _change(latest.price, entry.price)
    if entry.action in BULLISH:
        outcome.in_favour = outcome.return_pct > 0
    elif entry.action in BEARISH:
        outcome.in_favour = outcome.return_pct < 0

    for days, attr in ((REVIEW_6M_DAYS, "6m"), (REVIEW_12M_DAYS, "12m")):
        if outcome.days_since < days:
            continue
        point = _first_on_or_after(matching, entry.decided_on + timedelta(days=days), entry.currency)
        if point is not None:
            setattr(outcome, f"price_{attr}", point.price)
            setattr(outcome, f"return_{attr}_pct", _change(point.price, entry.price))
    return outcome


def outcomes_for(
    db: Session, entries: list[DecisionJournalEntry], *, today: date | None = None
) -> dict[uuid.UUID, Outcome]:
    today = today or datetime.now(timezone.utc).date()
    observations = _observations(db, [e.holding_id for e in entries if e.holding_id is not None])
    return {
        e.id: compute_outcome(e, observations.get(e.holding_id, []) if e.holding_id else [], today=today)
        for e in entries
    }
