"""Shared retry-with-backoff and RPM pacing for every direct google-genai
call in this codebase (app.providers.google_ai_studio_provider — analysis —
and app.providers.gemini_research_provider — macro/sector research). Both
providers share one Google AI Studio API key/account and therefore one
free-tier request budget, so the retry policy and pacing live here once
rather than being duplicated — or silently drifting — per provider. This is
still vendor-specific SDK plumbing (not application logic), so it stays
under app.providers rather than app.services (§28 rule 8).

Why this exists (Faiz's 2026-09-15 report): a batch analysis run failed
6/6 holdings, every one with Gemini's own "This model is currently
experiencing high demand ... usually temporary" 503. Neither provider had
any retry logic at all, so a single transient 503 permanently failed that
holding. Separately, `run_analysis` (app.services.analysis.runner) loops
through every requested holding with no pacing whatsoever, even though the
free tier is capped at `settings.llm_rate_limit_rpm` requests/minute (5, as
of 2026-09, see ADR 0013) — a run of more than 2-3 holdings (each costs 1-2
Gemini calls, blind pass + optional reconciliation pass) can burst well
past that cap within a single request.

Both providers are process-wide singletons (app.providers.factory's
`@lru_cache`), so the module-level pacing state below correctly throttles
every Gemini call made anywhere in this process — across an entire
analysis run's holding loop, and across concurrent analysis/research
activity — not just within one call site. This is a single fixed-interval
throttle (not a sliding-window limiter): correct and sufficient because a
single-user app's real call pattern is one call at a time, never genuine
concurrent bursts (§2.9 — no premature complexity beyond what's needed).

`call_with_retry` paces then retries only on the two vendor errors whose
own message says the condition is transient — 503 (Gemini overloaded) and
429 (rate/quota exceeded). Anything else (400 bad request, 404 model not
found, an auth failure, ...) is a permanent error, and retrying one would
only delay surfacing it (§21: fail visibly, don't paper over).
"""

import random
import threading
import time
from collections.abc import Callable
from typing import TypeVar

from google.genai import errors as genai_errors

_RETRYABLE_STATUS_CODES = {429, 503}
_MAX_ATTEMPTS = 4  # 1 initial attempt + 3 retries
_BASE_DELAY_SECONDS = 3.0
_MAX_DELAY_SECONDS = 30.0
_JITTER_FRACTION = 0.25  # up to +25% extra delay, so concurrent retries don't all land on the same second

_pacing_lock = threading.Lock()
_last_call_at: float | None = None

T = TypeVar("T")


def pace_call(rpm: int) -> None:
    """Blocks until at least 60/rpm seconds have passed since the last
    Gemini call made anywhere in this process. `rpm <= 0` disables pacing
    entirely (the default for a directly-constructed provider, e.g. in
    tests) — app.providers.factory always passes the real configured
    `settings.llm_rate_limit_rpm` for production wiring."""
    if rpm <= 0:
        return
    min_interval = 60.0 / rpm
    global _last_call_at
    with _pacing_lock:
        now = time.monotonic()
        if _last_call_at is not None:
            remaining = min_interval - (now - _last_call_at)
            if remaining > 0:
                time.sleep(remaining)
                now = time.monotonic()
        _last_call_at = now


def call_with_retry(fn: Callable[[], T], *, rpm: int) -> T:
    """Calls `fn()` — a zero-arg closure making exactly one Gemini API call
    — pacing it against `rpm` first, and retrying with exponential backoff
    plus jitter on a transient vendor error (ServerError/ClientError whose
    `.code` is 429 or 503). Re-raises immediately on any other error, and
    re-raises the last transient error once `_MAX_ATTEMPTS` is exhausted.
    """
    last_exc: BaseException | None = None
    for attempt in range(_MAX_ATTEMPTS):
        pace_call(rpm)
        try:
            return fn()
        except (genai_errors.ServerError, genai_errors.ClientError) as exc:
            if getattr(exc, "code", None) not in _RETRYABLE_STATUS_CODES:
                raise
            last_exc = exc
            if attempt == _MAX_ATTEMPTS - 1:
                raise
            delay = min(_BASE_DELAY_SECONDS * (2**attempt), _MAX_DELAY_SECONDS)
            delay += random.uniform(0, delay * _JITTER_FRACTION)
            time.sleep(delay)
    raise last_exc  # pragma: no cover — unreachable, the loop above always returns or raises
