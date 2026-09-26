"""Small generic app-settings table (2026-09-26) - first use is the
demo-mode flag (app/services/settings/demo_mode.py). Deliberately generic
(`key`/`value` strings) rather than one boolean column per setting, so a
future on/off flag doesn't need its own migration.

No seed row is ever inserted: absence of a key means its feature is at
its documented default (demo_mode: False/off).
"""
from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy import DateTime, String
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base


class AppSetting(Base):
    __tablename__ = "app_settings"

    key: Mapped[str] = mapped_column(String(64), primary_key=True)
    value: Mapped[str] = mapped_column(String(255), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )
