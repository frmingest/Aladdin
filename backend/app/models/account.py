"""Account — a real-world custody account a portfolio upload belongs to.

Faiz's holdings are split across several brokerage/pension accounts (Aksje &
fonds konto, ASK, EPK Aktiv/Passiv, ...). Before this, every upload merged
into one undifferentiated portfolio (see app.services.portfolio.ingestion),
which silently collapsed two different accounts holding the same instrument
into a single row. Account gives every snapshot/position a home so the app
can show and filter "what's in which account" instead.
"""

import uuid
from datetime import datetime, timezone

from sqlalchemy import DateTime, String
from sqlalchemy.orm import Mapped, mapped_column

from app.config.database import Base
from app.models.types import GUID, new_uuid


class Account(Base):
    __tablename__ = "accounts"

    id: Mapped["uuid.UUID"] = mapped_column(GUID, primary_key=True, default=new_uuid)
    name: Mapped[str] = mapped_column(String(128), nullable=False)
    # The broker/platform's own account number, as Faiz refers to the
    # account (e.g. "70541644"). Unique so the same real-world account can't
    # be registered twice by accident.
    account_number: Mapped[str] = mapped_column(String(64), unique=True, index=True, nullable=False)
    institution: Mapped[str | None] = mapped_column(String(128), nullable=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )

    def __repr__(self) -> str:  # pragma: no cover
        return f"<Account {self.name} ({self.account_number})>"
