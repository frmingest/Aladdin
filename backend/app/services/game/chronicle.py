"""G14 The Chronicle (Sprint 24, 2026-10-04): the fortress replayed through time.

Two kinds of frame, never blended:

* **stored** — a full game-state frame saved by the worker (G14a,
  `history.py`). Walls, moat, land, thesis and weather are exactly what the
  Fortress showed that day.
* **positions_only** — rebuilt from older portfolio snapshots, for the days
  before the first stored frame. Only the *positions* are real: which towers
  stood and how big they were. The walls, moats, land and thesis of those days
  cannot be rebuilt from old positions (today's analysis would be drawn on an
  old portfolio), so they are `unsurveyed` / `fog` / `not_analyzed`, and no
  wall, moat, thesis or weather change is reported across such a frame.

Read-only: database only, no provider, no LLM, no write. A replay of what was
stored, never a forecast and never advice.
"""
from __future__ import annotations

import uuid
from datetime import date, datetime, timezone
from decimal import ROUND_HALF_UP, Decimal
from itertools import pairwise

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.domain.game_mapping.retention_v1 import RETENTION_V1, missing_ranges
from app.domain.game_mapping.time_and_filings_v1 import TimeAndFilingsRules
from app.domain.game_mapping.value_types import GameMapping
from app.models.holding import Holding
from app.models.portfolio import PortfolioPosition, PortfolioSnapshot
from app.schemas.game import (
    ChronicleChangeOut,
    ChronicleFrameOut,
    ChronicleGapOut,
    ChronicleOut,
    ChronicleTowerOut,
    GameStateOut,
)
from app.services.game import history, rules

ZERO = Decimal(0)
HUNDRED = Decimal(100)


def _aware(value: datetime) -> datetime:
    return value if value.tzinfo is not None else value.replace(tzinfo=timezone.utc)


def _pct(value: Decimal | None) -> str:
    return "an unknown share" if value is None else f"{value.quantize(Decimal('0.1'), rounding=ROUND_HALF_UP)}%"


def frame_from_state(day: date, at: datetime, state: GameStateOut) -> ChronicleFrameOut:
    return ChronicleFrameOut(
        day=day,
        at=at,
        source="stored",
        total_value_nok=state.total_value_nok,
        weather=state.siege.level if state.siege is not None else "unsurveyed",
        towers=[
            ChronicleTowerOut(
                holding_id=t.holding_id, ticker=t.ticker, name=t.name, structure=t.structure,
                size_class=t.size_class, weight_pct=t.weight_pct, wall=t.wall, moat=t.moat,
                land=t.land, thesis=t.thesis,
            )
            for t in state.towers
        ],
    )


def gather_position_frames(
    db: Session, mapping: GameMapping, *, before_day: date | None
) -> list[ChronicleFrameOut]:
    """One frame per distinct upload day (older than `before_day`), each from
    the latest snapshot of every account on or before that day."""
    snaps = db.execute(
        select(PortfolioSnapshot.id, PortfolioSnapshot.uploaded_at, PortfolioSnapshot.account_id).order_by(
            PortfolioSnapshot.uploaded_at
        )
    ).all()
    if not snaps:
        return []
    snaps = [(sid, _aware(at), acct) for sid, at, acct in snaps]
    days = sorted({at.astimezone(timezone.utc).date() for _, at, _ in snaps})
    if before_day is not None:
        days = [d for d in days if d < before_day]
    if not days:
        return []

    chosen: dict[date, dict[uuid.UUID | None, tuple[uuid.UUID, datetime]]] = {}
    for day in days:
        latest: dict[uuid.UUID | None, tuple[uuid.UUID, datetime]] = {}
        for sid, at, acct in snaps:  # ordered by time: later wins
            if at.astimezone(timezone.utc).date() <= day:
                latest[acct] = (sid, at)
        chosen[day] = latest

    needed = {sid for latest in chosen.values() for sid, _ in latest.values()}
    positions: dict[uuid.UUID, list[PortfolioPosition]] = {}
    for p in db.scalars(select(PortfolioPosition).where(PortfolioPosition.snapshot_id.in_(needed))):
        positions.setdefault(p.snapshot_id, []).append(p)
    holding_ids = {p.holding_id for plist in positions.values() for p in plist}
    holdings = {
        h.id: h for h in db.scalars(select(Holding).where(Holding.id.in_(holding_ids)))
    } if holding_ids else {}

    frames: list[ChronicleFrameOut] = []
    for day in days:
        values: dict[uuid.UUID, Decimal | None] = {}
        for sid, _ in chosen[day].values():
            for p in positions.get(sid, []):
                if p.market_value_nok is None:
                    values.setdefault(p.holding_id, None)
                else:
                    values[p.holding_id] = (values.get(p.holding_id) or ZERO) + p.market_value_nok
        total = sum((v for v in values.values() if v is not None), ZERO)
        towers: list[ChronicleTowerOut] = []
        for hid, value in values.items():
            h = holdings.get(hid)
            if h is None:
                continue
            weight = (value / total * HUNDRED) if (value is not None and total > ZERO) else None
            towers.append(
                ChronicleTowerOut(
                    holding_id=hid, ticker=h.ticker, name=h.name,
                    structure=rules.structure_for(h.asset_class_raw),
                    size_class=rules.size_class(weight, mapping), weight_pct=weight,
                    wall="unsurveyed", moat="unsurveyed", land="fog", thesis="not_analyzed",
                )
            )
        towers.sort(key=lambda t: (t.weight_pct is None, -(t.weight_pct or ZERO), t.name))
        frames.append(
            ChronicleFrameOut(
                day=day,
                at=max(at for _, at in chosen[day].values()),
                source="positions_only",
                total_value_nok=total if total > ZERO else None,
                weather="unsurveyed",
                towers=towers,
            )
        )
    return frames


_MATERIAL = {"basalt": "basalt", "granite": "granite", "brick": "brick", "timber": "timber", "rotted": "rotted"}


def diff_frames(
    previous: ChronicleFrameOut, current: ChronicleFrameOut, rules_v: TimeAndFilingsRules
) -> list[ChronicleChangeOut]:
    """What differs between two consecutive frames, in plain words. Wall,
    moat, thesis and weather are compared only when BOTH frames are stored:
    a positions-only frame has no real walls to compare against."""
    changes: list[ChronicleChangeOut] = []
    day = current.day
    both_stored = previous.source == "stored" and current.source == "stored"

    if both_stored and previous.weather != current.weather:
        changes.append(
            ChronicleChangeOut(
                day=day, kind="weather_changed",
                text=f"The weather turned from {previous.weather} to {current.weather}.",
            )
        )

    before = {t.holding_id: t for t in previous.towers}
    after = {t.holding_id: t for t in current.towers}

    for hid in sorted(after.keys() - before.keys(), key=lambda h: after[h].name):
        t = after[hid]
        changes.append(
            ChronicleChangeOut(
                day=day, kind="tower_added", holding_id=hid, holding_name=t.name,
                text=f"{t.name} joined the fortress ({_pct(t.weight_pct)} of the realm).",
            )
        )
    for hid in sorted(before.keys() - after.keys(), key=lambda h: before[h].name):
        t = before[hid]
        changes.append(
            ChronicleChangeOut(
                day=day, kind="tower_removed", holding_id=hid, holding_name=t.name,
                text=f"{t.name} left the fortress (it held {_pct(t.weight_pct)} of the realm).",
            )
        )

    for hid in sorted(after.keys() & before.keys(), key=lambda h: after[h].name):
        a, b = before[hid], after[hid]
        if (
            a.weight_pct is not None
            and b.weight_pct is not None
            and abs(b.weight_pct - a.weight_pct) >= rules_v.resize_min_points
        ):
            changes.append(
                ChronicleChangeOut(
                    day=day, kind="tower_resized", holding_id=hid, holding_name=b.name,
                    text=f"{b.name} went from {_pct(a.weight_pct)} to {_pct(b.weight_pct)} of the realm.",
                )
            )
        if not both_stored:
            continue
        if a.wall != b.wall:
            if a.wall == "unsurveyed":
                text = f"The walls of {b.name} were surveyed: {b.wall}."
            elif b.wall == "unsurveyed":
                text = f"The walls of {b.name} can no longer be surveyed (the figures are missing)."
            else:
                text = f"The walls of {b.name} went from {a.wall} to {b.wall}."
            changes.append(
                ChronicleChangeOut(day=day, kind="wall_changed", holding_id=hid, holding_name=b.name, text=text)
            )
        if a.moat != b.moat:
            if a.moat == "unsurveyed":
                text = f"The moat of {b.name} was surveyed: {b.moat}."
            elif b.moat == "unsurveyed":
                text = f"The moat of {b.name} is no longer surveyed."
            else:
                text = f"The moat of {b.name} went from {a.moat} to {b.moat}."
            changes.append(
                ChronicleChangeOut(day=day, kind="moat_changed", holding_id=hid, holding_name=b.name, text=text)
            )
        if a.thesis != b.thesis:
            if b.thesis == "breached":
                text = f"A tripwire fired on {b.name}."
            elif a.thesis == "breached":
                text = f"The breach on {b.name} cleared ({a.thesis} to {b.thesis})."
            else:
                text = f"The thesis of {b.name} moved from {a.thesis.replace('_', ' ')} to {b.thesis.replace('_', ' ')}."
            changes.append(
                ChronicleChangeOut(day=day, kind="thesis_changed", holding_id=hid, holding_name=b.name, text=text)
            )
    return changes


def build_chronicle_from(
    stored: list[tuple[date, datetime, GameStateOut]],
    position_frames: list[ChronicleFrameOut],
    rules_v: TimeAndFilingsRules,
    *,
    demo: bool = False,
    today: date | None = None,
) -> ChronicleOut:
    """Pure assembly (tested without a database)."""
    stored_frames = [frame_from_state(day, at, state) for day, at, state in stored]
    first_stored = stored_frames[0].day if stored_frames else None
    older = [f for f in position_frames if first_stored is None or f.day < first_stored]
    frames = sorted([*older, *stored_frames], key=lambda f: f.day)

    hidden = max(len(frames) - rules_v.chronicle_max_frames, 0)
    if hidden:
        frames = frames[hidden:]

    changes: list[ChronicleChangeOut] = []
    for previous, current in pairwise(frames):
        changes.extend(diff_frames(previous, current, rules_v))

    n_stored = sum(1 for f in frames if f.source == "stored")
    n_pos = len(frames) - n_stored
    notes: list[str] = []
    if not frames:
        notes.append("Nothing to replay yet: no portfolio snapshot has been imported.")
    if n_stored == 0 and frames:
        notes.append(
            "No nightly frame has been stored yet. The worker stores one per day from now on; "
            "until then only the positions of past imports can be replayed, with unsurveyed walls."
        )
    elif n_stored == 1:
        notes.append("One nightly frame is stored so far. Walls, moats and weather can be compared from the second one.")
    if n_pos:
        notes.append(
            f"{n_pos} older frame(s) are rebuilt from portfolio imports: the towers and their sizes are real, "
            "the walls, moats and weather of those days cannot be rebuilt and are shown as unsurveyed."
        )
    gaps: list[ChronicleGapOut] = []
    if today is not None:
        for g in missing_ranges([f.day for f in stored_frames], today=today):
            span = (
                g.first_day.isoformat() if g.days == 1 else f"{g.first_day.isoformat()} to {g.last_day.isoformat()}"
            )
            gaps.append(
                ChronicleGapOut(
                    first_day=g.first_day, last_day=g.last_day, days=g.days,
                    text=f"Nothing was recorded on {span} ({g.days} day{'s' if g.days != 1 else ''}): "
                    "the worker was off. Nothing is known about those days, not even that they were calm.",
                )
            )
        if any((today - f.day).days > RETENTION_V1.daily_days for f in stored_frames):
            notes.append(
                f"Frames older than {RETENTION_V1.daily_days} days are kept one per week (up to two years) and then "
                "one per month, so a change between two of them is dated at the later frame."
            )
    if hidden:
        notes.append(f"{hidden} older frame(s) are not shown (the newest {rules_v.chronicle_max_frames} are).")
    return ChronicleOut(
        rules_version=rules_v.version,
        demo=demo,
        frames=frames,
        changes=changes,
        stored_frames=n_stored,
        positions_only_frames=n_pos,
        first_stored_day=first_stored,
        hidden_frames=hidden,
        gaps=gaps,
        notes=notes,
    )


def get_chronicle(db: Session, mapping: GameMapping, rules_v: TimeAndFilingsRules) -> ChronicleOut:
    stored = history.load_frames(db)
    first_stored = stored[0][0] if stored else None
    position_frames = gather_position_frames(db, mapping, before_day=first_stored)
    return build_chronicle_from(stored, position_frames, rules_v, today=datetime.now(timezone.utc).date())
