"""The 3D courtyard Standing (sprint "Standing 1", 2026-10-31).

Pure arithmetic over stored facts: no database, no network, no LLM (CLAUDE.md Rule 1).
The rules live in `app/domain/game_mapping/standing_v1.py`. Level N is the highest N
whose gates 1..N all hold, recomputed on every call, so it can go down. Unknown never
counts: an unsurveyed tower, a missing entry or a blank line is simply "not yet".
"""
from __future__ import annotations

import uuid
from collections.abc import Sequence
from dataclasses import dataclass

from app.domain.game_mapping.standing_v1 import StandingRules
from app.schemas.game import StandingGapOut, StandingGateOut, StandingOut, TowerOut


@dataclass(frozen=True)
class TowerFact:
    holding_id: uuid.UUID
    ticker: str
    surveyed: bool


@dataclass(frozen=True)
class JournalFact:
    holding_id: uuid.UUID | None
    thesis: str
    invalidation: str | None


@dataclass(frozen=True)
class StandingInputs:
    demo: bool
    towers: Sequence[TowerFact]
    journal: Sequence[JournalFact]
    active_tripwires: int  # active tripwires on holdings that stand as towers
    # Level 4 (standing_v2). Defaults keep v1 callers unchanged. An unknown watch is "never", never "ok".
    watch_state: str = "never"  # "ok" | "old" | "never", from the night watch
    unseen_wires: int = 0  # active wires on towers that fired and have not been marked seen


def tower_fact(t: TowerOut) -> TowerFact:
    """A tower is surveyed when its wall and its size are known. A wall that does not apply
    (a fund, bullion) has nothing to survey; an unknown size is never guessed."""
    return TowerFact(holding_id=t.holding_id, ticker=t.ticker, surveyed=t.wall != "unsurveyed" and t.size_class != "unknown")


def _blank(text: str | None) -> bool:
    return text is None or not text.strip()


def build_standing(inputs: StandingInputs, rules: StandingRules) -> StandingOut:
    towers = list(inputs.towers)
    total = len(towers)
    gap_by_ticker = {g.ticker: g for g in rules.named_gaps}
    gaps_in_force = [gap_by_ticker[t.ticker] for t in towers if t.ticker in gap_by_ticker and not t.surveyed]

    # Gate 1: a real holding stands. The sample fortress never counts.
    g1 = not inputs.demo and total >= 1

    # Gate 2: every tower is surveyed or carries a named gap.
    covered = sum(1 for t in towers if t.surveyed or t.ticker in gap_by_ticker)
    g2 = g1 and covered == total

    # Gate 3: every holding has a written reason and a "wrong if" line, and a wire is armed.
    written_ids = {
        j.holding_id
        for j in inputs.journal
        if j.holding_id is not None and not _blank(j.thesis) and not _blank(j.invalidation)
    }
    written = sum(1 for t in towers if t.holding_id in written_ids)
    g3 = g2 and written == total and inputs.active_tripwires >= rules.min_active_tripwires

    # Gate 4 (v2): the watch reported in, and every fired wire has been looked at. Unknown is not met.
    g4 = g3 and inputs.watch_state == "ok" and inputs.unseen_wires == 0

    met_by_level = {1: g1, 2: g2, 3: g3, 4: g4}
    level = 0
    for rule in rules.levels:
        if rule.level > rules.max_level or not met_by_level.get(rule.level, False):
            break
        level = rule.level

    sample = "Sample fortress, not yours"
    facts = {
        1: sample if inputs.demo else (f"{total} towers stand" if total != 1 else "1 tower stands") if total else "No holdings yet",
        2: sample if inputs.demo else f"{covered} of {total} surveyed" if total else "Nothing to survey yet",
        3: sample if inputs.demo else (
            f"{written} of {total} written up, {inputs.active_tripwires} wire{'s' if inputs.active_tripwires != 1 else ''} armed"
            if total else "Nothing to write up yet"
        ),
    }
    if inputs.demo:
        fact4 = sample
    elif not total:
        fact4 = "Nothing to watch yet"
    elif inputs.watch_state == "never":
        fact4 = "The watch has not reported. Nothing is known."
    elif inputs.watch_state == "old":
        fact4 = "The watch is not walking the walls"
    elif inputs.unseen_wires:
        fact4 = f"{inputs.unseen_wires} wire{'s' if inputs.unseen_wires != 1 else ''} fired, not yet looked at"
    else:
        fact4 = "The watch reports in. Every wire looked at"
    facts[4] = fact4
    counts: dict[int, tuple[int | None, int | None]] = {
        1: (None, None) if inputs.demo else (min(total, 1), 1),
        2: (None, None) if inputs.demo else (covered, total),
        3: (None, None) if inputs.demo else (written, total),
        4: (None, None),
    }
    gates = [
        StandingGateOut(
            level=r.level, title=r.title, met=met_by_level.get(r.level, False),
            done=counts[r.level][0], total=counts[r.level][1], fact=facts[r.level],
        )
        for r in rules.levels
        if r.level <= rules.max_level
    ]

    held = next((r for r in rules.levels if r.level == level), None)
    nxt = next((r for r in rules.levels if r.level == level + 1 and r.level <= rules.max_level), None)
    return StandingOut(
        version=rules.version,
        demo=inputs.demo,
        level=level,
        max_level=rules.max_level,
        title=held.title if held else None,
        next_step=nxt.goal if nxt else None,
        gates=gates,
        gaps=[StandingGapOut(ticker=g.ticker, label=g.label) for g in gaps_in_force],
    )
