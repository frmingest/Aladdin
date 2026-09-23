"""Request/response shapes for LLM-assisted financial extraction
(app/services/documents/financial_extraction.py)."""
from __future__ import annotations

from decimal import Decimal

from pydantic import BaseModel, Field

from app.domain.extraction_schema.v1 import StatementFactV1


class ProposeFinancialsIn(BaseModel):
    pages: list[int] | None = Field(
        default=None, description="Page numbers to read; omit to let the app find the statements"
    )


class ProposedFactOut(BaseModel):
    metric: str
    fiscal_year: int
    period: str
    value_as_printed: str
    scale: str
    currency: str | None
    source_page: int
    label_as_printed: str
    status: str
    reasons: list[str]
    warnings: list[str]
    stored_value: Decimal | None
    stored_unit: str | None
    existing_value: Decimal | None


class FinancialsProposalOut(BaseModel):
    document_id: str
    pages_sent: list[int]
    auto_selected: bool
    provider: str
    model: str
    prompt_version: str
    input_tokens: int
    output_tokens: int
    facts: list[ProposedFactOut]


class ApproveFinancialsIn(BaseModel):
    facts: list[StatementFactV1]
    provider: str | None = None
    model: str | None = None


class ApproveFinancialsOut(BaseModel):
    saved: list[ProposedFactOut]
    refused: list[ProposedFactOut]
