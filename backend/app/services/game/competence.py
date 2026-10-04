"""G19 Circle of Competence (Sprint 25, 2026-10-04).

Lays the user's own sector marks over the holdings. The app never infers a
mark: a sector with no row is *unmarked*, a holding with no sector is
*unclassified*, and neither is called inside the circle. Funds, gold and other
non-stock structures are not judged (their sector says nothing about what the
user knows). Pure assembly in `build_competence`; the small database part
(`load_marks`, `set_mark`, `clear_mark`) only reads and writes the user's own
rows. All of it is information, never advice.
"""
from __future__ import annotations

from datetime import datetime, timezone
from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.domain.game_mapping.rituals_v1 import RitualsRules
from app.domain.instrument_types import STOCK
from app.domain.sectors import SECTORS, is_valid_sector
from app.models.competence import CompetenceMark
from app.schemas.game import (
    CompetenceHeldOut,
    CompetenceOut,
    CompetenceSectorOut,
    CompetenceTowerOut,
    TowerOut,
)

ZERO = Decimal(0)
_STATUS = {"know": "inside", "partly": "edge", "outside": "outside"}


def load_marks(db: Session) -> dict[str, CompetenceMark]:
    return {m.sector: m for m in db.scalars(select(CompetenceMark)).all()}


def set_mark(db: Session, sector: str, level: str, note: str | None, rules: RitualsRules, *, now: datetime | None = None) -> CompetenceMark:
    if not is_valid_sector(sector):
        raise ValueError(f"{sector!r} is not one of the standard sectors.")
    if level not in rules.competence_levels:
        raise ValueError(f"level must be one of {', '.join(rules.competence_levels)}.")
    cleaned = (note or "").strip() or None
    if cleaned is not None and len(cleaned) > rules.competence_note_max_chars:
        raise ValueError(f"note is longer than {rules.competence_note_max_chars} characters.")
    row = db.scalar(select(CompetenceMark).where(CompetenceMark.sector == sector))
    when = now or datetime.now(timezone.utc)
    if row is None:
        row = CompetenceMark(sector=sector, level=level, note=cleaned, marked_at=when)
        db.add(row)
    else:
        row.level, row.note, row.marked_at = level, cleaned, when
    db.commit()
    db.refresh(row)
    return row


def clear_mark(db: Session, sector: str) -> bool:
    row = db.scalar(select(CompetenceMark).where(CompetenceMark.sector == sector))
    if row is None:
        return False
    db.delete(row)
    db.commit()
    return True


def tower_status(tower: TowerOut, marks: dict[str, tuple[str, str | None, datetime | None]]) -> str:
    if tower.instrument_type != STOCK:
        return "not_applicable"
    if not tower.sector:
        return "unclassified"
    mark = marks.get(tower.sector)
    return "unmarked" if mark is None else _STATUS[mark[0]]


def _w(value: Decimal | None) -> Decimal:
    return value if value is not None else ZERO


def build_competence(
    towers: list[TowerOut],
    marks: dict[str, tuple[str, str | None, datetime | None]],
    rules: RitualsRules,
    *,
    demo: bool = False,
) -> CompetenceOut:
    """`marks` maps sector -> (level, note, marked_at)."""
    tower_rows = [
        CompetenceTowerOut(
            holding_id=t.holding_id, name=t.name, sector=t.sector, weight_pct=t.weight_pct,
            status=tower_status(t, marks),
        )
        for t in sorted(towers, key=lambda t: _w(t.weight_pct), reverse=True)
    ]
    sectors: list[CompetenceSectorOut] = []
    for sector in SECTORS:
        held = [
            CompetenceHeldOut(holding_id=t.holding_id, name=t.name, weight_pct=t.weight_pct)
            for t in towers
            if t.instrument_type == STOCK and t.sector == sector
        ]
        held.sort(key=lambda h: _w(h.weight_pct), reverse=True)
        mark = marks.get(sector)
        sectors.append(
            CompetenceSectorOut(
                sector=sector,
                level=mark[0] if mark else None,  # type: ignore[arg-type]
                note=mark[1] if mark else None,
                marked_at=mark[2] if mark else None,
                weight_pct=sum((_w(h.weight_pct) for h in held), ZERO),
                holdings=held,
            )
        )
    # Marks on sectors that are not on the standard list cannot exist (set_mark refuses them).

    def total(status: str) -> Decimal:
        return sum((_w(r.weight_pct) for r in tower_rows if r.status == status), ZERO)

    inside, edge, outside = total("inside"), total("edge"), total("outside")
    unmarked, unclassified = total("unmarked"), total("unclassified")
    stock_rows = [r for r in tower_rows if r.status != "not_applicable"]
    if not stock_rows:
        summary = "There are no stock holdings to place inside or outside a circle."
    elif not marks:
        summary = (
            "No sector is marked yet, so nothing can be said about the circle. "
            "Mark the sectors you really understand; unmarked is not the same as inside."
        )
    else:
        summary = (
            f"Of the stock holdings, {inside:.1f}% of the portfolio is in sectors you marked as known, "
            f"{edge:.1f}% on the edge, {outside:.1f}% outside; {unmarked:.1f}% sits in unmarked sectors"
            + (f" and {unclassified:.1f}% has no sector set." if unclassified > 0 else ".")
        )
    return CompetenceOut(
        rules_version=rules.version, demo=demo, levels=list(rules.competence_levels), sectors=sectors,
        towers=tower_rows, inside_weight_pct=inside, edge_weight_pct=edge, outside_weight_pct=outside,
        unmarked_weight_pct=unmarked, unclassified_weight_pct=unclassified, summary=summary,
        note_max_chars=rules.competence_note_max_chars,
    )


def get_competence(db: Session, towers: list[TowerOut], rules: RitualsRules) -> CompetenceOut:
    marks = {s: (m.level, m.note, m.marked_at) for s, m in load_marks(db).items()}
    return build_competence(towers, marks, rules)
