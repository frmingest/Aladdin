"""Retry + RPM pacing for Google AI Studio (Gemini) calls.

Both Gemini-calling providers this app has (analysis, via
GoogleAIStudioProvider; macro/sector/company research, via
GeminiResearchProvider) share one API key/account, so they share one
`RateLimiter` instance here rather than each pacing independently against
its own clock — see claude/gemini-retry-and-rpm-pacing-2026-09-15.md for the
incident this fixes (a live analysis run 503'd 6/6 holdings with zero retry
or pacing).

`budget_guard` (2026-09-22 addition — see
claude/macro-page-slowness-2026-09-22.md): both providers also share one
account-wide DAILY request cap (settings.llm_rate_limit_rpd, 20/day
observed on the free tier — app/providers/budget.py's DailyBudgetGuard),
which is much tighter than the RPM pacing above and was previously never
consulted anywhere. Once that tiny shared budget was spent (easy to do —
macro + every sector + every company research + every analysis run all
draw from it), every subsequent call still paid the full RPM pacing wait,
made the real (doomed) network call, and ran the full retry/backoff
ladder before finally surfacing a 429 — tens of seconds of hanging on
pages like Macro for a failure that was actually knowable in advance. When
a `budget_guard` is passed and already exhausted, this now fails
immediately instead — no wait, no network call, no retries.
"""
from __future__ import annotations

import random
import time
from collections.abc import Callable
from typing import TYPE_CHECKING, TypeVar

from google.genai import errors as genai_errors

from app.providers.rate_limit import RateLimiter

if TYPE_CHECKING:
    from app.providers.budget import DailyBudgetGuard

T = TypeVar("T")

_MAX_RETRIES = 3
_BASE_DELAY_SECONDS = 1.0
_RETRYABLE_CODES = {429, 503}

_limiter = RateLimiter()


class DailyBudgetExceededError(Exception):
    """Raised by call_with_retry (never by the vendor SDK) when a
    DailyBudgetGuard reports today's quota is already spent. Callers
    (GoogleAIStudioProvider, GeminiResearchProvider) catch this and
    translate it to their own *UnavailableError with a message that names
    the real cause, rather than letting it look like a generic failure."""


def pace_call(rpm: int, *, _sleep: Callable[[float], None] = time.sleep) -> None:
    _limiter.wait(rpm, _sleep=_sleep)


def _is_retryable(exc: BaseException) -> bool:
    return isinstance(exc, genai_errors.APIError) and exc.code in _RETRYABLE_CODES


def call_with_retry(
    fn: Callable[[], T],
    *,
    rpm: int = 0,
    budget_guard: DailyBudgetGuard | None = None,
    _sleep: Callable[[float], None] = time.sleep,
    _random: Callable[[], float] = random.random,
) -> T:
    """Call `fn()`, retrying only on a transient Gemini error (429/503).

    Exponential backoff with jitter, up to `_MAX_RETRIES` retries (4 attempts
    total). Any other error — 400/404 (e.g. a retired model), an auth
    failure, a plain bug — fails on the first attempt; retrying a permanent
    error only delays surfacing it. Pacing runs before every attempt,
    including retries.

    When `budget_guard` is given: checked once, before anything else — no
    pacing wait, no network call, no retries — and raises
    DailyBudgetExceededError immediately if today's quota is already
    spent (see this module's docstring). Otherwise, every real attempt
    made (success or failure alike — a failed call still spent real quota)
    is recorded against it, same as DailyBudgetGuard.record_usage's own
    docstring asks callers to do.
    """
    if budget_guard is not None and budget_guard.would_exceed():
        raise DailyBudgetExceededError(
            "daily request budget already spent for today — no calls remaining"
        )

    last_exc: BaseException | None = None
    for attempt in range(_MAX_RETRIES + 1):
        pace_call(rpm, _sleep=_sleep)
        try:
            result = fn()
        except BaseException as exc:
            if budget_guard is not None:
                budget_guard.record_usage(1)
            if not _is_retryable(exc):
                raise
            last_exc = exc
            if attempt < _MAX_RETRIES:
                delay = _BASE_DELAY_SECONDS * (2**attempt) + _random()
                _sleep(delay)
            continue
        if budget_guard is not None:
            budget_guard.record_usage(1)
        return result
    assert last_exc is not None  # pragma: no cover - loop always returns or raises above
    raise last_exc
