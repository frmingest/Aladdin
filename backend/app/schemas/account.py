"""Pydantic schemas for the accounts API (app/api/accounts.py)."""
from __future__ import annotations

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field


class AccountCreate(BaseModel):
    name: str = Field(min_length=1, max_length=128)
    account_number: str = Field(min_length=1, max_length=64)
    institution: str | None = None


class AccountUpdate(BaseModel):
    """Every field optional — only what's supplied is changed.

    `account_number` is excluded: it's the unique real-world identifier
    (and positions/snapshots key against the account by id, not number), so
    changing it is a correction to make directly, not a routine update —
    ask before adding a path for it.
    """

    name: str | None = Field(default=None, min_length=1, max_length=128)
    institution: str | None = None


class AccountOut(BaseModel):
    id: UUID
    name: str
    account_number: str
    institution: str | None
    created_at: datetime
    updated_at: datetime
    position_count: int
    snapshot_count: int
