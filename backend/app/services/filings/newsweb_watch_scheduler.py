"""In-process loop that runs the Newsweb watch on the Railway backend.

Same shape as the macro refresh scheduler (services/macro/scheduler.py): a
daemon thread, no job framework, no extra dependency. Running on Railway means
announcements are still collected while the PC is off. The first pass waits a
minute after start-up. Off when NEWSWEB_WATCH_INTERVAL_MINUTES=0, the
announcements provider is "none", demo mode is on, or there is no DATABASE_URL.
A missed loop costs freshness only.
"""
from __future__ import annotations

import logging
import threading

from app.config.settings import Settings

logger = logging.getLogger(__name__)

_FIRST_RUN_DELAY_SECONDS = 60


class NewswebWatchScheduler:
    def __init__(self, settings: Settings) -> None:
        self._settings = settings
        self._stop = threading.Event()
        self._thread: threading.Thread | None = None

    @property
    def enabled(self) -> bool:
        return (
            self._settings.newsweb_watch_interval_minutes > 0
            and self._settings.announcements_provider == "newsweb"
            and bool(self._settings.database_url)
        )

    def start(self) -> None:
        if not self.enabled or self._thread is not None:
            return
        self._thread = threading.Thread(target=self._loop, name="newsweb-watch", daemon=True)
        self._thread.start()

    def stop(self) -> None:
        self._stop.set()

    def _loop(self) -> None:
        delay = _FIRST_RUN_DELAY_SECONDS
        interval = self._settings.newsweb_watch_interval_minutes * 60
        while not self._stop.wait(delay):
            self.run_once()
            delay = interval

    def run_once(self) -> None:
        # Imported here so importing app.main never opens a DB connection.
        from app.config.database import SessionLocal
        from app.providers.newsweb_provider import NewswebAnnouncementsProvider
        from app.services.filings.newsweb_watch import run_watch
        from app.services.settings.demo_mode import is_demo_mode

        if SessionLocal is None:
            return
        provider = NewswebAnnouncementsProvider(
            lookback_days=self._settings.newsweb_watch_lookback_days,
            timeout_seconds=self._settings.newsweb_watch_timeout_seconds,
        )
        try:
            with SessionLocal() as db:
                if is_demo_mode(db):
                    return
                result = run_watch(db, provider, pause_seconds=self._settings.newsweb_watch_pause_seconds)
            logger.info("newsweb watch: %s", result.summary())
        except Exception:
            logger.exception("newsweb watch loop failed")
