"""LLM prompt log — record the exact prompts sent to a model, and read them back.

Backs System status > "Prompt log". Like the usage ledger (llm_ledger.py) every
write fails soft and uses its own short-lived session: logging is
observability, and must never fail or roll back the LLM call it describes.

The rows contain real evidence packets, so old ones are purged (see
`Settings.llm_prompt_log_retention_days`). The purge runs opportunistically
from `record_prompt` at most once an hour per process — no scheduler needed.
"""
from __future__ import annotations

import logging
import time
from datetime import datetime, timedelta, timezone
from typing import Any
from uuid import UUID

from sqlalchemy import delete, func, select
from sqlalchemy.orm import Session

from app.config.settings import get_settings
from app.models.llm_prompt_log import LlmPromptLog
from app.services.llm_ledger import SessionFactory

log = logging.getLogger(__name__)

_PURGE_EVERY_SECONDS = 3600.0
# -inf, not 0.0: time.monotonic() counts from boot, so on a host up for under an hour 0.0 would
# read as "purged moments ago" and skip the first purge.
_last_purge_at = float("-inf")


def record_prompt(
    session_factory: SessionFactory | None,
    *,
    provider: str,
    model_name: str,
    call_type: str,
    user_prompt: str,
    system_prompt: str | None = None,
    schema_name: str | None = None,
    response_text: str | None = None,
    outcome: str = "success",
    error_detail: str | None = None,
    input_tokens: int | None = None,
    output_tokens: int | None = None,
    latency_ms: float | None = None,
    now: datetime | None = None,
) -> bool:
    """Append one prompt-log row. Returns whether it was actually written."""
    if session_factory is None:
        return False
    try:
        settings = get_settings()
        if not settings.llm_prompt_log_enabled:
            return False
        with session_factory() as db:
            db.add(
                LlmPromptLog(
                    occurred_at=now or datetime.now(timezone.utc),
                    provider=provider,
                    model_name=(model_name or "unknown")[:64],
                    call_type=(call_type or "unknown")[:32],
                    schema_name=schema_name[:96] if schema_name else None,
                    system_prompt=system_prompt,
                    user_prompt=user_prompt,
                    response_text=response_text,
                    outcome=outcome,
                    error_detail=error_detail[:480] if error_detail else None,
                    input_tokens=input_tokens,
                    output_tokens=output_tokens,
                    latency_ms=latency_ms,
                    prompt_chars=len(user_prompt) + len(system_prompt or ""),
                )
            )
            db.commit()
        _maybe_purge(session_factory, settings.llm_prompt_log_retention_days)
        return True
    except Exception:
        log.warning("could not write LLM prompt log row", exc_info=True)
        return False


def _maybe_purge(session_factory: SessionFactory, retention_days: int) -> None:
    global _last_purge_at
    if retention_days <= 0 or time.monotonic() - _last_purge_at < _PURGE_EVERY_SECONDS:
        return
    _last_purge_at = time.monotonic()
    try:
        with session_factory() as db:
            purge_older_than(db, retention_days)
    except Exception:
        log.warning("could not purge old LLM prompt log rows", exc_info=True)


def purge_older_than(db: Session, days: int, *, now: datetime | None = None) -> int:
    """Delete rows older than `days` days; returns how many were removed."""
    cutoff = (now or datetime.now(timezone.utc)) - timedelta(days=days)
    result = db.execute(delete(LlmPromptLog).where(LlmPromptLog.occurred_at < cutoff))
    db.commit()
    return int(result.rowcount or 0)


def list_prompt_logs(
    db: Session,
    *,
    provider: str | None = None,
    outcome: str | None = None,
    call_type: str | None = None,
    search: str | None = None,
    limit: int = 50,
    offset: int = 0,
) -> dict[str, Any]:
    """Newest-first page of log rows (no prompt bodies — see `get_prompt_log`)."""
    limit = max(1, min(limit, 200))
    offset = max(0, offset)
    conds = []
    if provider:
        conds.append(LlmPromptLog.provider == provider)
    if outcome:
        conds.append(LlmPromptLog.outcome == outcome)
    if call_type:
        conds.append(LlmPromptLog.call_type == call_type)
    if search:
        like = f"%{search}%"
        conds.append(LlmPromptLog.user_prompt.ilike(like) | LlmPromptLog.system_prompt.ilike(like))
    total = int(db.scalar(select(func.count(LlmPromptLog.id)).where(*conds)) or 0)
    rows = db.scalars(
        select(LlmPromptLog).where(*conds)
        .order_by(LlmPromptLog.occurred_at.desc()).limit(limit).offset(offset)
    ).all()
    providers = [p for (p,) in db.execute(select(LlmPromptLog.provider).distinct()).all()]
    return {"total": total, "items": list(rows), "providers": sorted(providers)}


def get_prompt_log(db: Session, log_id: UUID) -> LlmPromptLog | None:
    return db.get(LlmPromptLog, log_id)
