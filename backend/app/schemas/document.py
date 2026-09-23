from __future__ import annotations

from datetime import datetime
from decimal import Decimal
from typing import Any
from uuid import UUID

from pydantic import BaseModel, field_validator

PREVIEW_CHARS = 300


class DocumentPageOut(BaseModel):
    page_number: int
    extraction_quality: str
    text_preview: str


class FinancialLineItemOut(BaseModel):
    metric: str
    value: Decimal
    unit: str
    currency: str | None
    period: str
    source_page: int | None
    confidence: float


class DocumentOut(BaseModel):
    id: UUID
    holding_id: UUID | None
    type: str
    original_filename: str
    mime_type: str
    size_bytes: int
    uploaded_at: datetime
    reporting_period: str | None
    sha256: str
    status: str
    # Flags are booleans, but some entries carry detail: the SEC EDGAR import
    # ("provenance", "filings"), iXBRL/CSV extraction ("ixbrl",
    # "fact_conflicts", "facts_differ_from_existing") and LLM extraction
    # ("financials_extraction"). Typed as Any since 2026-09-23 — as
    # dict[str, bool] any such document 500'd GET /documents.
    quality_flags: dict[str, Any]
    page_count: int
    fact_count: int

    @field_validator("quality_flags", mode="before")
    @classmethod
    def _coerce_quality_flags(cls, value: Any) -> dict[str, Any]:
        """Defensively normalizes `Document.quality_flags` into the dict
        shape this schema expects, regardless of what's actually stored.

        `documents.quality_flags` is a plain JSON column
        (app/models/document.py) with no DB-level shape constraint, and
        this app's own ingestion code has, historically, written a
        `list[str]` of flag names to it before being changed to write a
        `dict[str, bool]` instead (see
        app/services/documents/ingestion.py's `process_document`, which
        now does `flags[flag] = True` for each name). A row written under
        the older shape — or any other unexpected JSON shape — used to
        502 `POST /portfolio/import-csv` and `GET /documents` outright
        (Pydantic v2's strict dict validation rejects a list), taking down
        an otherwise-successful import with it. Never drops information:
        a list of flag names becomes `{name: True, ...}`, matching exactly
        what the current ingestion code would have written for the same
        flags.
        """
        if isinstance(value, dict):
            return value
        if isinstance(value, list):
            return {str(flag): True for flag in value}
        return {}


class DocumentDetail(DocumentOut):
    pages: list[DocumentPageOut]
    facts: list[FinancialLineItemOut]


class DocumentUploadResponse(BaseModel):
    document: DocumentDetail
    was_duplicate_file: bool
