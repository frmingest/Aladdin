"""The LLM prompt log: the exact text sent to a model, and what came back.

One row per logical provider call (a Gemini retry ladder is one row, not four —
the usage ledger in `llm_usage_events` is what counts real requests). Added
2026-10-13 so Faiz can open System status and see precisely what the app
prompted. The rows hold real evidence packets built from his brokerage data
and documents, so they are shown only to him (never in demo mode) and are
purged after `Settings.llm_prompt_log_retention_days`.
"""
from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import DateTime, Float, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base
from app.models.types import GUID


class LlmPromptLog(Base):
    __tablename__ = "llm_prompt_logs"

    id: Mapped[uuid.UUID] = mapped_column(GUID(), primary_key=True, default=uuid.uuid4)
    occurred_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, index=True)
    provider: Mapped[str] = mapped_column(String(32), nullable=False)
    model_name: Mapped[str] = mapped_column(String(64), nullable=False)
    call_type: Mapped[str] = mapped_column(String(32), nullable=False)
    schema_name: Mapped[str | None] = mapped_column(String(96), nullable=True)
    system_prompt: Mapped[str | None] = mapped_column(Text, nullable=True)
    user_prompt: Mapped[str] = mapped_column(Text, nullable=False)
    response_text: Mapped[str | None] = mapped_column(Text, nullable=True)
    outcome: Mapped[str] = mapped_column(String(24), nullable=False)
    error_detail: Mapped[str | None] = mapped_column(String(480), nullable=True)
    input_tokens: Mapped[int | None] = mapped_column(Integer, nullable=True)
    output_tokens: Mapped[int | None] = mapped_column(Integer, nullable=True)
    latency_ms: Mapped[float | None] = mapped_column(Float, nullable=True)
    prompt_chars: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
