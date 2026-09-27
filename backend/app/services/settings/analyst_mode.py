"""Whole-app analyst mode (Epic F22, story 22.1) and the synthesis on/off
switch (story 22.8), stored in the generic `app_settings` table like
demo mode (app/services/settings/demo_mode.py) — no migration.

Absence of a key means the documented default: Buffett/Munger mode and
synthesis off. Any read error or unexpected stored value also falls back
to Buffett/Munger: that is exactly how the app behaved before F22, so a
bad row can never switch the app into a mode nobody chose.
"""
from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy.orm import Session

from app.domain.analyst_modes import DEFAULT_MODE, is_mode
from app.models.app_setting import AppSetting

ANALYST_MODE_KEY = "analyst_mode"
SYNTHESIS_ENABLED_KEY = "analyst_synthesis_enabled"


def _read(db: Session, key: str) -> str | None:
    try:
        setting = db.get(AppSetting, key)
    except Exception:  # noqa: BLE001 - fall back to the default, see docstring
        return None
    return setting.value if setting is not None else None


def _write(db: Session, key: str, value: str) -> None:
    setting = db.get(AppSetting, key)
    if setting is None:
        db.add(AppSetting(key=key, value=value))
    else:
        setting.value = value
        setting.updated_at = datetime.now(timezone.utc)
    db.commit()


def get_analyst_mode(db: Session) -> str:
    value = _read(db, ANALYST_MODE_KEY)
    return value if value is not None and is_mode(value) else DEFAULT_MODE


def set_analyst_mode(db: Session, mode: str) -> str:
    if not is_mode(mode):
        raise ValueError(f"unknown analyst mode: {mode!r}")
    _write(db, ANALYST_MODE_KEY, mode)
    return get_analyst_mode(db)


def is_synthesis_enabled(db: Session) -> bool:
    return _read(db, SYNTHESIS_ENABLED_KEY) == "true"


def set_synthesis_enabled(db: Session, enabled: bool) -> bool:
    _write(db, SYNTHESIS_ENABLED_KEY, "true" if enabled else "false")
    return is_synthesis_enabled(db)
