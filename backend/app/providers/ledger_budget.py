"""Daily request-budget guard backed by the LLM usage ledger.

Replaces the in-process-only count that reset on every restart and could not
see calls made by the other process (web server vs PC worker). The number of
real requests spent today is read from `llm_usage_events`; every attempt is
written back there. Both processes talk to the same database, so both see
one shared count that survives restarts and redeploys.

Failure mode is deliberate: if the ledger can't be read or written, the guard
falls back to the in-process count (what it did before) rather than blocking
LLM calls — a database blip must not take analysis down, it just degrades to
the old behaviour for that call.
"""
from __future__ import annotations

from datetime import datetime, timezone

from app.models.llm_usage import OUTCOME_BLOCKED, OUTCOME_ERROR, OUTCOME_SUCCESS
from app.providers.budget import DailyBudgetGuard
from app.services.llm_ledger import SessionFactory, count_calls_today, record_event


class LedgerBudgetGuard(DailyBudgetGuard):
    def __init__(
        self,
        *,
        daily_limit: int,
        provider: str,
        model_name: str,
        session_factory: SessionFactory | None,
    ) -> None:
        super().__init__(daily_limit=daily_limit)
        self._provider = provider
        self._model_name = model_name
        self._session_factory = session_factory

    def remaining_today(self) -> int:
        in_process = super().remaining_today()  # rolls the in-memory day
        spent = count_calls_today(self._session_factory, self._provider)
        if spent is None:
            return in_process  # ledger unreadable — old in-process behaviour
        # The ledger is the shared truth; in-process can only be *higher* if a
        # ledger write failed, in which case be conservative and honour it.
        return min(max(self._daily_limit - spent, 0), in_process)

    def record_usage(
        self,
        cost: int = 1,
        *,
        call_type: str = "unknown",
        model_name: str | None = None,
        outcome: str = OUTCOME_SUCCESS,
        latency_ms: float | None = None,
        input_tokens: int | None = None,
        output_tokens: int | None = None,
        error_detail: str | None = None,
    ) -> None:
        if outcome == OUTCOME_BLOCKED:
            record_event(
                self._session_factory, provider=self._provider,
                model_name=model_name or self._model_name, call_type=call_type,
                outcome=OUTCOME_BLOCKED, error_detail=error_detail,
                now=datetime.now(timezone.utc),
            )
            return
        super().record_usage(cost)
        # `cost` > 1 is only used by callers pre-debiting a multi-call unit of
        # work; each real request is its own row so the count stays exact.
        for _ in range(max(cost, 1)):
            record_event(
                self._session_factory, provider=self._provider,
                model_name=model_name or self._model_name, call_type=call_type,
                outcome=OUTCOME_ERROR if outcome == OUTCOME_ERROR else OUTCOME_SUCCESS,
                latency_ms=latency_ms, input_tokens=input_tokens,
                output_tokens=output_tokens, error_detail=error_detail,
            )
