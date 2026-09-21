"""In-process daily request-budget guard for free-tier LLM rate limits.

Google AI Studio's gemini-3.6-flash free tier's real binding constraint
isn't the per-minute RPM gemini_retry.py already paces against — it's a
much tighter requests/day cap (`llm_rate_limit_rpd`, 20/day as observed)
that perfect pacing still runs into on any batch of more than ~10-20 calls.
See claude/gemini-daily-budget-guard-2026-09-16.md for the incident this
guard is modeled on. A caller checks "would this call fit in today's
budget" before spending a network round-trip finding out the hard way.

Deliberately in-memory, not backed by a database table yet — Sprint 1
hasn't built any models at the point this is written. Once an
`llm_usage_events` ledger exists (see
claude/llm-usage-ledger-and-rate-limit-estimation.md for the pre-reset
design this should eventually match), replace this with a ledger-backed
guard so the count survives a process restart and reflects real history
instead of only what this process has seen today. Until then this protects
a single running process for a single day — enough to stop a batch job from
burning every remaining retry into a guaranteed 429, not a source of truth
across restarts or deployments.
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

    def record_usage(self, cost: int = 1) -> None:
        """Record that `cost` real requests were just spent.

        Call this for a failed call too, not only a successful one — a
        failed call still cost real quota (see the 2026-09-16 doc's
        "conservative debiting on a failed call").
        """
        with self._lock:
            self._roll_if_new_day()
            self._count += cost
