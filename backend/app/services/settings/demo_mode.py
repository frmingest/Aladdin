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

from datetime import datetime, timezone

from sqlalchemy.orm import Session

from app.models.app_setting import AppSetting

DEMO_MODE_KEY = "demo_mode"


def is_demo_mode(db: Session) -> bool:
    try:
        setting = db.get(AppSetting, DEMO_MODE_KEY)
    except Exception:  # noqa: BLE001 - any read error fails closed to False, see docstring
        # Fail closed to the SAFE state for this read: report OFF. See
        # this module's docstring for why that is the safe direction here.
        return False
    if setting is None:
        return False
    return setting.value == "true"


def set_demo_mode(db: Session, enabled: bool) -> None:
    setting = db.get(AppSetting, DEMO_MODE_KEY)
    value = "true" if enabled else "false"
    if setting is None:
        setting = AppSetting(key=DEMO_MODE_KEY, value=value)
        db.add(setting)
    else:
        setting.value = value
        setting.updated_at = datetime.now(timezone.utc)
    db.commit()
