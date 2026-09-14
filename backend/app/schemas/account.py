from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class AccountOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    name: str
    account_number: str
    institution: str | None
    created_at: datetime


class AccountCreate(BaseModel):
    name: str = Field(min_length=1, max_length=128)
    account_number: str = Field(min_length=1, max_length=64)
    institution: str | None = None


class AccountUpdate(BaseModel):
    """PATCH body — every field optional, only what's provided changes."""

    name: str | None = Field(default=None, min_length=1, max_length=128)
    account_number: str | None = Field(default=None, min_length=1, max_length=64)
    institution: str | None = None
