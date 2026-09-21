"""Retry + RPM pacing for Google AI Studio (Gemini) calls.

Both Gemini-calling providers this app has (today: analysis; later: macro/
sector research) share one API key/account, so they share one
`RateLimiter` instance here rather than each pacing independently against
its own clock — see claude/gemini-retry-and-rpm-pacing-2026-09-15.md for the
incident this fixes (a live analysis run 503'd 6/6 holdings with zero retry
or pacing).
"""
from __future__ import annotations

import random
import time
from collections.abc import Callable
from typing import TypeVar

from google.genai import errors as genai_errors

from app.providers.rate_limit import RateLimiter

T = TypeVar("T")

_MAX_RETRIES = 3
_BASE_DELAY_SECONDS = 1.0
_RETRYABLE_CODES = {429, 503}

_limiter = RateLimiter()


def pace_call(rpm: int, *, _sleep: Callable[[float], None] = time.sleep) -> None:
    _limiter.wait(rpm, _sleep=_sleep)


def _is_retryable(exc: BaseException) -> bool:
    return isinstance(exc, genai_errors.APIError) and exc.code in _RETRYABLE_CODES


def call_with_retry(
    fn: Callable[[], T],
    *,
    rpm: int = 0,
    _sleep: Callable[[float], None] = time.sleep,
    _random: Callable[[], float] = random.random,
) -> T:
    """Call `fn()`, retrying only on a transient Gemini error (429/503).

    Exponential backoff with jitter, up to `_MAX_RETRIES` retries (4 attempts
    total). Any other error — 400/404 (e.g. a retired model), an auth
    failure, a plain bug — fails on the first attempt; retrying a permanent
    error only delays surfacing it. Pacing runs before every attempt,
    including retries.
    """
    last_exc: BaseException | None = None
    for attempt in range(_MAX_RETRIES + 1):
        pace_call(rpm, _sleep=_sleep)
        try:
            return fn()
        except BaseException as exc:
            if not _is_retryable(exc):
                raise
            last_exc = exc
            if attempt < _MAX_RETRIES:
                delay = _BASE_DELAY_SECONDS * (2**attempt) + _random()
                _sleep(delay)
    assert last_exc is not None  # pragma: no cover - loop always returns or raises above
    raise last_exc
