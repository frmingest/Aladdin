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
