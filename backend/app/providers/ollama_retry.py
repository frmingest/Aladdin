"""Retry-with-backoff for OllamaProvider (app.providers.ollama_provider) —
2026-09-17, local-LLM migration (see docs/decisions/0017-local-llm-migration-
ollama.md and claude/local-llm-migration-plan-2026-09-17.md).

Deliberately NOT a copy of gemini_retry.py/mistral_retry.py's pacing design:
those exist to stay under a *vendor's* requests-per-minute quota, which has
no equivalent here — a local Ollama server has no rate limit, only a GPU
that can serve one request at a time. `run_analysis` already calls providers
strictly sequentially (one holding at a time, §2.9), so there is no
concurrent-call scenario to pace against; adding a pacer here would just add
artificial latency for no reason.

What a local server *does* fail on, transiently: the model still loading
into VRAM after a cold start or an idle unload (`keep_alive` expiring), or a
momentary drop on the LAN/Tailscale link between this backend and the
machine running Ollama (see the ADR's topology discussion — the backend may
not be on the same host as the GPU). Both clear on their own within a few
seconds to ~30s, so a short retry-with-backoff (no jitter needed — there's
only ever one caller) covers them; anything else (model not found, invalid
request) is permanent and retrying would only delay surfacing it (§21).
"""

import time
from collections.abc import Callable
from typing import TypeVar

import ollama

# ResponseError.status_code: -1 (no HTTP response at all — e.g. a JSON
# decode failure) or a genuine 5xx from the Ollama server itself (rare;
# Ollama returns 4xx for most client-caused failures, e.g. 404 = model not
# pulled, 400 = bad request/options). RequestError is httpx-level (the
# server is not reachable at all — starting up, mid-restart, or a network
# hiccup) and is always worth retrying.
_RETRYABLE_STATUS_CODES = {-1, 500, 502, 503, 504}
_MAX_ATTEMPTS = 4  # 1 initial attempt + 3 retries
_BASE_DELAY_SECONDS = 2.0
_MAX_DELAY_SECONDS = 20.0

T = TypeVar("T")


def call_with_retry(fn: Callable[[], T]) -> T:
    """Calls `fn()` — a zero-arg closure making exactly one Ollama `chat`
    call — retrying with backoff on a connection failure (`ollama.
    RequestError`) or a retryable `ollama.ResponseError` status. Re-raises
    immediately on any other error (model not found, invalid schema/options,
    ...), and re-raises the last retryable error once `_MAX_ATTEMPTS` is
    exhausted."""
    last_exc: BaseException | None = None
    for attempt in range(_MAX_ATTEMPTS):
        try:
            return fn()
        except ollama.RequestError as exc:
            last_exc = exc
        except ollama.ResponseError as exc:
            if exc.status_code not in _RETRYABLE_STATUS_CODES:
                raise
            last_exc = exc
        if attempt == _MAX_ATTEMPTS - 1:
            raise last_exc  # type: ignore[misc]  # set on every path that reaches here
        delay = min(_BASE_DELAY_SECONDS * (2**attempt), _MAX_DELAY_SECONDS)
        time.sleep(delay)
    raise last_exc  # type: ignore[misc]  # pragma: no cover — unreachable, loop always returns or raises
