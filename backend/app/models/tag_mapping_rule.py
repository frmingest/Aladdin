"""Tag mapping rules (tag review inbox, PR 2).

One row per decision a person made in the tag review inbox:

* `accepted`: read `concept` as `metric` when the built-in mapping finds
  nothing. A standard tag (`ifrs-full`, `us-gaap`) applies to **all
  companies** (`scope="all"`); a filer's own extension tag (`ORK:...`)
  applies to **that company only** (`scope="company"`). The scope follows
  from the tag and is decided by the server, never by the client.
* `rejected`: the suggestion is remembered as wrong for that holding, so the
  inbox stops offering it.

`holding_id` is where the decision was made. It is what a company rule is
tied to; for an all-companies rule it is provenance only and is set to NULL
if that holding is deleted (the rule survives). Deleting a holding's
documents does **not** touch these rows, so the usual "delete and re-fetch"
cycle keeps every decision. Additive table; see
alembic/versions/s1e0f1a2b3c4_tag_mapping_rules.py.
"""
from __future__ import annotations

import uuid
from datetime import datetime, timezone

from sqlalchemy import Boolean, DateTime, ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base
from app.models.types import GUID


class TagMappingRule(Base):
    __tablename__ = "tag_mapping_rules"

    id: Mapped[uuid.UUID] = mapped_column(GUID(), primary_key=True, default=uuid.uuid4)
    holding_id: Mapped[uuid.UUID | None] = mapped_column(
        GUID(), ForeignKey("holdings.id"), nullable=True, index=True
    )
    ticker: Mapped[str | None] = mapped_column(String(32), nullable=True)  # label that outlives the holding
    metric: Mapped[str] = mapped_column(String(64), nullable=False)  # canonical metric key, e.g. "total_debt"
    metric_label: Mapped[str] = mapped_column(String(64), nullable=False)  # as the inbox shows it
    concept: Mapped[str] = mapped_column(String(255), nullable=False)
    scope: Mapped[str] = mapped_column(String(16), nullable=False)  # all | company
    status: Mapped[str] = mapped_column(String(16), nullable=False)  # accepted | rejected
    check_status: Mapped[str | None] = mapped_column(String(16), nullable=True)
    check_detail: Mapped[str | None] = mapped_column(Text, nullable=True)
    check_overridden: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    fiscal_year: Mapped[str | None] = mapped_column(String(16), nullable=True)
    source_filename: Mapped[str | None] = mapped_column(String(255), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc)
    )
