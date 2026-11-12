"""Demo-mode flag storage (2026-09-26) - backed by the generic
`app_settings` key/value table (app/models/app_setting.py).

This is a personal, low-traffic app: a plain query per call is fine, no
caching needed (Faiz's own framing of the tradeoff in the spec for this
feature).

Safety note (deliberate design choice, documented here per the spec):
`is_demo_mode` fails CLOSED to False (demo mode reported OFF) on any
error reading the setting. That is the safe default for the read path
that decides whether a page's real data is faked, because a demo-mode
page that unexpectedly shows real data would be silently wrong in the
one way this feature exists to prevent, and an error here happens to
coincide with the DB being unreachable anyway - at which point every
endpoint 500s regardless of what this returns, real-data endpoints
included. There is no path where `is_demo_mode` erroring causes a
real-data endpoint to serve real data it otherwise wouldn't have.

`require_not_demo` (demo_guard.py) is the complementary write-side
guard, and it is NOT told to fail open just because this function fails
closed: if a write endpoint cannot determine the current demo state at
all (this call raises), the guard's caller still has a `db` session in
hand and the same failure will surface from the endpoint's own query
moments later anyway. We do not add a second try/except there to turn
an unknown state into "assume not demo, allow the write" - that would
be the actually dangerous direction to fail in for a write path.
"""
from __future__ import annotations

import contextlib
import random
from datetime import datetime, timezone

from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from app.models.app_setting import AppSetting
from app.models.holding import Holding
from app.models.watchlist import WatchlistItem
from app.services.settings.synthetic_data import DEMO_UNIVERSE_SIZE, set_demo_universe

DEMO_MODE_KEY = "demo_mode"
# The stocks demo mode shows: DEMO_UNIVERSE_SIZE random watchlist picks, chosen once when demo mode is
# switched on. One key per pick ("demo_pick_0" ...), each "TICKER|name|sector", so nothing outgrows the
# 255-character setting value. Only the ticker, name and sector are real; every number is invented.
DEMO_PICK_PREFIX = "demo_pick_"


def is_demo_mode(db: Session) -> bool:
    try:
        setting = db.get(AppSetting, DEMO_MODE_KEY)
    except Exception:  # noqa: BLE001 - any read error fails closed to False, see docstring
        # Fail closed to the SAFE state for this read: report OFF. See
        # this module's docstring for why that is the safe direction here.
        return False
    if setting is None:
        return False
    if setting.value != "true":
        return False
    # Every demo response starts here, so this is where the demo portfolio is kept in step with the
    # stored picks. A read error keeps whatever universe is loaded (the fabricated one at worst).
    with contextlib.suppress(Exception):  # never let a pick lookup break a demo page
        set_demo_universe(_stored_picks(db))
    return True


def _stored_picks(db: Session) -> list[tuple[str, str, str | None]]:
    rows = db.scalars(
        select(AppSetting).where(AppSetting.key.like(f"{DEMO_PICK_PREFIX}%")).order_by(AppSetting.key)
    ).all()
    picks: list[tuple[str, str, str | None]] = []
    for row in sorted(rows, key=lambda r: int(r.key[len(DEMO_PICK_PREFIX):] or 0)):
        ticker, _, rest = row.value.partition("|")
        name, _, sector = rest.partition("|")
        picks.append((ticker, name, sector or None))
    return picks


def _pick_value(ticker: str, name: str, sector: str | None) -> str:
    clean = [part.replace("|", " ") for part in (ticker, name, sector or "")]
    return "|".join(clean)[:255]


def _pick_from_watchlist(db: Session) -> list[tuple[str, str, str | None]]:
    """Up to DEMO_UNIVERSE_SIZE random watchlist stocks as (ticker, name, sector)."""
    holdings = db.scalars(select(Holding).join(WatchlistItem, WatchlistItem.holding_id == Holding.id)).all()
    chosen = random.sample(holdings, min(DEMO_UNIVERSE_SIZE, len(holdings)))
    return [(h.ticker, h.name, h.sector) for h in chosen]


def set_demo_mode(db: Session, enabled: bool) -> None:
    setting = db.get(AppSetting, DEMO_MODE_KEY)
    was_on = setting is not None and setting.value == "true"
    value = "true" if enabled else "false"
    if enabled and not was_on:
        # Switching on: draw a fresh set of watchlist stocks. Already on: keep the stocks being shown.
        db.execute(delete(AppSetting).where(AppSetting.key.like(f"{DEMO_PICK_PREFIX}%")))
        for i, (ticker, name, sector) in enumerate(_pick_from_watchlist(db)):
            db.add(AppSetting(key=f"{DEMO_PICK_PREFIX}{i}", value=_pick_value(ticker, name, sector)))
    elif not enabled:
        db.execute(delete(AppSetting).where(AppSetting.key.like(f"{DEMO_PICK_PREFIX}%")))
    if setting is None:
        setting = AppSetting(key=DEMO_MODE_KEY, value=value)
        db.add(setting)
    else:
        setting.value = value
        setting.updated_at = datetime.now(timezone.utc)
    db.commit()
