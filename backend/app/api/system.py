"""System status (feature F4) — see app/services/system_status.py.

Configuration and database only: no provider is called from here, so
opening the status page never spends LLM quota. Secrets are reported as
"set"/"missing", never returned.

Demo mode (2026-09-26): the whole payload is replaced with a fabricated
one (app/services/settings/synthetic_data.py) — real config/version/
counts details aren't "portfolio data" but are still real facts about
this deployment, and the point of demo mode is that NOTHING real is
readable while it's on, so this errs on the side of hiding them too.
`demo_mode` is always set from the real flag either way, so the page can
show the banner correctly even when everything else is real.
"""
from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.config.database import get_db
from app.config.settings import get_settings
from app.models.llm_prompt_log import LlmPromptLog
from app.providers.factory import get_primary_budget_guard
from app.schemas.system import (
    PromptLogDetailOut,
    PromptLogItemOut,
    PromptLogListOut,
    SystemStatusOut,
)
from app.services.llm_prompt_log import get_prompt_log, list_prompt_logs
from app.services.settings.demo_mode import is_demo_mode
from app.services.settings.synthetic_data import demo_system_status
from app.services.system_status import build_system_status

router = APIRouter(prefix="/system", tags=["system"])


@router.get("/status", response_model=SystemStatusOut)
def get_system_status(db: Session = Depends(get_db)) -> SystemStatusOut:
    if is_demo_mode(db):
        return demo_system_status()
    status = build_system_status(db, get_settings(), get_primary_budget_guard())
    out = SystemStatusOut.model_validate(status, from_attributes=True)
    out.demo_mode = False
    return out


def _preview(row: LlmPromptLog) -> str:
    text = " ".join((row.user_prompt or "").split())
    return text[:160] + ("…" if len(text) > 160 else "")


def _item(row: LlmPromptLog) -> dict:
    return {
        "id": str(row.id), "occurred_at": row.occurred_at, "provider": row.provider,
        "model_name": row.model_name, "call_type": row.call_type, "schema_name": row.schema_name,
        "outcome": row.outcome, "error_detail": row.error_detail,
        "input_tokens": row.input_tokens, "output_tokens": row.output_tokens,
        "latency_ms": row.latency_ms, "prompt_chars": row.prompt_chars, "preview": _preview(row),
    }


@router.get("/prompt-log", response_model=PromptLogListOut)
def get_prompt_log_list(
    provider: str | None = None,
    outcome: str | None = None,
    call_type: str | None = None,
    search: str | None = Query(None, max_length=200),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
) -> PromptLogListOut:
    """The prompts sent to Gemini / the local model, newest first. Database
    only — never calls a provider. Demo mode returns nothing: the rows hold
    real portfolio evidence."""
    settings = get_settings()
    base = {"retention_days": settings.llm_prompt_log_retention_days,
            "enabled": settings.llm_prompt_log_enabled}
    if is_demo_mode(db):
        return PromptLogListOut(total=0, items=[], providers=[], demo_mode=True, **base)
    page = list_prompt_logs(
        db, provider=provider, outcome=outcome, call_type=call_type,
        search=search, limit=limit, offset=offset,
    )
    return PromptLogListOut(
        total=page["total"], items=[PromptLogItemOut(**_item(r)) for r in page["items"]],
        providers=page["providers"], **base,
    )


@router.get("/prompt-log/{log_id}", response_model=PromptLogDetailOut)
def get_prompt_log_detail(log_id: UUID, db: Session = Depends(get_db)) -> PromptLogDetailOut:
    if is_demo_mode(db):
        raise HTTPException(status_code=404, detail="Prompt log is hidden in demo mode.")
    row = get_prompt_log(db, log_id)
    if row is None:
        raise HTTPException(status_code=404, detail="No such prompt log entry (it may have been purged).")
    return PromptLogDetailOut(
        **_item(row), system_prompt=row.system_prompt, user_prompt=row.user_prompt,
        response_text=row.response_text,
    )
