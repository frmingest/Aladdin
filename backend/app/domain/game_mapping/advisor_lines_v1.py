"""v1 advisor lines (2026-10-01, G7b) — the hand-written words the two game-mode
advisors say, one template per rule.

Decision D4 (docs/game-mode-fortress-2026-10-01.md): lines are written by
hand and chosen by fixed rules (app/services/game/advisors.py); no model
writes them. They are original wording in the spirit of a patient owner-
operator (the Oracle) and a blunt "invert, always invert" sceptic (the
Partner). They are NOT quotations from Warren Buffett or Charlie Munger and
must never be presented as such.

Voice rules every line obeys (CLAUDE.md "truth over flattery"):
- State what the stored data shows, then what to look at. Never "buy", "sell",
  "add", "trim" or "you should trade": nothing here is investment advice and
  nothing executes a trade.
- A weak holding is called weak. No cheering, no streaks, no reward for acting.
- Unknown stays unknown: a missing figure is named as missing.

CLAUDE.md Rule 3: once these have been shown for real, do not edit a template
in place. Add `advisor_lines_v2.py` and bump `ADVISOR_LINES_ACTIVE`.
"""
from __future__ import annotations

from typing import Literal, NamedTuple

ADVISOR_LINES_VERSION = "v1"

AdvisorName = Literal["oracle", "partner"]
AdvisorTone = Literal["warning", "note", "calm"]


class LineTemplate(NamedTuple):
    advisor: AdvisorName
    tone: AdvisorTone
    text: str


# Placeholders are filled by app/services/game/advisors.py; every placeholder a
# template uses is listed next to it so a typo fails a test, not production.
TEMPLATES: dict[str, LineTemplate] = {
    # {name}, {count}
    "tripwire_fired": LineTemplate(
        "partner",
        "warning",
        "{name}: {count} of the conditions you wrote down as proof the thesis was wrong "
        "has fired. Read the thesis again while you are calm, before the price does the arguing for you.",
    ),
    # {name}
    "thesis_review": LineTemplate(
        "oracle",
        "note",
        "{name}: something changed since the last analysis. Find out what moved before you decide anything about it.",
    ),
    # {name}, {weight}, {wall}
    "weak_walls_big_tower": LineTemplate(
        "partner",
        "warning",
        "{name} is {weight} of the portfolio and its walls are {wall}. A big position should have "
        "the strongest balance sheet you own, not the weakest. Invert it: what would have to go wrong for this to hurt?",
    ),
    # {name}, {weight}
    "no_moat_big_tower": LineTemplate(
        "partner",
        "warning",
        "{name} is {weight} of the portfolio and the analysis found no moat. Without one, a good year "
        "invites competitors in. Be sure that is the bet you meant to make.",
    ),
    # {name}, {age}
    "stale_big_tower": LineTemplate(
        "oracle",
        "note",
        "{name}: a big tower, and the analysis is {age} days old. A conclusion that old is a memory, "
        "not a reading. Run it again before you lean on it.",
    ),
    # {level}
    "storm_vault_ready": LineTemplate(
        "oracle",
        "calm",
        "The weather is turning and the vault is {level}. This is what dry powder is for. "
        "Nothing here says you must spend it; being able to wait is the point.",
    ),
    # {level}
    "storm_vault_thin": LineTemplate(
        "partner",
        "warning",
        "The weather is turning and the vault is {level}. Ask yourself honestly whether you could sit "
        "through a worse quarter without being forced to give up a position.",
    ),
    # {shacks}
    "shantytown": LineTemplate(
        "partner",
        "note",
        "{shacks} positions are each too small to matter. A holding too small to move the result is "
        "also too small to be worth your attention. Either it earns real study or it is clutter.",
    ),
    # {names}, {correlation}, {combined}
    "shared_wall": LineTemplate(
        "partner",
        "note",
        "{names} stand on one cracked wall (correlation {correlation}, together {combined} of the portfolio). "
        "In a bad week they are likely to fall together, so count them as one bet.",
    ),
    # {name}, {zone}
    "cheap_on_strong_walls": LineTemplate(
        "oracle",
        "note",
        "{name} is priced below its {zone} with strong walls and a moat. That is a reason to study it "
        "closely, not a signal. First find out why the market is paying so little.",
    ),
    # {name}, {weight}
    "dear_big_tower": LineTemplate(
        "partner",
        "note",
        "{name} is {weight} of the portfolio and trades above its bull case. A wonderful business can "
        "still be bought at a poor price; the stored valuation assumes a lot goes right.",
    ),
    # {level}, {drains}, {decisions}
    "temperament_strained": LineTemplate(
        "partner",
        "warning",
        "The journal reads {level}: {drains} recent decisions went against your own rules, out of {decisions} logged. "
        "Read the lines on the temperament card before the next decision, not after it.",
    ),
    # {decisions}
    "temperament_composed": LineTemplate(
        "oracle",
        "calm",
        "The journal reads composed over {decisions} logged decisions. Keep writing down what would prove "
        "you wrong; that habit is what keeps this reading honest.",
    ),
    # {reason}
    "vault_unknown": LineTemplate(
        "oracle",
        "note",
        "I cannot judge your powder: {reason}. Update the vault card so the weather report means something.",
    ),
    "all_quiet": LineTemplate(
        "oracle",
        "calm",
        "No tripwire has fired and nothing in the survey asks for action. Most of the time the work "
        "is waiting, and waiting well is not the same as doing nothing.",
    ),
}
