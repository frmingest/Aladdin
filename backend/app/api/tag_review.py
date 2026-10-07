"""Tag review inbox: ``GET /tag-review`` lists, per holding, the inputs the
ESEF extractor could not fill and the tagged lines that look closest, plus the
largest tagged numbers nothing reads (PR 1, read-only).

PR 2 adds the decisions: accept a suggestion as a mapping rule, reject it,
remove a rule, and re-read a company's stored reports with the rules. A rule
is data read by the extractor after its built-in lists; nothing is written to
a figure until a re-extract. No LLM. Hidden / blocked while demo mode is on."""
from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Response
from sqlalchemy.orm import Session

from app.config.database import get_db
from app.providers.factory import get_object_storage
from app.schemas.tag_review import (
    ReextractOut,
    ReextractRequest,
    TagRejectionCreate,
    TagReviewOut,
    TagRuleCreate,
    TagRuleOut,
    TagRulesOut,
)
from app.services.settings.demo_guard import require_not_demo
from app.services.settings.demo_mode import is_demo_mode
from app.services.tag_review import build_tag_review
from app.services.tag_rules import (
    RuleError,
    accept_rule,
    list_rules,
    reextract_holding,
    reject_rule,
    remove_rule,
)

router = APIRouter(prefix="/tag-review", tags=["tag-review"])


def _fail(err: RuleError) -> HTTPException:
    return HTTPException(status_code=err.status, detail=err.message)


@router.get("", response_model=TagReviewOut)
def get_tag_review(holding_id: UUID | None = None, db: Session = Depends(get_db)) -> TagReviewOut:
    if is_demo_mode(db):
        return TagReviewOut(holdings=[], holdings_needing_review=0, total_gaps=0)
    return TagReviewOut.model_validate(build_tag_review(db, holding_id))


@router.get("/rules", response_model=TagRulesOut)
def get_rules(db: Session = Depends(get_db)) -> TagRulesOut:
    if is_demo_mode(db):
        return TagRulesOut(rules=[])
    return TagRulesOut(rules=[TagRuleOut.model_validate(r) for r in list_rules(db)])


@router.post("/rules", response_model=TagRuleOut, status_code=201)
def create_rule(body: TagRuleCreate, db: Session = Depends(get_db)) -> TagRuleOut:
    """Accept a suggestion as a mapping rule. A standard tag applies to all
    companies, a company's own tag to that company only (decided here). 409
    until `confirm_failed_check` is true when the suggestion failed its check."""
    require_not_demo(db)
    try:
        return TagRuleOut.model_validate(
            accept_rule(db, body.holding_id, body.metric, body.concept, body.confirm_failed_check)
        )
    except RuleError as err:
        raise _fail(err) from err


@router.post("/rejections", response_model=TagRuleOut, status_code=201)
def create_rejection(body: TagRejectionCreate, db: Session = Depends(get_db)) -> TagRuleOut:
    """Remember a suggestion as wrong for this holding so it is not offered again."""
    require_not_demo(db)
    try:
        return TagRuleOut.model_validate(reject_rule(db, body.holding_id, body.metric, body.concept))
    except RuleError as err:
        raise _fail(err) from err


@router.delete("/rules/{rule_id}", status_code=204)
def delete_rule(rule_id: UUID, db: Session = Depends(get_db)) -> Response:
    """Remove a rule (or bring a rejected suggestion back). Figures already
    read by the rule stay until the company is re-extracted."""
    require_not_demo(db)
    try:
        remove_rule(db, rule_id)
    except RuleError as err:
        raise _fail(err) from err
    return Response(status_code=204)


@router.post("/re-extract", response_model=ReextractOut)
def re_extract(body: ReextractRequest, db: Session = Depends(get_db), storage=Depends(get_object_storage)) -> ReextractOut:
    """Re-read a holding's stored tagged reports with the current rules and
    replace their figures. Pages and text are not touched."""
    require_not_demo(db)
    try:
        result = reextract_holding(db, storage, body.holding_id)
    except RuleError as err:
        raise _fail(err) from err
    return ReextractOut(
        holding_id=result.holding_id,
        ticker=result.ticker,
        documents=result.documents,
        facts_before=result.facts_before,
        facts_after=result.facts_after,
        rule_figures=result.rule_figures,
        notes=result.notes,
    )
