"""Retry + RPM pacing for Mistral calls — twin of gemini_retry.py.

Kept as its own module rather than generalized into gemini_retry.py: the
two vendors' SDKs raise incompatible exception hierarchies (Gemini's
APIError.code vs. Mistral's SDKError.status_code) and have separate
accounts/quotas, so each needs its own retryable-error check and its own
`RateLimiter` instance (shared pacing logic lives in
app.providers.rate_limit).
"""
from __future__ import annotations

import random
import time
from collections.abc import Callable
from typing import TypeVar

from mistralai.models.sdkerror import SDKError

from app.providers.rate_limit import RateLimiter

T = TypeVar("T")

_MAX_RETRIES = 3
_BASE_DELAY_SECONDS = 1.0
# Matches the retryable set claude/mistral-fallback-provider-2026-09-17.md's
# unit tests verified against the real SDK: transient server-side errors,
# plus 429 for rate limiting.
_RETRYABLE_STATUS_CODES = {429, 500, 502, 503, 504}

_limiter = RateLimiter()


def pace_call(rpm: int, *, _sleep: Callable[[float], None] = time.sleep) -> None:
    _limiter.wait(rpm, _sleep=_sleep)


def _is_retryable(exc: BaseException) -> bool:
    return isinstance(exc, SDKError) and exc.status_code in _RETRYABLE_STATUS_CODES


def call_with_retry(
    fn: Callable[[], T],
    *,
    rpm: int = 0,
    _sleep: Callable[[float], None] = time.sleep,
    _random: Callable[[], float] = random.random,
) -> T:
    """Call `fn()`, retrying only on a transient Mistral error.

    Same shape as gemini_retry.call_with_retry: exponential backoff with
    jitter, up to `_MAX_RETRIES` retries (4 attempts total), pacing before
    every attempt. A non-retryable error (e.g. 400 malformed request, 401
    auth failure) fails immediately.
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
    assert last_exc is not None  # pragma: no cover
    raise last_exc
