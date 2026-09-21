"""EquityHoldingNote CRUD — the portfolio owner's own freeform thesis, one
row per holding (CLAUDE.md Rule 4: read only by
app/services/analysis/reconciliation_pass.py, never by the blind pass)."""
from __future__ import annotations

import uuid
from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.analysis import EquityHoldingNote


def get_holding_note(db: Session, holding_id: uuid.UUID) -> EquityHoldingNote | None:
    return db.scalar(select(EquityHoldingNote).where(EquityHoldingNote.holding_id == holding_id))


def set_holding_note(db: Session, holding_id: uuid.UUID, content: str) -> EquityHoldingNote:
    note = get_holding_note(db, holding_id)
    if note is None:
        note = EquityHoldingNote(holding_id=holding_id, content=content)
        db.add(note)
    else:
        note.content = content
        note.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(note)
    return note
