"""LLM usage ledger — write one row per real provider request, and read it back.

Backs the persistent daily-budget guard (app/providers/ledger_budget.py) and
GET /usage/summary. Writes and the budget count use their own short-lived
sessions from a session factory, never the request's session: a provider call
can happen deep inside a request or the PC worker, and a ledger write must
neither ride on nor roll back with the caller's transaction.

Every function here fails soft. The ledger is observability plus a spend
guard; if the database hiccups the LLM call itself must still work, and the
in-process fallback in the guard keeps a floor under the count.
"""
from __future__ import annotations

import logging
from collections.abc import Callable
from datetime import datetime, timedelta, timezone
from typing import Any

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models.llm_usage import (
    COUNTED_OUTCOMES,
    OUTCOME_BLOCKED,
    OUTCOME_ERROR,
    OUTCOME_SUCCESS,
    LlmUsageEvent,
)

log = logging.getLogger(__name__)

SessionFactory = Callable[[], Session]


def utc_day_start(now: datetime | None = None) -> datetime:
    now = now or datetime.now(timezone.utc)
    return now.astimezone(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)


def record_event(
    session_factory: SessionFactory | None,
    *,
    provider: str,
    model_name: str,
    call_type: str,
    outcome: str = OUTCOME_SUCCESS,
    latency_ms: float | None = None,
    input_tokens: int | None = None,
    output_tokens: int | None = None,
    error_detail: str | None = None,
    now: datetime | None = None,
) -> bool:
    """Append one ledger row. Returns whether it was actually written."""
    if session_factory is None:
        return False
    try:
        with session_factory() as db:
            db.add(
                LlmUsageEvent(
                    occurred_at=now or datetime.now(timezone.utc),
                    provider=provider,
                    model_name=(model_name or "unknown")[:64],
                    call_type=(call_type or "unknown")[:32],
                    outcome=outcome,
                    latency_ms=latency_ms,
                    input_tokens=input_tokens,
                    output_tokens=output_tokens,
                    error_detail=error_detail[:240] if error_detail else None,
                )
            )
            db.commit()
        return True
    except Exception:
        log.warning("could not write LLM usage ledger row", exc_info=True)
        return False


def count_calls_today(
    session_factory: SessionFactory | None, provider: str, *, now: datetime | None = None
) -> int | None:
    """Real requests `provider` has spent since 00:00 UTC, or None if the
    ledger can't be read (caller falls back to its in-process count)."""
    if session_factory is None:
        return None
    try:
        with session_factory() as db:
            return int(
                db.scalar(
                    select(func.count(LlmUsageEvent.id)).where(
                        LlmUsageEvent.provider == provider,
                        LlmUsageEvent.outcome.in_(COUNTED_OUTCOMES),
                        LlmUsageEvent.occurred_at >= utc_day_start(now),
                    )
                )
                or 0
            )
    except Exception:
        log.warning("could not read LLM usage ledger", exc_info=True)
        return None


def _aware(value: datetime) -> datetime:
    return value if value.tzinfo else value.replace(tzinfo=timezone.utc)


def build_usage_summary(
    db: Session, *, days: int = 7, daily_limits: dict[str, int] | None = None, now: datetime | None = None
) -> dict[str, Any]:
    """Per-day, per-provider rollup of the ledger for the last `days` UTC days
    (today included), plus a by-call-type breakdown and the latest errors.

    `daily_limits` maps provider -> requests/day cap (only Gemini has one), so
    each of today's rows can show what's left.
    """
    now = now or datetime.now(timezone.utc)
    days = max(1, min(days, 90))
    since = utc_day_start(now) - timedelta(days=days - 1)
    rows = db.scalars(
        select(LlmUsageEvent).where(LlmUsageEvent.occurred_at >= since).order_by(LlmUsageEvent.occurred_at)
    ).all()

    per_day: dict[tuple[str, str, str], dict[str, Any]] = {}
    by_call_type: dict[tuple[str, str], int] = {}
    errors: list[LlmUsageEvent] = []
    for row in rows:
        at = _aware(row.occurred_at)
        day = at.strftime("%Y-%m-%d")
        key = (day, row.provider, row.model_name)
        bucket = per_day.setdefault(
            key,
            {"date": day, "provider": row.provider, "model_name": row.model_name,
             "requests": 0, "failed": 0, "blocked": 0, "input_tokens": 0, "output_tokens": 0},
        )
        if row.outcome == OUTCOME_BLOCKED:
            bucket["blocked"] += 1
            continue
        bucket["requests"] += 1
        bucket["input_tokens"] += row.input_tokens or 0
        bucket["output_tokens"] += row.output_tokens or 0
        ct_key = (row.provider, row.call_type)
        by_call_type[ct_key] = by_call_type.get(ct_key, 0) + 1
        if row.outcome == OUTCOME_ERROR:
            bucket["failed"] += 1
            errors.append(row)

    limits = daily_limits or {}
    today = utc_day_start(now).strftime("%Y-%m-%d")
    daily = sorted(per_day.values(), key=lambda b: (b["date"], b["provider"]), reverse=True)
    for bucket in daily:
        limit = limits.get(bucket["provider"])
        bucket["daily_limit"] = limit
        bucket["remaining"] = max(limit - bucket["requests"], 0) if limit and bucket["date"] == today else None

    return {
        "generated_at": now,
        "days": days,
        "daily": daily,
        "by_call_type": [
            {"provider": p, "call_type": c, "requests": n}
            for (p, c), n in sorted(by_call_type.items(), key=lambda kv: -kv[1])
        ],
        "recent_errors": [
            {
                "occurred_at": _aware(e.occurred_at),
                "provider": e.provider,
                "call_type": e.call_type,
                "detail": e.error_detail or "",
            }
            for e in sorted(errors, key=lambda e: _aware(e.occurred_at), reverse=True)[:10]
        ],
    }
