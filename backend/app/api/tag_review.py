"""Tag review inbox (PR 1, read-only): ``GET /tag-review`` lists, per holding,
the inputs the ESEF extractor could not fill and the tagged lines that look
closest, plus the largest tagged numbers nothing reads. No LLM, no writes.
Hidden while demo mode is on (holding names are portfolio data)."""
from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.config.database import get_db
from app.schemas.tag_review import TagReviewOut
from app.services.settings.demo_mode import is_demo_mode
from app.services.tag_review import build_tag_review

router = APIRouter(prefix="/tag-review", tags=["tag-review"])


@router.get("", response_model=TagReviewOut)
def get_tag_review(holding_id: UUID | None = None, db: Session = Depends(get_db)) -> TagReviewOut:
    if is_demo_mode(db):
        return TagReviewOut(holdings=[], holdings_needing_review=0, total_gaps=0)
    return TagReviewOut.model_validate(build_tag_review(db, holding_id))
