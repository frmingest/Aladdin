"""v2 rules for the 3D courtyard Standing (sprint "Standing 3: The Watch", 2026-10-31).

Same idea as v1 (no XP, nothing saved, worked out fresh on every request, can go down) with a
fourth level. Levels 1 to 3 mean exactly what they meant in `standing_v1.py`, which is not edited
(CLAUDE.md Rule 3). Level N is the highest N for which the gates 1..N all hold:
  1 Bare Ground, 2 The Survey, 3 Reasons: unchanged from v1.
  4 The Watch:   the night watch reported in within its allowed hours, and no wire on a tower that
                 stands has fired without being marked seen. Seen means "I looked", never "I agree"
                 and never "I did something". A watch that never ran, or has gone quiet, is unknown
                 and does not count: it is never read as a quiet night.

Level 4 is held, not won: it drops when the worker stops reporting in or a new wire fires.
Words are game voice: short and plain, for the player's next act.
"""
from __future__ import annotations

from app.domain.game_mapping.standing_v1 import (
    STANDING_V1,
    LevelRule,
    NamedGap,
    StandingRules,
)

# Copied, not shared, so a later edit of v1 can never change what v2 means.
_NAMED_GAPS: tuple[NamedGap, ...] = (NamedGap("JAREN.OL", "no tagged filing"),)

STANDING_V2 = StandingRules(
    version="v2",
    max_level=4,
    min_active_tripwires=1,
    levels=(
        *STANDING_V1.levels,
        LevelRule(4, "The Watch", "Keep the watch walking, and look at every wire that fires."),
    ),
    named_gaps=_NAMED_GAPS,
)
