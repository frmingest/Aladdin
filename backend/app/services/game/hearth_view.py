"""Hearth read/write path (E3): the stored Chronicle, your journal's invalidation
lines, your tripwires and your winter order, composed by `hearth.py`.
Reads only, except `save_winter_order` (one append-only row). No provider, no LLM."""
from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.holding import Holding
from app.models.journal import DecisionJournalEntry
from app.models.thesis import ThesisTripwire
from app.models.winter_order import MAX_ORDER_CHARS, WinterOrder
from app.schemas.game import (
    ChronicleOut,
    HearthInvalidationOut,
    HearthTripwireOut,
    WinterOrderOut,
)
from app.services.thesis.metrics_registry import compute_metric_value


def current_order(db: Session) -> WinterOrderOut:
    row = db.scalars(select(WinterOrder).order_by(WinterOrder.made_at.desc(), WinterOrder.id).limit(1)).first()
    return WinterOrderOut(text=row.text, made_at=row.made_at) if row and row.text else WinterOrderOut()


def save_winter_order(db: Session, text: str, *, now: datetime | None = None) -> WinterOrderOut:
    """Append the order. Blank text is saved as a blank row, which clears it."""
    cleaned = " ".join(text.split())[:MAX_ORDER_CHARS]
    row = WinterOrder(text=cleaned, made_at=now or datetime.now(timezone.utc))
    db.add(row)
    db.commit()
    return current_order(db) if cleaned else WinterOrderOut()


def invalidation_lines(db: Session, chronicle: ChronicleOut) -> list[HearthInvalidationOut]:
    """For each tower in the newest frame: the newest journal entry that has an
    invalidation line (verbatim), and the live value of each active tripwire set
    on that holding (read without writing)."""
    stored = [f for f in chronicle.frames if f.source == "stored"]
    if not stored:
        return []
    out: list[HearthInvalidationOut] = []
    for tower in stored[-1].towers:
        entry = db.scalars(
            select(DecisionJournalEntry)
            .where(DecisionJournalEntry.holding_id == tower.holding_id)
            .where(DecisionJournalEntry.invalidation.is_not(None))
            .order_by(DecisionJournalEntry.decided_on.desc(), DecisionJournalEntry.created_at.desc())
        ).first()
        if entry is None or not (entry.invalidation or "").strip():
            continue
        holding = db.get(Holding, tower.holding_id)
        wires: list[HearthTripwireOut] = []
        if holding is not None:
            for tw in db.scalars(
                select(ThesisTripwire)
                .where(ThesisTripwire.holding_id == tower.holding_id, ThesisTripwire.active.is_(True))
                .order_by(ThesisTripwire.created_at)
            ):
                res = compute_metric_value(db, holding, tw.metric)
                firing = (
                    res.value is not None
                    and ((res.value < tw.threshold) if tw.operator == "below" else (res.value > tw.threshold))
                )
                wires.append(HearthTripwireOut(
                    metric=tw.metric, label=tw.label, operator=tw.operator, threshold=tw.threshold,
                    current_value=res.value, unavailable_reason=res.unavailable_reason, firing=bool(firing),
                ))
        out.append(HearthInvalidationOut(
            holding_id=tower.holding_id, name=tower.name, entry_id=entry.id,
            decided_on=entry.decided_on, line=entry.invalidation.strip(), tripwires=wires,
        ))
    return out
