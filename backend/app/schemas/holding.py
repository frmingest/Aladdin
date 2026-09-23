"""Pydantic schemas for the holdings API (app/api/holdings.py)."""
from __future__ import annotations

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field, field_validator

from app.domain.instrument_types import INSTRUMENT_TYPES
from app.domain.sectors import SECTORS, is_valid_sector


class HoldingCreate(BaseModel):
    ticker: str = Field(min_length=1, max_length=255)
    name: str = Field(min_length=1, max_length=255)
    trading_currency: str = Field(min_length=3, max_length=3)
    sector: str | None = None
    institution: str | None = None
    custody_type: str | None = None
    # Instrument type (app/domain/instrument_types.py). Optional: when
    # omitted, create_holding classifies it from `name` exactly like the CSV
    # importer does. Before 2026-09-22 this fell through to the model's
    # legacy default "equity", which isn't an analyzable type, so every
    # hand-created holding was rejected by POST /analysis/.../run.
    asset_class_raw: str | None = None

    @field_validator("sector")
    @classmethod
    def _validate_sector(cls, value: str | None) -> str | None:
        if value is not None and not is_valid_sector(value):
            raise ValueError(f"sector must be one of {sorted(SECTORS)} (or null)")
        return value

    @field_validator("asset_class_raw")
    @classmethod
    def _validate_instrument_type(cls, value: str | None) -> str | None:
        if value is not None and value not in INSTRUMENT_TYPES:
            raise ValueError(f"asset_class_raw must be one of {sorted(INSTRUMENT_TYPES)}")
        return value


class HoldingUpdate(BaseModel):
    """Every field optional — only what's supplied is changed.

    `ticker` is editable (Faiz's explicit request, 2026-09-21 — see
    app/api/holdings.py's `update_holding`): nothing in this app keys off
    it as a foreign key anywhere — Document/PortfolioPosition/
    FinancialLineItem all FK on `holding_id`, the row's UUID, never on
    `ticker` — so renaming it in place is a plain UPDATE, not a
    delete+recreate; the note that used to be here calling it unsafe was
    wrong about that. `update_holding` still enforces the column's own
    DB-level uniqueness (a 409, matching `create_holding`'s own check,
    instead of a raw `IntegrityError` 500).

    `asset_class_raw` is also editable here — the CSV importer's
    name-based classifier (app/domain/instrument_types.py) is a
    best-effort guess ("Xetra-Gold" has been seen mis-tagged), and this is
    the fix for a wrong guess. Restricted to `INSTRUMENT_TYPES`, same as
    `sector` is restricted to the canonical list in app/domain/sectors.py
    — both are dropdowns in the frontend for the same reason: free text
    drifts.
    """

    ticker: str | None = Field(default=None, min_length=1, max_length=255)
    name: str | None = Field(default=None, min_length=1, max_length=255)
    trading_currency: str | None = Field(default=None, min_length=3, max_length=3)
    sector: str | None = None
    institution: str | None = None
    custody_type: str | None = None
    asset_class_raw: str | None = None

    @field_validator("sector")
    @classmethod
    def _validate_sector(cls, value: str | None) -> str | None:
        if value is not None and not is_valid_sector(value):
            raise ValueError(f"sector must be one of {sorted(SECTORS)} (or null)")
        return value

    @field_validator("asset_class_raw")
    @classmethod
    def _validate_instrument_type(cls, value: str | None) -> str | None:
        if value is not None and value not in INSTRUMENT_TYPES:
            raise ValueError(f"asset_class_raw must be one of {sorted(INSTRUMENT_TYPES)}")
        return value


class HoldingOut(BaseModel):
    id: UUID
    ticker: str
    name: str
    sector: str | None
    trading_currency: str
    institution: str | None
    custody_type: str | None
    # The instrument type tagged on import (app/domain/instrument_types.py)
    # — "stock"/"equity_etf"/"bond_fund"/"money_market_fund"/
    # "commodity_etc". Stored on the legacy `asset_class_raw` column (see
    # app/models/holding.py); NOT the same as `asset_class`, which this
    # rebuild always hardcodes to "equity" and never exposes here.
    asset_class_raw: str
    created_at: datetime
    updated_at: datetime
    document_count: int
    position_count: int


class HoldingFieldOptions(BaseModel):
    """Backs the frontend's manual-edit dropdowns for Sector and Instrument
    Type (`GET /holdings/field-options`) — single source of truth so the
    dropdown can never offer a value the backend would then reject.
    """

    sectors: list[str]
    instrument_types: list[str]
