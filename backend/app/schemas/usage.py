"""Pydantic schemas for GET /usage/summary (LLM usage ledger)."""
from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, ConfigDict


class UsageDayOut(BaseModel):
    model_config = ConfigDict(protected_namespaces=())

    date: str
    provider: str
    model_name: str
    requests: int
    failed: int
    blocked: int
    input_tokens: int
    output_tokens: int
    daily_limit: int | None
    remaining: int | None  # today's row only, and only for a provider with a cap


class UsageCallTypeOut(BaseModel):
    provider: str
    call_type: str
    requests: int


class UsageErrorOut(BaseModel):
    occurred_at: datetime
    provider: str
    call_type: str
    detail: str


class UsageSummaryOut(BaseModel):
    generated_at: datetime
    days: int
    gemini_daily_limit: int
    gemini_used_today: int
    gemini_remaining_today: int
    daily: list[UsageDayOut]
    by_call_type: list[UsageCallTypeOut]
    recent_errors: list[UsageErrorOut]
    demo_mode: bool = False
