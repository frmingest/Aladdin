"""G14a (Sprint 24): one stored game-state frame per UTC day.

History cannot be backfilled: `computed_snapshots` rows are keyed and
overwritten, so yesterday's walls, moats and weather are gone the moment
today's are stored. Saving the Fortress state once a night starts the record
the Chronicle (G14) replays.

* Stored in the existing `computed_snapshots` table under
  `game_state:YYYY-MM-DD` (UTC day). **No migration.** A stored frame is a
  record of what the fortress looked like; it is never read back as live state.
* Written by the worker, never by a page load; demo mode is never stored.
* Pruned past `game_state_history_keep_days` (default 540).
* One failing write never breaks the worker or the live Fortress.
"""
from __future__ import annotations

import logging
from datetime import date, datetime, timedelta, timezone

from pydantic import ValidationError
from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from app.models.snapshot import ComputedSnapshot
from app.schemas.game import GameStateOut

log = logging.getLogger("aladdin.game_history")

KEY_PREFIX = "game_state:"
FINGERPRINT = "game-state-frame-v1"


def frame_key(day: date) -> str:
    return f"{KEY_PREFIX}{day.isoformat()}"


def _aware(value: datetime) -> datetime:
    return value if value.tzinfo is not None else value.replace(tzinfo=timezone.utc)


def day_of(key: str) -> date | None:
    try:
        return date.fromisoformat(key.removeprefix(KEY_PREFIX))
    except ValueError:
        return None


def is_due(db: Session, *, now: datetime, hour_utc: int) -> bool:
    """True once per UTC day, after `hour_utc`, while today's frame is missing."""
    now = _aware(now).astimezone(timezone.utc)
    if now.hour < hour_utc:
        return False
    try:
        return db.get(ComputedSnapshot, frame_key(now.date())) is None
    except Exception:  # noqa: BLE001 - a missing table must not stop the worker
        db.rollback()
        return False


def store_frame(db: Session, state: GameStateOut, *, day: date, now: datetime | None = None) -> bool:
    """Save `state` as the frame for `day` (replacing a same-day frame).
    Returns False, without raising, when it could not be stored."""
    now = now or datetime.now(timezone.utc)
    try:
        key = frame_key(day)
        payload = state.model_dump_json()
        row = db.get(ComputedSnapshot, key)
        if row is None:
            db.add(ComputedSnapshot(key=key, payload=payload, fingerprint=FINGERPRINT, computed_at=now))
        else:
            row.payload, row.fingerprint, row.computed_at = payload, FINGERPRINT, now
        db.commit()
        return True
    except Exception:
        db.rollback()
        log.warning("could not store game-state frame for %s", day, exc_info=True)
        return False


def prune(db: Session, *, today: date, keep_days: int) -> int:
    """Delete frames older than `keep_days`. Returns how many were removed."""
    cutoff = today - timedelta(days=keep_days)
    try:
        keys = [k for (k,) in db.execute(select(ComputedSnapshot.key).where(ComputedSnapshot.key.like(f"{KEY_PREFIX}%")))]
        old = [k for k in keys if (d := day_of(k)) is not None and d < cutoff]
        if not old:
            return 0
        db.execute(delete(ComputedSnapshot).where(ComputedSnapshot.key.in_(old)))
        db.commit()
        return len(old)
    except Exception:
        db.rollback()
        log.warning("could not prune game-state frames", exc_info=True)
        return 0


def load_frames(db: Session) -> list[tuple[date, datetime, GameStateOut]]:
    """Every stored frame, oldest first: (day, stored-at, state). A frame that
    no longer parses (a schema moved on) is skipped, never guessed at."""
    out: list[tuple[date, datetime, GameStateOut]] = []
    rows = db.execute(
        select(ComputedSnapshot.key, ComputedSnapshot.payload, ComputedSnapshot.computed_at).where(
            ComputedSnapshot.key.like(f"{KEY_PREFIX}%")
        )
    ).all()
    for key, payload, computed_at in rows:
        day = day_of(key)
        if day is None:
            continue
        try:
            out.append((day, _aware(computed_at), GameStateOut.model_validate_json(payload)))
        except (ValidationError, ValueError):
            log.warning("stored game-state frame %s is unreadable; skipped", key)
    out.sort(key=lambda item: item[0])
    return out


def stored_days(db: Session) -> list[date]:
    """The days that have a stored frame, oldest first (keys only: cheap)."""
    keys = db.scalars(select(ComputedSnapshot.key).where(ComputedSnapshot.key.like(f"{KEY_PREFIX}%"))).all()
    return sorted(d for k in keys if (d := day_of(k)) is not None)


def load_frame(db: Session, day: date) -> tuple[datetime, GameStateOut] | None:
    row = db.get(ComputedSnapshot, frame_key(day))
    if row is None:
        return None
    try:
        return _aware(row.computed_at), GameStateOut.model_validate_json(row.payload)
    except (ValidationError, ValueError):
        return None


def run_if_due(
    db: Session,
    *,
    hour_utc: int,
    keep_days: int,
    version: str,
    now: datetime | None = None,
) -> bool:
    """Store today's frame when due. Demo mode is never stored."""
    from app.services.game.state import get_game_state
    from app.services.settings.demo_mode import is_demo_mode

    now = _aware(now or datetime.now(timezone.utc))
    if not is_due(db, now=now, hour_utc=hour_utc):
        return False
    if is_demo_mode(db):
        return False
    state = get_game_state(db, version, now=now)
    stored = store_frame(db, state, day=now.astimezone(timezone.utc).date(), now=now)
    if stored:
        removed = prune(db, today=now.astimezone(timezone.utc).date(), keep_days=keep_days)
        log.info("game-state frame stored for %s (pruned %d)", now.date(), removed)
    return stored
