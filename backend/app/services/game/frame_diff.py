"""What changed between two stored Fortress frames (used by the Night Watch).

A frame is one stored game-state snapshot (`history.py`, one per UTC day). The
diff is plain words about towers that joined, left or were resized, and walls,
moats, theses and weather that moved. Database-free, no provider, no LLM; a
record of what was stored, never a forecast and never advice.
"""
from __future__ import annotations

from datetime import date, datetime
from decimal import ROUND_HALF_UP, Decimal

from app.domain.game_mapping.time_and_filings_v1 import TimeAndFilingsRules
from app.schemas.game import (
    FrameChangeOut,
    FrameOut,
    FrameTowerOut,
    GameStateOut,
)


def _pct(value: Decimal | None) -> str:
    return "an unknown share" if value is None else f"{value.quantize(Decimal('0.1'), rounding=ROUND_HALF_UP)}%"


def frame_from_state(day: date, at: datetime, state: GameStateOut) -> FrameOut:
    return FrameOut(
        day=day,
        at=at,
        total_value_nok=state.total_value_nok,
        weather=state.siege.level if state.siege is not None else "unsurveyed",
        towers=[
            FrameTowerOut(
                holding_id=t.holding_id, ticker=t.ticker, name=t.name, structure=t.structure,
                size_class=t.size_class, weight_pct=t.weight_pct, wall=t.wall, moat=t.moat,
                land=t.land, thesis=t.thesis,
            )
            for t in state.towers
        ],
    )


def diff_frames(
    previous: FrameOut, current: FrameOut, rules_v: TimeAndFilingsRules
) -> list[FrameChangeOut]:
    """What differs between two consecutive stored frames, in plain words."""
    changes: list[FrameChangeOut] = []
    day = current.day

    if previous.weather != current.weather:
        changes.append(
            FrameChangeOut(
                day=day, kind="weather_changed",
                text=f"The weather turned from {previous.weather} to {current.weather}.",
            )
        )

    before = {t.holding_id: t for t in previous.towers}
    after = {t.holding_id: t for t in current.towers}

    for hid in sorted(after.keys() - before.keys(), key=lambda h: after[h].name):
        t = after[hid]
        changes.append(
            FrameChangeOut(
                day=day, kind="tower_added", holding_id=hid, holding_name=t.name,
                text=f"{t.name} joined the fortress ({_pct(t.weight_pct)} of the realm).",
            )
        )
    for hid in sorted(before.keys() - after.keys(), key=lambda h: before[h].name):
        t = before[hid]
        changes.append(
            FrameChangeOut(
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
                FrameChangeOut(
                    day=day, kind="tower_resized", holding_id=hid, holding_name=b.name,
                    text=f"{b.name} went from {_pct(a.weight_pct)} to {_pct(b.weight_pct)} of the realm.",
                )
            )
        if a.wall != b.wall:
            if a.wall == "unsurveyed":
                text = f"The walls of {b.name} were surveyed: {b.wall}."
            elif b.wall == "unsurveyed":
                text = f"The walls of {b.name} can no longer be surveyed (the figures are missing)."
            else:
                text = f"The walls of {b.name} went from {a.wall} to {b.wall}."
            changes.append(
                FrameChangeOut(day=day, kind="wall_changed", holding_id=hid, holding_name=b.name, text=text)
            )
        if a.moat != b.moat:
            if a.moat == "unsurveyed":
                text = f"The moat of {b.name} was surveyed: {b.moat}."
            elif b.moat == "unsurveyed":
                text = f"The moat of {b.name} is no longer surveyed."
            else:
                text = f"The moat of {b.name} went from {a.moat} to {b.moat}."
            changes.append(
                FrameChangeOut(day=day, kind="moat_changed", holding_id=hid, holding_name=b.name, text=text)
            )
        if a.thesis != b.thesis:
            if b.thesis == "breached":
                text = f"A tripwire fired on {b.name}."
            elif a.thesis == "breached":
                text = f"The breach on {b.name} cleared ({a.thesis} to {b.thesis})."
            else:
                text = f"The thesis of {b.name} moved from {a.thesis.replace('_', ' ')} to {b.thesis.replace('_', ' ')}."
            changes.append(
                FrameChangeOut(day=day, kind="thesis_changed", holding_id=hid, holding_name=b.name, text=text)
            )
    return changes
