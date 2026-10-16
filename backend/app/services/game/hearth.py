"""The Hearth (game mode E3, 2026-10-16). Pure composer: no database, provider,
model or clock.

When the stored weather is bad, show what moved, what held and what changed
over the look-back stretch (read off the Chronicle's own frame diffs), your own
invalidation lines beside live tripwire numbers, your winter order, and the
record of the worst stored fall. When it is calm the door is shut.

Unknown stays unknown: a day nobody stored is a gap, never "held". Held means
"present in the newest frame and untouched by any recorded change".
"""
from __future__ import annotations

from datetime import date, timedelta

from app.domain.game_mapping.hearth_v1 import HearthRules
from app.schemas.game import (
    ChronicleChangeOut,
    ChronicleOut,
    HearthInvalidationOut,
    HearthLineOut,
    HearthOut,
    HearthRecordOut,
    WinterOrderOut,
    WinterRehearsalOut,
)

CHANGED_KINDS = frozenset({"weather_changed", "wall_changed", "moat_changed", "thesis_changed", "tower_added", "tower_removed"})
MOVED_KINDS = frozenset({"tower_resized"})


def _line(c: ChronicleChangeOut) -> HearthLineOut:
    return HearthLineOut(holding_id=c.holding_id, name=c.holding_name, text=c.text, day=c.day)


def record_of(winter: WinterRehearsalOut) -> HearthRecordOut:
    if winter.status == "ok" and winter.window is not None:
        last = winter.window.points[-1]
        return HearthRecordOut(
            status="ok",
            text=(
                f"The worst stored fall was {abs(winter.window.fall * 100):.1f}% "
                f"({winter.window.peak_date} to {winter.window.trough_date}), "
                f"{last.days_under_water} trading days under water."
            ),
            worst_fall=winter.window.fall,
            fall_nok=last.change_nok,
            days_under_water=last.days_under_water,
        )
    return HearthRecordOut(status=winter.status, text=winter.status_reason, worst_fall=winter.worst_fall)


def compose_hearth(
    chronicle: ChronicleOut,
    invalidations: list[HearthInvalidationOut],
    order: WinterOrderOut,
    winter: WinterRehearsalOut,
    rules: HearthRules,
    *,
    demo: bool = False,
) -> HearthOut:
    base = HearthOut(
        version=rules.version, demo=demo, state="shut", state_reason="", order=order, record=record_of(winter),
        gaps=[g.text for g in chronicle.gaps],
    )
    stored = [f for f in chronicle.frames if f.source == "stored"]
    if not stored:
        base.state_reason = "No nightly frame is stored yet, so the weather is not known. The door stays shut."
        return base
    latest = stored[-1]
    base.weather = latest.weather
    base.as_of = latest.day
    if latest.weather not in rules.storm_levels:
        base.state_reason = (
            "The weather is unsurveyed, so the door stays shut." if latest.weather == "unsurveyed"
            else f"The weather is {latest.weather}. The Hearth opens when it is gathering or besieged."
        )
        return base

    since: date = latest.day - timedelta(days=rules.look_back_days)
    base.look_back_from = since
    window = [c for c in chronicle.changes if c.day >= since]
    base.state = "open"
    base.state_reason = f"The weather is {latest.weather}. Here is what is on file for the last {rules.look_back_days} days."
    base.changed = [_line(c) for c in window if c.kind in CHANGED_KINDS]
    base.moved = [_line(c) for c in window if c.kind in MOVED_KINDS]
    touched = {c.holding_id for c in window if c.holding_id is not None and (c.kind in CHANGED_KINDS or c.kind in MOVED_KINDS)}
    if len(stored) < 2:
        base.notes.append("Only one nightly frame is stored, so nothing can be said to have held yet.")
    else:
        base.held = [
            HearthLineOut(holding_id=t.holding_id, name=t.name, text=f"{t.name}: wall, moat, thesis and size unchanged.")
            for t in latest.towers if t.holding_id not in touched
        ]
    base.invalidations = invalidations
    return base
