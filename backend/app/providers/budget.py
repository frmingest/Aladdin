"""In-process daily request-budget guard for free-tier LLM rate limits.

Google AI Studio's gemini-3.6-flash free tier's real binding constraint
isn't the per-minute RPM gemini_retry.py already paces against — it's a
much tighter requests/day cap (`llm_rate_limit_rpd`, 20/day as observed)
that perfect pacing still runs into on any batch of more than ~10-20 calls.
See claude/gemini-daily-budget-guard-2026-09-16.md for the incident this
guard is modeled on. A caller checks "would this call fit in today's
budget" before spending a network round-trip finding out the hard way.

This class is the in-process guard: a count for one process on one UTC day.
Since 2026-09-28 the app itself uses its ledger-backed subclass
(app/providers/ledger_budget.py::LedgerBudgetGuard), which reads today's
count from the `llm_usage_events` table so it survives restarts and is shared
between the web server and the PC worker. This base class remains as that
subclass's fallback when the database can't be reached, and as the simple
guard the unit tests use.
"""
from __future__ import annotations

import threading
from datetime import datetime, timezone


class DailyBudgetGuard:
    """Tracks how many requests a provider has made today, in this process."""

    def __init__(self, *, daily_limit: int) -> None:
        self._daily_limit = daily_limit
        self._lock = threading.Lock()
        self._count = 0
        self._day: str | None = None

    @staticmethod
    def _today() -> str:
        return datetime.now(timezone.utc).strftime("%Y-%m-%d")

    def _roll_if_new_day(self) -> None:
        today = self._today()
        if self._day != today:
            self._day = today
            self._count = 0

    def remaining_today(self) -> int:
        with self._lock:
            self._roll_if_new_day()
            return max(self._daily_limit - self._count, 0)

    def would_exceed(self, cost: int = 1) -> bool:
        """Whether spending `cost` more requests today would exceed the cap."""
        return self.remaining_today() < cost

    def record_usage(
        self,
        cost: int = 1,
        *,
        call_type: str = "unknown",
        model_name: str | None = None,
        outcome: str = "success",
        latency_ms: float | None = None,
        input_tokens: int | None = None,
        output_tokens: int | None = None,
        error_detail: str | None = None,
    ) -> None:
        """Record that `cost` real requests were just spent.

        The keyword-only arguments describe the call for the persistent
        ledger (app/providers/ledger_budget.py); this in-process guard keeps
        only the count and ignores them. A `blocked_by_budget` outcome means
        the request was refused before sending, so nothing is spent.

        Call this for a failed call too, not only a successful one — a
        failed call still cost real quota (see the 2026-09-16 doc's
        "conservative debiting on a failed call").
        """
        if outcome == "blocked_by_budget":
            return
        with self._lock:
            self._roll_if_new_day()
            self._count += cost
