"""Database and demo inputs for the Sprint 25 rituals (Hall of Records). Read-only."""
from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.journal import DecisionJournalEntry
from app.schemas.journal import JournalEntryOut, JournalOutcomeOut
from app.services.journal import outcomes_for
from app.services.settings.synthetic_data import demo_journal

_FIELDS = (
    "id", "holding_id", "ticker", "company_name", "action", "decided_on", "price", "currency", "quantity",
    "thesis", "invalidation", "confidence", "verdict_at_decision", "review_6m", "review_12m",
    "created_at", "updated_at",
)


def journal_entries(db: Session) -> list[JournalEntryOut]:
    entries = list(db.scalars(select(DecisionJournalEntry)).all())
    outcomes = outcomes_for(db, entries)
    return [
        JournalEntryOut(
            **{f: getattr(e, f) for f in _FIELDS},
            outcome=JournalOutcomeOut.model_validate(outcomes[e.id], from_attributes=True),
        )
        for e in entries
    ]


def demo_journal_entries() -> list[JournalEntryOut]:
    return list(demo_journal().entries)

