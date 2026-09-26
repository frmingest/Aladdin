"""The write-side demo-mode guard (2026-09-26).

`require_not_demo` is called as the FIRST thing in every mutating
endpoint's body (POST/PUT/PATCH/DELETE) across the whole
`backend/app/api/` package - the one deliberate exception being the
demo-mode settings endpoint itself (app/api/settings.py), which must stay
reachable while demo mode is on so it can be turned back off.

Deliberately does NOT catch an error from `is_demo_mode` and treat it as
"assume not demo, allow the write": see demo_mode.py's docstring for why
that direction would be unsafe. If demo status can't be determined here,
this raises straight through as an unhandled 500, same as any other
endpoint whose `db` session is unusable - it does not silently let a
mutating request through.
"""
from __future__ import annotations

from sqlalchemy.orm import Session

from app.services.settings.demo_mode import is_demo_mode


class DemoModeWriteBlockedError(Exception):
    """Raised by `require_not_demo`; app/main.py turns this into a 403."""

    def __init__(self, message: str = "This action is disabled while demo mode is on.") -> None:
        super().__init__(message)


def require_not_demo(db: Session) -> None:
    if is_demo_mode(db):
        raise DemoModeWriteBlockedError()
