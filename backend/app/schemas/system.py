"""Pydantic schemas for GET /system/status (feature F4)."""
from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import BaseModel

Status = Literal["ok", "warn", "error", "off"]


class StatusItemOut(BaseModel):
    key: str
    label: str
    status: Status
    value: str
    detail: str


class FreshnessItemOut(BaseModel):
    key: str
    label: str
    last_at: datetime | None
    status: Status
    detail: str


class JobItemOut(BaseModel):
    key: str
    label: str
    runs_on: str
    schedule: str
    last_at: datetime | None
    status: Status
    detail: str


class SystemStatusOut(BaseModel):
    generated_at: datetime
    version: str
    environment: str
    commit: str | None
    database_ok: bool
    database_dialect: str | None
    migration_current: str | None
    migration_head: str | None
    providers: list[StatusItemOut]
    llm_daily_limit: int
    llm_calls_remaining_today: int
    freshness: list[FreshnessItemOut]
    analysis: list[StatusItemOut]
    counts: dict[str, int]
    issues: list[str]
    # Background jobs (2026-10-07); empty for older payloads and in demo mode.
    jobs: list[JobItemOut] = []
    # Set true only while demo mode is on (app/services/settings/demo_mode.py)
    # so the System status page always shows it — never inferred elsewhere.
    demo_mode: bool = False


class PromptLogItemOut(BaseModel):
    """One row of the prompt log list — sizes and outcome, no prompt bodies."""

    model_config = {"protected_namespaces": ()}

    id: str
    occurred_at: datetime
    provider: str
    model_name: str
    call_type: str
    schema_name: str | None
    outcome: str
    error_detail: str | None
    input_tokens: int | None
    output_tokens: int | None
    latency_ms: float | None
    prompt_chars: int
    preview: str


class PromptLogListOut(BaseModel):
    total: int
    items: list[PromptLogItemOut]
    providers: list[str]
    retention_days: int
    enabled: bool
    demo_mode: bool = False


class PromptLogDetailOut(PromptLogItemOut):
    system_prompt: str | None
    user_prompt: str
    response_text: str | None
