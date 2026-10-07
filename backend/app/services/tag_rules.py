"""Tag mapping rules (tag review inbox, PR 2): accept, reject, list, remove,
and re-read a company's stored filings with the accepted rules.

Rules are data, read by the extractor *after* its built-in lists, so a rule
can only fill a figure the built-in mapping left empty (CLAUDE.md Rule 1:
still deterministic code reading a tagged number; the LLM is not involved).
Only a candidate the inbox actually offered can be accepted: the server looks
the concept up in the stored review of that holding's newest report, so no
arbitrary tag name can be turned into a rule. A candidate that failed its own
check, or looks implausibly large, is refused until the caller confirms a
second time.
"""
from __future__ import annotations

import uuid
from dataclasses import dataclass, field
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.document import Document
from app.models.financial_line_item import FinancialLineItem
from app.models.holding import Holding
from app.models.tag_mapping_rule import TagMappingRule
from app.providers.object_storage import ObjectStorageProvider
from app.services.documents.extraction import MappingRule
from app.services.documents.extraction import ixbrl as ix
from app.services.documents.extraction.tag_review import EXTRA_INPUTS
from app.services.tag_review import newest_review

ACCEPTED = "accepted"
REJECTED = "rejected"
SCOPE_ALL = "all"
SCOPE_COMPANY = "company"

# Inbox label -> the one canonical metric a rule fills (the first metric of
# the input; e.g. "operating profit (EBIT)" fills `ebit`).
LABEL_TO_METRIC: dict[str, str] = {
    label: metrics[0]
    for label, metrics in (*ix.CORE_INPUTS, *EXTRA_INPUTS.items())
    if label != "EBITDA"  # derived in code from EBIT + D&A, never read from one tag
}


class RuleError(Exception):
    """A rule request that cannot be honoured; `status` is the HTTP status."""

    def __init__(self, status: int, message: str) -> None:
        super().__init__(message)
        self.status = status
        self.message = message


def needs_second_confirmation(candidate: dict[str, Any]) -> bool:
    """A candidate that fails its own check or looks implausibly large."""
    return candidate.get("check") == "does_not_tie" or bool(candidate.get("warning"))


def _all(db: Session) -> list[TagMappingRule]:
    return list(db.scalars(select(TagMappingRule).order_by(TagMappingRule.created_at)))


def rules_for_holding(db: Session, holding_id: uuid.UUID | None) -> list[MappingRule]:
    """Accepted rules that apply to one holding: every all-companies rule and
    that holding's own company rules. De-duplicated, oldest first."""
    seen: set[tuple[str, str]] = set()
    out: list[MappingRule] = []
    for row in _all(db):
        if row.status != ACCEPTED:
            continue
        if row.scope == SCOPE_COMPANY and row.holding_id != holding_id:
            continue
        key = (row.metric, row.concept)
        if key in seen:
            continue
        seen.add(key)
        out.append(MappingRule(row.metric, row.concept, row.check_overridden))
    return out


def rejected_concepts(db: Session, holding_id: uuid.UUID) -> set[tuple[str, str]]:
    return {
        (r.metric_label, r.concept)
        for r in _all(db)
        if r.status == REJECTED and r.holding_id == holding_id
    }


def accepted_for(db: Session, holding_id: uuid.UUID) -> dict[tuple[str, str], TagMappingRule]:
    """(metric label, concept) -> the accepted rule that applies to the holding."""
    return {
        (r.metric_label, r.concept): r
        for r in _all(db)
        if r.status == ACCEPTED and (r.scope == SCOPE_ALL or r.holding_id == holding_id)
    }


def _find_candidate(db: Session, holding_id: uuid.UUID, label: str, concept: str) -> tuple[Document, dict[str, Any], dict[str, Any]]:
    found = newest_review(db, holding_id)
    if found is None:
        raise RuleError(404, "this holding has no tag review (fetch its reports first)")
    document, review = found
    for gap in review["gaps"]:
        if gap["metric"] != label:
            continue
        for candidate in gap["candidates"]:
            if candidate["concept"] == concept:
                return document, review, candidate
    raise RuleError(404, "that tag is not one of the suggestions for this input")


def _upsert(db: Session, holding_id: uuid.UUID, metric: str, concept: str) -> TagMappingRule | None:
    return db.scalars(
        select(TagMappingRule).where(
            TagMappingRule.holding_id == holding_id,
            TagMappingRule.metric == metric,
            TagMappingRule.concept == concept,
        )
    ).first()


def accept_rule(
    db: Session, holding_id: uuid.UUID, label: str, concept: str, confirm_failed_check: bool = False
) -> TagMappingRule:
    if label not in LABEL_TO_METRIC:
        raise RuleError(422, f"'{label}' is not an input a rule can fill")
    holding = db.get(Holding, holding_id)
    if holding is None:
        raise RuleError(404, "holding not found")
    document, review, candidate = _find_candidate(db, holding_id, label, concept)
    overridden = needs_second_confirmation(candidate)
    if overridden and not confirm_failed_check:
        reason = candidate.get("warning") or candidate.get("check_detail") or "its check failed"
        raise RuleError(
            409,
            f"This tag failed its own check ({reason}). It can still be accepted, but only after a second confirmation.",
        )
    metric = LABEL_TO_METRIC[label]
    row = _upsert(db, holding_id, metric, concept)
    if row is None:
        row = TagMappingRule(holding_id=holding_id, metric=metric, concept=concept)
        db.add(row)
    row.ticker = holding.ticker
    row.metric_label = label
    row.scope = SCOPE_COMPANY if candidate["extension"] else SCOPE_ALL  # decided here, not by the client
    row.status = ACCEPTED
    row.check_status = candidate["check"]
    row.check_detail = candidate["check_detail"]
    row.check_overridden = overridden
    row.fiscal_year = review["fiscal_year"]
    row.source_filename = document.original_filename
    db.commit()
    return row


def reject_rule(db: Session, holding_id: uuid.UUID, label: str, concept: str) -> TagMappingRule:
    if label not in LABEL_TO_METRIC:
        raise RuleError(422, f"'{label}' is not an input a rule can fill")
    holding = db.get(Holding, holding_id)
    if holding is None:
        raise RuleError(404, "holding not found")
    document, review, candidate = _find_candidate(db, holding_id, label, concept)
    metric = LABEL_TO_METRIC[label]
    row = _upsert(db, holding_id, metric, concept)
    if row is None:
        row = TagMappingRule(holding_id=holding_id, metric=metric, concept=concept)
        db.add(row)
    row.ticker = holding.ticker
    row.metric_label = label
    row.scope = SCOPE_COMPANY if candidate["extension"] else SCOPE_ALL
    row.status = REJECTED
    row.check_status = candidate["check"]
    row.check_detail = candidate["check_detail"]
    row.check_overridden = False
    row.fiscal_year = review["fiscal_year"]
    row.source_filename = document.original_filename
    db.commit()
    return row


def remove_rule(db: Session, rule_id: uuid.UUID) -> None:
    row = db.get(TagMappingRule, rule_id)
    if row is None:
        raise RuleError(404, "rule not found")
    db.delete(row)
    db.commit()


def list_rules(db: Session) -> list[TagMappingRule]:
    return sorted(_all(db), key=lambda r: (r.status != ACCEPTED, r.ticker or "", r.metric_label, r.concept))


# --- re-extraction -----------------------------------------------------------


@dataclass
class ReextractResult:
    holding_id: uuid.UUID
    ticker: str
    documents: int = 0
    facts_before: int = 0
    facts_after: int = 0
    rule_figures: int = 0
    notes: list[str] = field(default_factory=list)


def reextract_holding(db: Session, storage: ObjectStorageProvider, holding_id: uuid.UUID) -> ReextractResult:
    # Imported here: ingestion imports this module.
    from app.services.documents.ingestion import refresh_document_facts

    holding = db.get(Holding, holding_id)
    if holding is None:
        raise RuleError(404, "holding not found")
    return refresh_document_facts(db, storage, holding)


def count_facts(db: Session, holding_id: uuid.UUID) -> int:
    return len(list(db.scalars(select(FinancialLineItem.id).where(FinancialLineItem.holding_id == holding_id))))
