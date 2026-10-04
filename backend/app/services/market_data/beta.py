"""Stored beta per ticker (Sprint 20, 2026-10-03).

Price, FX and the risk-free rate have always lived in the database; beta was
the one market input kept only in the Yahoo provider's in-process cache, so
every deploy or restart emptied it and the next valuation had to fetch it
live (or fall back to the default beta). It is now stored too, in the
existing `computed_snapshots` table under the key `beta:<TICKER>` (a stored
copy of a vendor figure, never a source of truth) so **no migration** is
needed.

Same fail-visibly rule as the other market inputs (common.py):

* fresh stored value        -> served, no vendor call;
* `refresh_live=False` (GET) -> the stored value even when stale, or
  "not fetched yet" when none exists: a page load never waits on Yahoo;
* otherwise                  -> one vendor call; a value is stored, a failed
  call keeps (and returns) the older stored value.
"""
from __future__ import annotations

import json
import logging
from dataclasses import dataclass
from datetime import datetime, timezone
from decimal import Decimal, InvalidOperation

from sqlalchemy.orm import Session

from app.config.settings import get_settings
from app.models.snapshot import ComputedSnapshot
from app.providers.base import MarketDataProvider
from app.services.market_data.common import COLD_REASON, cold_fetch_is_allowed

log = logging.getLogger("aladdin.beta")

KEY_PREFIX = "beta:"
_FINGERPRINT = "beta-v1"


@dataclass
class BetaResult:
    value: Decimal | None
    as_of: datetime | None = None
    reason: str | None = None  # why it is missing or old; None when fresh


def beta_key(ticker: str) -> str:
    return f"{KEY_PREFIX}{ticker.strip().upper()}"[:160]


def _aware(value: datetime) -> datetime:
    return value if value.tzinfo is not None else value.replace(tzinfo=timezone.utc)


def _read(db: Session, ticker: str) -> tuple[Decimal, datetime] | None:
    try:
        row = db.get(ComputedSnapshot, beta_key(ticker))
        if row is None:
            return None
        beta = Decimal(str(json.loads(row.payload)["beta"]))
        if not beta.is_finite():
            return None
        return beta, _aware(row.computed_at)
    except (KeyError, ValueError, TypeError, InvalidOperation):
        return None
    except Exception:
        db.rollback()
        log.warning("stored beta for %s unreadable", ticker, exc_info=True)
        return None


def _write(db: Session, ticker: str, beta: Decimal, now: datetime) -> None:
    try:
        key = beta_key(ticker)
        payload = json.dumps({"beta": str(beta)})
        row = db.get(ComputedSnapshot, key)
        if row is None:
            db.add(ComputedSnapshot(key=key, payload=payload, fingerprint=_FINGERPRINT, computed_at=now))
        else:
            row.payload, row.fingerprint, row.computed_at = payload, _FINGERPRINT, now
        db.commit()
    except Exception:
        db.rollback()
        log.warning("could not store beta for %s", ticker, exc_info=True)


def read_stored_beta(db: Session, ticker: str) -> BetaResult:
    """The stored beta exactly as saved, with its age. Never calls a vendor
    and never waits on one (the Siege Simulator and other read-only views)."""
    stored = _read(db, ticker)
    if stored is None:
        return BetaResult(None, None, "no beta stored yet for this holding")
    return BetaResult(stored[0], stored[1])


def get_or_refresh_beta(
    db: Session,
    provider: MarketDataProvider,
    ticker: str,
    *,
    force: bool = False,
    refresh_live: bool = True,
) -> BetaResult:
    stored = _read(db, ticker)
    now = datetime.now(timezone.utc)
    if stored is not None:
        age_hours = (now - stored[1]).total_seconds() / 3600
        fresh = age_hours <= get_settings().beta_stale_after_hours
        if fresh and not force:
            return BetaResult(stored[0], stored[1])
        if not force and not refresh_live:
            return BetaResult(stored[0], stored[1], f"beta from {stored[1].date().isoformat()} — click refresh")
    elif not force and not refresh_live and not cold_fetch_is_allowed():
        return BetaResult(None, None, COLD_REASON)

    try:
        fetched = provider.get_beta(ticker, allow_live_fetch=True)
    except Exception:
        log.warning("beta fetch for %s failed", ticker, exc_info=True)
        fetched = None
    if fetched is not None:
        _write(db, ticker, fetched, now)
        return BetaResult(fetched, now)
    if stored is not None:
        return BetaResult(
            stored[0], stored[1], f"refresh failed, showing beta from {stored[1].date().isoformat()}"
        )
    return BetaResult(None, None, f"{provider.name} has no beta for {ticker}")
