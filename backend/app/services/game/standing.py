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
from app.domain.game_mapping.standing_v3 import LedgerRules
from app.schemas.game import (
    StandingGapOut,
    StandingGateOut,
    StandingOut,
    StandingWireOut,
    TowerOut,
)


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
    # Level 5 (standing_v3). Defaults keep v1 and v2 callers unchanged.
    days_since: int = 0  # days since the decision, as the journal counts them
    looked_back: bool = False  # a 6- or 12-month look-back is written
    look_back_due: bool = False  # the journal's own flag: old enough and a look-back still unwritten


@dataclass(frozen=True)
class StandingInputs:
    demo: bool
    towers: Sequence[TowerFact]
    journal: Sequence[JournalFact]
    active_tripwires: int  # active tripwires on holdings that stand as towers
    # Level 4 (standing_v2). Defaults keep v1 callers unchanged. An unknown watch is "never", never "ok".
    watch_state: str = "never"  # "ok" | "old" | "never", from the night watch
    unseen_wires: int = 0  # active wires on towers that fired and have not been marked seen
    wire_list: Sequence[StandingWireOut] = ()  # the same wires by name, for the Quest log (T2)


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

    # Gate 5 (v3): no look-back is due and unwritten, and enough look-backs are written to show it.
    # Every entry counts, also one on a holding since sold. Only rules that know level 5 can light it.
    ledger = rules if isinstance(rules, LedgerRules) else None
    due = sum(1 for j in inputs.journal if j.look_back_due)
    looked = sum(1 for j in inputs.journal if j.looked_back)
    g5 = g4 and ledger is not None and due == 0 and looked >= ledger.min_look_backs

    met_by_level = {1: g1, 2: g2, 3: g3, 4: g4, 5: g5}
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
    facts[5] = _ledger_fact(inputs, ledger, due, looked) if ledger is not None else ""
    counts: dict[int, tuple[int | None, int | None]] = {
        1: (None, None) if inputs.demo else (min(total, 1), 1),
        2: (None, None) if inputs.demo else (covered, total),
        3: (None, None) if inputs.demo else (written, total),
        4: (None, None),
        5: (None, None) if inputs.demo or not (due or looked) else (looked, looked + due),
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
        wires=[] if inputs.demo else list(inputs.wire_list),
    )


def _plural(n: int, word: str) -> str:
    return f"{n} {word}{'s' if n != 1 else ''}"


def _ledger_fact(inputs: StandingInputs, rules: LedgerRules, due: int, looked: int) -> str:
    """The level 5 line in game voice. Numbers are exact; an empty or young journal is said plainly."""
    if inputs.demo:
        return "Sample fortress, not yours"
    entries = list(inputs.journal)
    if not entries:
        return "No journal entries yet. Nothing to look back on"
    if due:
        return f"{_plural(due, 'look-back')} due"
    if looked >= rules.min_look_backs:
        return f"{_plural(looked, 'look-back')} written, none due"
    oldest = max(j.days_since for j in entries)
    wait = max(rules.look_back_days - oldest, 0)
    if wait == 0:
        # Old enough but neither due nor written: the journal holds no flag for it. Say so, never guess.
        return "No look-back written yet"
    return f"Too soon to look back: the first opens in {_plural(wait, 'day')}"

