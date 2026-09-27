"""Minimal API-key gate for the deployed backend.

2026-09-27 (claude/agentic-coding-audit-2026-09-27.md findings #1/#2):
every endpoint was open to the internet with no authentication at all, and
a `VITE_API_KEY`/`APP_AUTH_TOKEN` scheme was documented in
`frontend/.env.example` but never actually implemented on either side.
This is that implementation.

This is *not* real access control. The key ships in the frontend's built
JS bundle, so anyone who opens dev tools can read it. It's a minimal gate
against stray/automated requests hitting a public backend URL that
handles real financial data -- bots, scanners, crawlers -- not a defense
against a targeted attacker. See `Settings.app_auth_token`'s docstring.

The gate reads the token fresh via `get_settings()` on every request
(rather than capturing it once at app-construction time) specifically so
tests can flip it with `get_settings.cache_clear()` plus `monkeypatch`,
and so a Railway env-var change takes effect on the next request without
a restart being the only way to pick it up (`get_settings` is
`lru_cache`d, so in practice this is still one read per process unless
something clears the cache -- but nothing about the gate itself requires
the token to be fixed at import time).
"""
from __future__ import annotations

from collections.abc import Awaitable, Callable

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import JSONResponse, Response
from starlette.types import ASGIApp

from app.config.settings import Settings

API_KEY_HEADER = "x-api-key"

# Reachable with no key even when APP_AUTH_TOKEN is set: Railway's own
# healthcheck and the smoke test's uptime probe (frontend/e2e/smoke.spec.ts)
# hit this with no custom headers, and it leaks nothing sensitive.
_EXEMPT_PATHS = frozenset({"/health"})


class ApiKeyMiddleware(BaseHTTPMiddleware):
    """Requires `X-API-Key: <APP_AUTH_TOKEN>` on every request once
    `APP_AUTH_TOKEN` is set. No-ops entirely (identical to pre-2026-09-27
    behavior) while it's unset, which is the default for local dev and CI.
    """

    def __init__(self, app: ASGIApp, get_settings: Callable[[], Settings]) -> None:
        super().__init__(app)
        self._get_settings = get_settings

    async def dispatch(
        self, request: Request, call_next: Callable[[Request], Awaitable[Response]]
    ) -> Response:
        token = self._get_settings().app_auth_token
        if not token or request.method == "OPTIONS" or request.url.path in _EXEMPT_PATHS:
            return await call_next(request)
        if request.headers.get(API_KEY_HEADER) != token:
            return JSONResponse(status_code=401, content={"detail": "Missing or invalid API key"})
        return await call_next(request)
