"""Schemas for GET /tag-review (read-only tag review inbox, PR 1)."""
from __future__ import annotations

from uuid import UUID

from pydantic import BaseModel


class TagCandidateOut(BaseModel):
    concept: str
    prefix: str
    extension: bool
    suggested_scope: str  # "all" (standard tag) | "company" (the filer's own extension)
    value: str
    unit: str
    prior_year_value: str | None
    check: str  # ties | plausible | does_not_tie | no_check
    check_detail: str
    warning: str | None
    score: int


class TagGapOut(BaseModel):
    metric: str
    fiscal_year: str
    candidates: list[TagCandidateOut]


class TagUnusedOut(BaseModel):
    concept: str
    extension: bool
    statement: str
    value: str
    unit: str
    share_of_base: str
    prior_year_value: str | None


class TagReviewHoldingOut(BaseModel):
    holding_id: UUID
    ticker: str
    name: str
    document_id: UUID
    filename: str
    fiscal_year: str
    gaps: list[TagGapOut]
    unused: list[TagUnusedOut]
    chat_summary: str  # plain text a person can paste into a chat


class TagReviewOut(BaseModel):
    holdings: list[TagReviewHoldingOut]
    holdings_needing_review: int
    total_gaps: int
