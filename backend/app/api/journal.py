"""Decision journal endpoints (feature F6) — see app/services/journal.py.

Database-only (no provider or LLM call). Deleting an entry needs
confirm=true: it is your own written record and can't be recovered.
"""
from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config.database import get_db
from app.models.holding import Holding
from app.models.journal import DecisionJournalEntry
from app.schemas.journal import (
    JournalEntryCreate,
    JournalEntryOut,
    JournalEntryUpdate,
    JournalOut,
    JournalOutcomeOut,
)
from app.services.analysis.latest import latest_runs_by_holding, run_ratings
from app.services.journal import outcomes_for
from app.services.settings.demo_guard import require_not_demo
from app.services.settings.demo_mode import is_demo_mode
from app.services.settings.synthetic_data import demo_journal

router = APIRouter(prefix="/journal", tags=["journal"])

_FIELDS = (
    "id", "holding_id", "ticker", "company_name", "action", "decided_on", "price", "currency", "quantity",
    "thesis", "invalidation", "confidence", "verdict_at_decision", "review_6m", "review_12m",
    "created_at", "updated_at",
)


def _out(db: Session, entries: list[DecisionJournalEntry]) -> list[JournalEntryOut]:
    outcomes = outcomes_for(db, entries)
    return [
        JournalEntryOut(
            **{f: getattr(e, f) for f in _FIELDS},
            outcome=JournalOutcomeOut.model_validate(outcomes[e.id], from_attributes=True),
        )
        for e in entries
    ]


def _get_or_404(db: Session, entry_id: UUID) -> DecisionJournalEntry:
    entry = db.get(DecisionJournalEntry, entry_id)
    if entry is None:
        raise HTTPException(status_code=404, detail="journal entry not found")
    return entry


@router.get("", response_model=JournalOut)
def list_entries(holding_id: UUID | None = None, db: Session = Depends(get_db)) -> JournalOut:
    if is_demo_mode(db):
        demo = demo_journal()
        if holding_id is not None:
            demo.entries = [e for e in demo.entries if e.holding_id == holding_id]
        return demo
    stmt = select(DecisionJournalEntry).order_by(
        DecisionJournalEntry.decided_on.desc(), DecisionJournalEntry.created_at.desc()
    )
    if holding_id is not None:
        stmt = stmt.where(DecisionJournalEntry.holding_id == holding_id)
    entries = _out(db, list(db.scalars(stmt).all()))
    return JournalOut(
        entries=entries,
        reviews_due=sum(1 for e in entries if e.outcome.review_6m_due or e.outcome.review_12m_due),
    )


@router.post("", response_model=JournalEntryOut, status_code=201)
def create_entry(payload: JournalEntryCreate, db: Session = Depends(get_db)) -> JournalEntryOut:
    require_not_demo(db)
    holding = db.get(Holding, payload.holding_id)
    if holding is None:
        raise HTTPException(status_code=404, detail="holding not found")
    run = latest_runs_by_holding(db, [holding.id]).get(holding.id)
    entry = DecisionJournalEntry(
        holding_id=holding.id,
        ticker=holding.ticker,
        company_name=holding.name,
        action=payload.action,
        decided_on=payload.decided_on,
        price=payload.price,
        currency=(payload.currency or holding.trading_currency).upper(),
        quantity=payload.quantity,
        thesis=payload.thesis.strip(),
        invalidation=(payload.invalidation or "").strip() or None,
        confidence=payload.confidence,
        verdict_at_decision=run_ratings(run)[0] if run else None,
    )
    db.add(entry)
    db.commit()
    db.refresh(entry)
    return _out(db, [entry])[0]


@router.patch("/{entry_id}", response_model=JournalEntryOut)
def update_entry(entry_id: UUID, payload: JournalEntryUpdate, db: Session = Depends(get_db)) -> JournalEntryOut:
    require_not_demo(db)
    entry = _get_or_404(db, entry_id)
    for name in payload.model_fields_set:
        value = getattr(payload, name)
        if isinstance(value, str):
            value = value.strip() or None
        if name == "currency" and value:
            value = value.upper()
        if value is None and name in ("thesis", "action", "decided_on"):
            raise HTTPException(status_code=422, detail=f"{name} can't be empty")
        setattr(entry, name, value)
    db.commit()
    db.refresh(entry)
    return _out(db, [entry])[0]


@router.delete("/{entry_id}", status_code=204, response_model=None)
def delete_entry(entry_id: UUID, confirm: bool = False, db: Session = Depends(get_db)) -> None:
    require_not_demo(db)
    if not confirm:
        raise HTTPException(status_code=400, detail="deleting a journal entry is permanent; pass confirm=true")
    db.delete(_get_or_404(db, entry_id))
    db.commit()
