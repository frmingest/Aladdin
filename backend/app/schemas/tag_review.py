"""Schemas for the tag review inbox (GET /tag-review, and the rules endpoints, PR 2)."""
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
    decision: str | None = None  # "accepted" once a rule exists (applied on the next re-extract)
    needs_second_confirmation: bool = False  # failed its check or looks implausibly large


class TagGapOut(BaseModel):
    metric: str
    fiscal_year: str
    candidates: list[TagCandidateOut]
    rejected_hidden: int = 0  # suggestions hidden because they were rejected for this holding
    rule_pending: bool = False  # a rule is saved but the company has not been re-extracted yet


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


class TagRuleCreate(BaseModel):
    holding_id: UUID
    metric: str  # the input's label as the inbox shows it, e.g. "total debt"
    concept: str
    confirm_failed_check: bool = False  # the second confirmation


class TagRejectionCreate(BaseModel):
    holding_id: UUID
    metric: str
    concept: str


class TagRuleOut(BaseModel):
    id: UUID
    status: str  # accepted | rejected
    metric: str  # canonical metric key
    metric_label: str
    concept: str
    scope: str  # "all" | "company"
    ticker: str | None
    holding_id: UUID | None
    check_status: str | None
    check_detail: str | None
    check_overridden: bool
    fiscal_year: str | None
    source_filename: str | None

    model_config = {"from_attributes": True}


class TagRulesOut(BaseModel):
    rules: list[TagRuleOut]


class ReextractRequest(BaseModel):
    holding_id: UUID


class ReextractOut(BaseModel):
    holding_id: UUID
    ticker: str
    documents: int
    facts_before: int
    facts_after: int
    rule_figures: int
    notes: list[str]
