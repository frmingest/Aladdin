"""v1 settings for game mode Sprint 25: Council Chamber (G17), Hall of Records
(G18), Circle of Competence (G19) and per-holding advisor lines (G20),
2026-10-04.

Nothing here is a prediction or a recommendation. These values decide only how
many agenda items are listed per kind and which levels a competence mark may
take. CLAUDE.md Rule 3: once shown for real, a change is a new
`rituals_v2.py`, not an edit of this file.

Why these values:
- Council: at most 4 holdings are named per agenda kind (the rest are counted),
  so a long portfolio cannot bury the short list. The order of kinds is fixed
  and is the order of urgency a sceptical owner would use: a fired tripwire
  first, a missing cash figure last.
- Competence: Munger's circle has an inside, an edge and an outside. The
  levels are `know`, `partly` and `outside`. Only the user sets them; the app
  never infers one. A sector without a mark is *unmarked*, which is not the
  same as inside.
"""
from __future__ import annotations

from dataclasses import dataclass
from typing import Literal

CompetenceLevel = Literal["know", "partly", "outside"]

COMPETENCE_LEVELS: tuple[CompetenceLevel, ...] = ("know", "partly", "outside")

# Fixed order of the Council's agenda: the first kind is raised first.
AGENDA_ORDER: tuple[str, ...] = (
    "tripwire",
    "thesis_review",
    "review_due",
    "weak_walls",
    "no_moat",
    "stale_analysis",
    "outside_circle",
    "cash",
)


@dataclass(frozen=True)
class RitualsRules:
    version: str
    council_max_names_per_item: int
    agenda_order: tuple[str, ...]
    competence_levels: tuple[str, ...]
    competence_note_max_chars: int


RITUALS_V1 = RitualsRules(
    version="v1",
    council_max_names_per_item=4,
    agenda_order=AGENDA_ORDER,
    competence_levels=COMPETENCE_LEVELS,
    competence_note_max_chars=500,
)

_VERSIONS: dict[str, RitualsRules] = {"v1": RITUALS_V1}


def get_rituals(version: str) -> RitualsRules:
    try:
        return _VERSIONS[version]
    except KeyError as exc:
        raise ValueError(f"Unknown rituals version: {version!r}") from exc
