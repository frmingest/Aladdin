"""G16 Night Watch (Sprint 24, 2026-10-04): the nightly tripwire check as a
morning dispatch.

Reads what the worker stored overnight and says it in a few fixed lines:
whether the watch reported in, which tripwires fired, what changed between the
two newest stored fortress frames, and which reports landed. It never runs a
check, never calls a provider or a model, and never says buy, sell, add or
trim. "Quiet" is only said when the watch actually reported in and nothing is
firing: a watch that never ran is "unknown", never "quiet".
"""
from __future__ import annotations

from datetime import datetime, timedelta, timezone

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.domain.game_mapping.time_and_filings_v1 import TimeAndFilingsRules
from app.models.holding import Holding
from app.models.thesis import ThesisTripwire
from app.schemas.game import (
    ChronicleChangeOut,
    NightWatchFiredOut,
    NightWatchLineOut,
    NightWatchOut,
)
from app.services import snapshot_refresh
from app.services.game import chronicle, history
from app.services.thesis import nightly

MAX_FIRED_LINES = 5
MAX_CHANGE_LINES = 4


def _group_names(names: list[str], limit: int = 4) -> str:
    """One entry per holding, with a count when it repeats ("Subsea 7 S.A ×80"), so a burst of reports on
    one company reads as one item instead of the same name over and over. Order is first seen."""
    counts: dict[str, int] = {}
    for name in names:
        counts[name] = counts.get(name, 0) + 1
    items = [f"{name} ×{n}" if n > 1 else name for name, n in counts.items()]
    shown = ", ".join(items[:limit])
    return shown + (f" and {len(items) - limit} more" if len(items) > limit else "")


def _aware(value: datetime) -> datetime:
    return value if value.tzinfo is not None else value.replace(tzinfo=timezone.utc)


def _hours(now: datetime, then: datetime | None) -> int | None:
    return None if then is None else max(int((now - then).total_seconds() // 3600), 0)


def build_night_watch(
    *,
    rules_v: TimeAndFilingsRules,
    now: datetime,
    watch_last_at: datetime | None,
    watch_summary: str | None,
    snapshots_last_at: datetime | None,
    snapshots_summary: str | None,
    firing: list[NightWatchFiredOut],
    frame_days: list,
    changes: list[ChronicleChangeOut],
    ravens_landed: list[str],
    demo: bool = False,
) -> NightWatchOut:
    """Pure assembly from stored facts (tested without a database)."""
    now = _aware(now)
    age = _hours(now, watch_last_at)
    if watch_last_at is None:
        state = "never"
    elif age is not None and age > rules_v.watch_old_hours:
        state = "old"
    else:
        state = "ok"

    cutoff = now - timedelta(hours=rules_v.overnight_hours)
    overnight = sorted((f for f in firing if _aware(f.fired_at) >= cutoff), key=lambda f: (f.name, f.fired_at))
    still = [f for f in firing if f not in overnight]
    still_towers = len({f.holding_id for f in still})

    lines: list[NightWatchLineOut] = []
    if state == "never":
        lines.append(
            NightWatchLineOut(
                tone="warning",
                text=(
                    "The watch has never walked the walls: the nightly tripwire check has not run. "
                    "Start the PC worker; it runs the check once a day."
                ),
            )
        )
    elif state == "old":
        lines.append(
            NightWatchLineOut(
                tone="warning",
                text=(
                    f"The watch last reported {age} hours ago, which is longer than a night. "
                    "The worker may be off, so nothing below is fresh."
                ),
                facts=[watch_summary] if watch_summary else [],
            )
        )
    else:
        lines.append(
            NightWatchLineOut(
                tone="note" if overnight else "calm",
                text=f"The watch walked the walls {age} hours ago.",
                facts=[watch_summary] if watch_summary else [],
            )
        )

    for fired in overnight[:MAX_FIRED_LINES]:
        what = fired.label or fired.metric
        lines.append(
            NightWatchLineOut(
                tone="warning",
                text=f"A tripwire fired on {fired.name}: {what}.",
                holding_id=fired.holding_id,
                holding_name=fired.name,
                facts=[f"fired at {_aware(fired.fired_at).strftime('%Y-%m-%d %H:%M')} UTC"],
            )
        )
    if len(overnight) > MAX_FIRED_LINES:
        lines.append(
            NightWatchLineOut(tone="warning", text=f"{len(overnight) - MAX_FIRED_LINES} more tripwires fired overnight.")
        )
    if still:
        lines.append(
            NightWatchLineOut(
                tone="note",
                text=f"{len(still)} earlier tripwire(s) are still firing on {still_towers} tower(s).",
            )
        )

    for change in changes[:MAX_CHANGE_LINES]:
        lines.append(
            NightWatchLineOut(
                tone="note", text=change.text, holding_id=change.holding_id, holding_name=change.holding_name,
                facts=[f"between the two newest stored frames, up to {change.day.isoformat()}"],
            )
        )
    if len(changes) > MAX_CHANGE_LINES:
        lines.append(
            NightWatchLineOut(
                tone="note", text=f"{len(changes) - MAX_CHANGE_LINES} more change(s) are in the Chronicle."
            )
        )

    if ravens_landed:
        shown = _group_names(ravens_landed)
        lines.append(NightWatchLineOut(tone="note", text=f"{len(ravens_landed)} new report(s) landed overnight: {shown}."))

    if not frame_days:
        lines.append(
            NightWatchLineOut(
                tone="note",
                text="No fortress frame has been stored yet, so the dispatch cannot say what changed. The worker stores one a day.",
            )
        )
    elif len(frame_days) == 1:
        lines.append(
            NightWatchLineOut(tone="note", text="One fortress frame is stored; changes show from the second one.")
        )

    if state == "ok" and not firing and not changes and not ravens_landed:
        lines.append(NightWatchLineOut(tone="calm", text="Nothing fired, nothing is firing, and nothing changed overnight."))

    if firing:
        status = "attention"
        headline = (
            f"{len(overnight)} tripwire(s) fired overnight." if overnight else f"{len(firing)} tripwire(s) are firing."
        )
    elif state != "ok":
        status = "unknown"
        headline = "The watch has not reported in, so quiet cannot be claimed."
    else:
        status = "quiet"
        headline = "A quiet night: nothing is firing."

    order = {"warning": 0, "note": 1, "calm": 2}
    lines.sort(key=lambda line: order[line.tone])
    return NightWatchOut(
        rules_version=rules_v.version,
        demo=demo,
        as_of=now,
        status=status,
        headline=headline,
        watch_state=state,
        watch_last_at=watch_last_at,
        watch_age_hours=age,
        watch_summary=watch_summary,
        tripwires_firing=len(firing),
        fired_overnight=overnight,
        snapshots_last_at=snapshots_last_at,
        snapshots_summary=snapshots_summary,
        frames_stored=len(frame_days),
        last_frame_day=frame_days[-1] if frame_days else None,
        ravens_landed=len(ravens_landed),
        changes_since_last_frame=changes,
        lines=lines,
    )


def get_night_watch(db: Session, rules_v: TimeAndFilingsRules, *, now: datetime | None = None) -> NightWatchOut:
    from app.services.game.ravens import build_ravens

    now = _aware(now or datetime.now(timezone.utc))
    watch_at, watch_summary = nightly.last_check(db)
    snap_at, snap_summary = snapshot_refresh.last_run(db)

    rows = db.execute(
        select(ThesisTripwire, Holding)
        .join(Holding, Holding.id == ThesisTripwire.holding_id)
        .where(ThesisTripwire.active.is_(True), ThesisTripwire.fired_at.is_not(None))
    ).all()
    firing = [
        NightWatchFiredOut(
            holding_id=h.id, ticker=h.ticker, name=h.name, label=t.label, metric=t.metric, fired_at=_aware(t.fired_at)
        )
        for t, h in rows
    ]

    days = history.stored_days(db)
    changes: list[ChronicleChangeOut] = []
    if len(days) >= 2:
        before = history.load_frame(db, days[-2])
        after = history.load_frame(db, days[-1])
        if before is not None and after is not None:
            changes = chronicle.diff_frames(
                chronicle.frame_from_state(days[-2], before[0], before[1]),
                chronicle.frame_from_state(days[-1], after[0], after[1]),
                rules_v,
            )

    cutoff = now - timedelta(hours=rules_v.overnight_hours)
    landed = [r.name for r in build_ravens(db, rules_v, now=now).ravens if r.captured_at >= cutoff]
    return build_night_watch(
        rules_v=rules_v, now=now, watch_last_at=watch_at, watch_summary=watch_summary,
        snapshots_last_at=snap_at, snapshots_summary=snap_summary, firing=firing,
        frame_days=days, changes=changes, ravens_landed=landed,
    )
