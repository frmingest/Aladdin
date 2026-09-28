"""LLM usage ledger summary — see app/services/llm_ledger.py.

Read-only, database only: no provider is called, so opening it never spends
quota. Demo mode returns an empty rollup — real spend history isn't
something a demo should show.
"""
from __future__ import annotations

from datetime import datetime, timezone

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.config.database import get_db
from app.config.settings import get_settings
from app.schemas.usage import UsageSummaryOut
from app.services.llm_ledger import build_usage_summary
from app.services.settings.demo_mode import is_demo_mode

router = APIRouter(prefix="/usage", tags=["usage"])

GEMINI = "google_ai_studio"


@router.get("/summary", response_model=UsageSummaryOut)
def get_usage_summary(
    days: int = Query(7, ge=1, le=90), db: Session = Depends(get_db)
) -> UsageSummaryOut:
    limit = get_settings().llm_rate_limit_rpd
    if is_demo_mode(db):
        return UsageSummaryOut(
            generated_at=datetime.now(timezone.utc), days=days, gemini_daily_limit=limit,
            gemini_used_today=0, gemini_remaining_today=limit,
            daily=[], by_call_type=[], recent_errors=[], demo_mode=True,
        )
    summary = build_usage_summary(db, days=days, daily_limits={GEMINI: limit})
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    used = sum(d["requests"] for d in summary["daily"] if d["provider"] == GEMINI and d["date"] == today)
    return UsageSummaryOut(
        **summary, gemini_daily_limit=limit, gemini_used_today=used,
        gemini_remaining_today=max(limit - used, 0),
    )
