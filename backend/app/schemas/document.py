from __future__ import annotations

from datetime import datetime
from decimal import Decimal
from uuid import UUID

from pydantic import BaseModel

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
    quality_flags: dict[str, bool]
    page_count: int
    fact_count: int


class DocumentDetail(DocumentOut):
    pages: list[DocumentPageOut]
    facts: list[FinancialLineItemOut]


class DocumentUploadResponse(BaseModel):
    document: DocumentDetail
    was_duplicate_file: bool
