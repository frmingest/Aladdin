"""v3 rules for the 3D courtyard Standing (sprint "Standing 4: The Ledger", 2026-11-01).

Same idea as v1 and v2 (no XP, nothing saved, worked out fresh on every request, can go down) with a
fifth and last level. Levels 1 to 4 mean exactly what they meant in `standing_v2.py`, which is not
edited (CLAUDE.md Rule 3). Level N is the highest N for which the gates 1..N all hold:
  1 Bare Ground, 2 The Survey, 3 Reasons, 4 The Watch: unchanged from v2.
  5 The Ledger:  no 6- or 12-month look-back is due and unwritten in the decision journal, and at
                 least `min_look_backs` entries have a look-back written. "Due" is the journal's own
                 flag (old enough, no review text yet); the day counts are copied here so this file
                 says in one place what the level means, and a test keeps them equal to the journal's.

Level 5 is held, not won: it drops the day a look-back falls due. It cannot be reached in a weekend,
because the first look-back only opens 182 days after an entry was written. That is the point.
Every journal entry counts, also one on a holding since sold: the decision was still yours.
Words are game voice: short and plain, for the player's next act.
"""
from __future__ import annotations

from dataclasses import dataclass

from app.domain.game_mapping.standing_v1 import LevelRule, NamedGap, StandingRules
from app.domain.game_mapping.standing_v2 import STANDING_V2


@dataclass(frozen=True)
class LedgerRules(StandingRules):
    """StandingRules plus the level 5 numbers. Defaults are never used; v3 sets every field."""

    min_look_backs: int = 1
    look_back_days: int = 182  # the 6-month look-back opens this many days after the entry
    second_look_back_days: int = 365


# Copied, not shared, so a later edit of v2 can never change what v3 means.
_NAMED_GAPS: tuple[NamedGap, ...] = (NamedGap("JAREN.OL", "no tagged filing"),)

STANDING_V3 = LedgerRules(
    version="v3",
    max_level=5,
    min_active_tripwires=1,
    levels=(
        *STANDING_V2.levels,
        LevelRule(5, "The Ledger", "Look back: when an entry turns six months, write what really happened."),
    ),
    named_gaps=_NAMED_GAPS,
    min_look_backs=1,
    look_back_days=182,
    second_look_back_days=365,
)
