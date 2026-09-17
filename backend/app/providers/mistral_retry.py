"""Retry-with-backoff and RPM pacing for MistralProvider
(app.providers.mistral_provider) — 2026-09-17, added alongside the fallback
provider itself (§29, see claude/llm-provider-alternatives-2026-09-17.md).
Mistral is only ever called as a fallback when Gemini's free-tier daily
budget is exhausted (app.services.analysis.runner), so this exists mainly
so a transient 429/5xx from Mistral doesn't fail a holding outright — the
same problem app.providers.gemini_retry solved for Gemini on 2026-09-15.

Deliberately a separate, Mistral-specific module rather than generalizing
gemini_retry.py: the two vendors' SDKs raise incompatible exception
hierarchies (google.genai.errors.ServerError/ClientError, keyed off `.code`,
vs mistralai.client.errors.MistralError, keyed off `.status_code`), and
gemini_retry.py is already relied on and tested by two Gemini-calling
providers — not worth touching working, tested code just to add a second
vendor underneath it (§2.9: no premature abstraction). If a third vendor
shows up later, that's the point to actually factor out a shared module.

Same fixed-interval, process-wide pacing design as gemini_retry.py (see that
module's docstring for the full reasoning) — correct for this app's
single-user, one-call-at-a-time real usage pattern. MistralProvider is a
process-wide singleton via app.providers.factory's `@lru_cache`, same as
both Gemini-calling providers, so this module-level pacing state correctly
throttles every Mistral call made anywhere in this process.

`call_with_retry` paces then retries only on server-side/rate-limit errors
(429, 500, 502, 503, 504) — introspected against the real installed
mistralai==2.10.1 SDK: `MistralError.status_code` is a plain int attribute
on every HTTP error the SDK raises (mistralai.client.errors.sdkerror.SDKError
is the fallback subclass when no more specific error model matches, but the
base `.status_code` attribute this module checks is set for all of them).
Anything else (400 bad request, 401/403 auth, 404 unknown model) is a
permanent error — retrying one would only delay surfacing it (§21: fail
visibly, don't paper over).
"""

import random
import threading
import time
from collections.abc import Callable
from typing import TypeVar

from mistralai.client.errors import MistralError

_RETRYABLE_STATUS_CODES = {429, 500, 502, 503, 504}
_MAX_ATTEMPTS = 4  # 1 initial attempt + 3 retries
_BASE_DELAY_SECONDS = 3.0
_MAX_DELAY_SECONDS = 30.0
_JITTER_FRACTION = 0.25  # up to +25% extra delay, so concurrent retries don't all land on the same second

_pacing_lock = threading.Lock()
_last_call_at: float | None = None

T = TypeVar("T")


def pace_call(rpm: int) -> None:
    """Blocks until at least 60/rpm seconds have passed since the last
    Mistral call made anywhere in this process. `rpm <= 0` disables pacing
    entirely (the default for a directly-constructed provider, e.g. in
    tests) — app.providers.factory always passes the real configured
    `settings.mistral_rate_limit_rpm` for production wiring."""
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
    """Calls `fn()` — a zero-arg closure making exactly one Mistral API call
    — pacing it against `rpm` first, and retrying with exponential backoff
    plus jitter on a retryable HTTP status. Re-raises immediately on any
    other error, and re-raises the last retryable error once `_MAX_ATTEMPTS`
    is exhausted."""
    last_exc: BaseException | None = None
    for attempt in range(_MAX_ATTEMPTS):
        pace_call(rpm)
        try:
            return fn()
        except MistralError as exc:
            if exc.status_code not in _RETRYABLE_STATUS_CODES:
                raise
            last_exc = exc
            if attempt == _MAX_ATTEMPTS - 1:
                raise
            delay = min(_BASE_DELAY_SECONDS * (2**attempt), _MAX_DELAY_SECONDS)
            delay += random.uniform(0, delay * _JITTER_FRACTION)
            time.sleep(delay)
    raise last_exc  # pragma: no cover — unreachable, the loop above always returns or raises
