"""v1 rules for the 3D courtyard Standing (sprint "Standing 1", 2026-10-31).

The Standing is a level from 1 to `max_level` worked out fresh on every request from
stored facts. No XP, no counter, nothing saved: lose a gate (an analysis goes stale, a
wire is switched off) and the level drops. It is never a verdict on a holding. A change
to what a level means is a new `standing_v2.py`, not an edit of this file (CLAUDE.md Rule 3).

Level N is the highest N for which the gates 1..N all hold:
  1 Bare Ground: at least one real holding stands (the sample fortress does not count).
  2 The Survey:  every tower is surveyed (wall and size known, or nothing to survey) or
                 carries a named gap, an honest "this cannot be surveyed yet".
  3 Reasons:     every holding has a written reason and a "wrong if" line in the journal,
                 and at least `min_active_tripwires` tripwire is armed.

Levels 4 (The Watch) and 5 (The Ledger) are planned and not built, so `max_level` is 3.
The wording here is game voice: short and plain, for the player's next act.
"""
from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class LevelRule:
    level: int
    title: str
    goal: str  # the next thing to do when this gate is the first one not met


@dataclass(frozen=True)
class NamedGap:
    ticker: str
    label: str  # short, shown on the tower as a small mist tag


@dataclass(frozen=True)
class StandingRules:
    version: str
    max_level: int
    min_active_tripwires: int
    levels: tuple[LevelRule, ...]
    # Towers that honestly cannot be surveyed yet. A gap is only a label: the tower stays
    # fog, and the gap goes away the day real figures exist (the entry is then removed here).
    named_gaps: tuple[NamedGap, ...]


STANDING_V1 = StandingRules(
    version="v1",
    max_level=3,
    min_active_tripwires=1,
    levels=(
        LevelRule(1, "Bare Ground", "Bring in your holdings."),
        LevelRule(2, "The Survey", "Lift the fog: fetch reports, queue the analysis."),
        LevelRule(3, "Reasons", "Write why you own each one, and what would prove you wrong. Arm a wire."),
    ),
    # Jæren Sparebank: every Newsweb filing carries no XBRL tags (Faiz, 2026-10-31: allowed as
    # the first named gap). Remove this line once its tagged report or a statement CSV is stored.
    named_gaps=(NamedGap("JAREN.OL", "no tagged filing"),),
)

def get_standing_rules(version: str) -> StandingRules:
    # Later versions import this module for the dataclasses, so they are loaded lazily here.
    from app.domain.game_mapping.standing_v2 import STANDING_V2
    from app.domain.game_mapping.standing_v3 import STANDING_V3

    versions: dict[str, StandingRules] = {"v1": STANDING_V1, "v2": STANDING_V2, "v3": STANDING_V3}
    try:
        return versions[version]
    except KeyError as exc:
        raise ValueError(f"Unknown standing version: {version!r}") from exc
