"""In-process refresh loop for the numeric macro data (2026-09-24).

Runs inside the API server (Railway), which is always on and can reach
Norges Bank / FRED / SSB. A daemon thread wakes every
MACRO_REFRESH_INTERVAL_HOURS (0 = off) and refreshes the series whose last
successful fetch is older than MACRO_STALE_AFTER_HOURS, so a restart or a
second process doesn't hammer the publishers. The first pass waits a
minute after start-up so the server is serving requests first.

Kept deliberately small: no job framework, no extra dependency. The
analysis pipeline also refreshes stale series itself before a run, so a
missed loop costs freshness, never correctness.
"""
from __future__ import annotations

import logging
import threading

from app.config.settings import Settings

logger = logging.getLogger(__name__)

_FIRST_RUN_DELAY_SECONDS = 60


class MacroRefreshScheduler:
    def __init__(self, settings: Settings) -> None:
        self._settings = settings
        self._stop = threading.Event()
        self._thread: threading.Thread | None = None

    @property
    def enabled(self) -> bool:
        return (
            self._settings.macro_refresh_interval_hours > 0
            and self._settings.macro_data_provider == "live"
            and bool(self._settings.database_url)
        )

    def start(self) -> None:
        if not self.enabled or self._thread is not None:
            return
        self._thread = threading.Thread(target=self._loop, name="macro-refresh", daemon=True)
        self._thread.start()

    def stop(self) -> None:
        self._stop.set()

    def _loop(self) -> None:
        delay = _FIRST_RUN_DELAY_SECONDS
        interval = self._settings.macro_refresh_interval_hours * 3600
        while not self._stop.wait(delay):
            self.run_once()
            delay = interval

    def run_once(self) -> None:
        # Imported here so importing app.main never opens a DB connection.
        from app.config.database import SessionLocal
        from app.providers.factory import get_macro_data_provider_or_none
        from app.services.macro.refresh import refresh_macro_data

        provider = get_macro_data_provider_or_none()
        if provider is None or SessionLocal is None:
            return
        try:
            with SessionLocal() as db:
                results = refresh_macro_data(db, provider, only_stale=True)
            failed = [r.key for r in results if r.status == "failed"]
            logger.info(
                "macro refresh: %d updated, %d unchanged, %d fresh, failed: %s",
                sum(r.status == "updated" for r in results),
                sum(r.status == "unchanged" for r in results),
                sum(r.status == "fresh" for r in results),
                ", ".join(failed) or "none",
            )
        except Exception:
            logger.exception("macro refresh loop failed")
