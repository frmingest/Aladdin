"""Executive summary endpoint (architecture §19) — a portfolio-wide rollup
of Composition/Portfolio risk/Factor profile/Macro dashboard, plus a
consolidated "needs attention" list. Read-only: built entirely from data
those sections already persisted, so — like `GET .../valuation` — this never
takes a `MarketDataProvider`/`LLMProvider` dependency and is free to call on
every dashboard page load (§2.7)."""

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.config.database import get_db
from app.models.portfolio import PortfolioSnapshot
from app.schemas.executive_summary import ExecutiveSummaryOut
from app.services.executive_summary.builder import build_executive_summary

router = APIRouter(prefix="/portfolio", tags=["executive-summary"])


@router.get("/snapshots/{snapshot_id}/executive-summary", response_model=ExecutiveSummaryOut)
def get_executive_summary(
    snapshot_id: UUID,
    account_id: list[UUID] = Query(default=[]),
    db: Session = Depends(get_db),
) -> ExecutiveSummaryOut:
    """`account_id` (repeatable) works exactly like every other dashboard
    endpoint's account filter — omit it for "every account"."""
    snapshot = db.get(PortfolioSnapshot, snapshot_id)
    if snapshot is None:
        raise HTTPException(status_code=404, detail="snapshot not found")

    return build_executive_summary(db, snapshot, account_ids=set(account_id) if account_id else None)
