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

from collections.abc import Callable, Iterator
from contextlib import contextmanager
from contextvars import ContextVar
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Generic, TypeVar

from sqlalchemy.orm import Session

T = TypeVar("T")

# What a page shows when nothing has ever been fetched for it yet (shared by
# price / FX / risk-free rate / share count / beta so the wording is one
# thing, and tests can recognise it).
COLD_REASON = "not fetched yet — it is fetched in the background after you add it, or press Refresh"

# A plain GET never makes the first-ever vendor call (see get_or_refresh).
# An analysis run is the exception: it exists to work on current data, so the
# evidence-packet step opens this scope around its valuation. Scoped to the
# current thread / task, and only ever lifts the *cold* rule: stale values are
# still served as they are unless the caller asked for a refresh.
_COLD_FETCH_OK: ContextVar[bool] = ContextVar("market_data_cold_fetch_ok", default=False)


def cold_fetch_is_allowed() -> bool:
    return _COLD_FETCH_OK.get()


@contextmanager
def cold_fetch_allowed() -> Iterator[None]:
    token = _COLD_FETCH_OK.set(True)
    try:
        yield
    finally:
        _COLD_FETCH_OK.reset(token)


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
    refresh_live: bool = True,
) -> MarketDataSnapshot[T]:
    """The one entry point price.py/fx.py/risk_free_rate.py/shares.py call.

    `fetch_and_persist` calls the provider for real, builds the new row,
    `db.add`s + `db.flush`es it, and returns it — this function commits on
    success. It never gets called at all when a fresh-enough observation
    already exists and `force` wasn't asked for.

    `refresh_live=False` (page-load-performance P1, 2026-09-28; cold case
    added in Sprint 20): when a live call would otherwise happen, skip it
    and serve the stale observation instead, or an unavailable snapshot
    (`COLD_REASON`) if nothing has ever been fetched. Used by every plain
    GET in the valuation path so a page load never blocks on a live vendor
    call; the matching POST .../refresh endpoint passes `force=True`, which
    always fetches regardless of this flag.
    """
    existing = latest()
    if not force and existing is not None and _age_hours(observed_at_of(existing)) <= stale_after_hours:
        return MarketDataSnapshot(available=True, as_of=observed_at_of(existing), value=existing)

    if not force and not refresh_live and existing is not None:
        return MarketDataSnapshot(
            available=True,
            as_of=observed_at_of(existing),
            value=existing,
            reason=f"showing data from {observed_at_of(existing)} — click refresh to fetch new data",
        )

    if not force and not refresh_live and not cold_fetch_is_allowed():
        # Sprint 20 (2026-10-03): nothing cached AND the caller is a plain
        # GET. This used to be "the one-time cold-start cost": a brand-new
        # holding's first page load waited on a live vendor call (up to the
        # vendor's timeout; Yahoo may block Railway's IP). A GET never
        # fetches live now: it says what is missing. The first fetch happens
        # off the request, right after the holding is added
        # (app/services/warmup.py), on the PC worker's next pass, or on the
        # page's Refresh button (force=True).
        return MarketDataSnapshot(available=False, as_of=None, value=None, reason=COLD_REASON)

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
