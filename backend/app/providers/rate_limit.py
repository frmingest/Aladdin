"""Process-wide fixed-interval call pacer, shared by every vendor's retry
module (app.providers.gemini_retry, app.providers.mistral_retry, ...).

Split out so each vendor's retry module only has to define what's actually
vendor-specific (its error types, which status codes are retryable) instead
of re-implementing the same pacing loop — see
claude/gemini-retry-and-rpm-pacing-2026-09-15.md for the incident (a live
analysis run 503'd 6/6 holdings) this pacing design fixes.
"""
from __future__ import annotations

import threading
import time
from collections.abc import Callable


class RateLimiter:
    """Blocks each call until at least 60/rpm seconds since the previous one.

    One instance per vendor — each has its own account and its own rate
    limit, so they pace independently of each other, never against a shared
    clock. `rpm <= 0` disables pacing (unit tests construct a provider
    directly and shouldn't have to wait).
    """

    def __init__(self) -> None:
        self._lock = threading.Lock()
        self._last_call_at: float | None = None

    def wait(self, rpm: int, *, _sleep: Callable[[float], None] = time.sleep) -> None:
        if rpm <= 0:
            return
        min_interval = 60.0 / rpm
        with self._lock:
            now = time.monotonic()
            if self._last_call_at is not None:
                remaining = min_interval - (now - self._last_call_at)
                if remaining > 0:
                    _sleep(remaining)
                    now = time.monotonic()
            self._last_call_at = now
