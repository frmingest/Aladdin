"""Shared staleness-check + fail-visibly refresh logic for the three
market-data observation types (price, FX, risk-free rate) — generalizes
app/services/research/common.py's get_or_refresh over which model/query
it persists into, via small closures the caller supplies, instead of three
near-identical copies of the same caching logic.

Same fail-visibly discipline as research (CLAUDE.md): a provider failure
never raises into the caller's face and never silently returns nothing
useful when a prior observation exists — it falls back to that (now-stale)
observation with a `reason` explaining why, exactly like
app/services/research/common.py's ResearchSnapshot.reason.
"""
from __future__ import annotations

from collections.abc import Callable
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Generic, TypeVar

from sqlalchemy.orm import Session

T = TypeVar("T")


@dataclass
class MarketDataSnapshot(Generic[T]):
    available: bool
    as_of: datetime | None
    value: T | None
    reason: str | None = None


def _age_hours(observed_at: datetime) -> float:
    if observed_at.tzinfo is None:  # SQLite in tests loses tz-awareness
        observed_at = observed_at.replace(tzinfo=timezone.utc)
    return (datetime.now(timezone.utc) - observed_at).total_seconds() / 3600


def get_or_refresh(
    db: Session,
    *,
    latest: Callable[[], T | None],
    observed_at_of: Callable[[T], datetime],
    fetch_and_persist: Callable[[], T],
    stale_after_hours: int,
    unavailable_error: type[Exception],
    force: bool = False,
) -> MarketDataSnapshot[T]:
    """The one entry point price.py/fx.py/risk_free_rate.py call.

    `fetch_and_persist` calls the provider for real, builds the new row,
    `db.add`s + `db.flush`es it, and returns it — this function commits on
    success. It never gets called at all when a fresh-enough observation
    already exists and `force` wasn't asked for.
    """
    existing = latest()
    if not force and existing is not None and _age_hours(observed_at_of(existing)) <= stale_after_hours:
        return MarketDataSnapshot(available=True, as_of=observed_at_of(existing), value=existing)

    try:
        fresh = fetch_and_persist()
    except unavailable_error as exc:
        if existing is not None:
            return MarketDataSnapshot(
                available=True,
                as_of=observed_at_of(existing),
                value=existing,
                reason=f"refresh failed, showing cached data from {observed_at_of(existing)}: {exc}",
            )
        return MarketDataSnapshot(available=False, as_of=None, value=None, reason=str(exc))

    db.commit()
    return MarketDataSnapshot(available=True, as_of=observed_at_of(fresh), value=fresh)
