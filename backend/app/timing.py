"""Per-request timing (2026-09-30, page-load work).

Adds `Server-Timing` (total time, time spent in the database, and how many
queries) plus `X-DB-Queries` to every response, so "why is this page slow"
can be answered from the browser's Network tab instead of guessed from the
code. Nothing sensitive is exposed: only durations and a count.

The counter is a ContextVar holding one mutable dict per request; a
SQLAlchemy engine event bumps it for every statement. Sync route handlers
run in a worker thread whose context is a copy, but the dict object is
shared, so the counts still land on the right request.
"""
from __future__ import annotations

import time
from contextvars import ContextVar

from sqlalchemy import event
from sqlalchemy.engine import Engine
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response

_stats: ContextVar[dict | None] = ContextVar("request_db_stats", default=None)


@event.listens_for(Engine, "before_cursor_execute")
def _before(conn, cursor, statement, parameters, context, executemany):
    context._aladdin_t0 = time.perf_counter()


@event.listens_for(Engine, "after_cursor_execute")
def _after(conn, cursor, statement, parameters, context, executemany):
    stats = _stats.get()
    if stats is None:
        return
    stats["queries"] += 1
    stats["db_seconds"] += time.perf_counter() - getattr(context, "_aladdin_t0", time.perf_counter())


class TimingMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next) -> Response:
        stats = {"queries": 0, "db_seconds": 0.0}
        token = _stats.set(stats)
        start = time.perf_counter()
        try:
            response = await call_next(request)
        finally:
            _stats.reset(token)
        total_ms = (time.perf_counter() - start) * 1000
        db_ms = stats["db_seconds"] * 1000
        response.headers["Server-Timing"] = (
            f'total;dur={total_ms:.0f}, db;dur={db_ms:.0f};desc="{stats["queries"]} queries"'
        )
        response.headers["X-DB-Queries"] = str(stats["queries"])
        # Lets the browser's Performance API read Server-Timing cross-origin.
        response.headers["Timing-Allow-Origin"] = "*"
        return response
