"""v1 settings for game mode Sprint 25: Hall of Records
(G18), Circle of Competence (G19) and per-holding advisor lines (G20),
2026-10-04.

Nothing here is a prediction or a recommendation. These values decide only which
levels a competence mark may take. CLAUDE.md Rule 3: once shown for real, a change is a new
`rituals_v2.py`, not an edit of this file.

Why these values:
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

@dataclass(frozen=True)
class RitualsRules:
    version: str
    competence_levels: tuple[str, ...]
    competence_note_max_chars: int


RITUALS_V1 = RitualsRules(
    version="v1",
    competence_levels=COMPETENCE_LEVELS,
    competence_note_max_chars=500,
)

_VERSIONS: dict[str, RitualsRules] = {"v1": RITUALS_V1}


def get_rituals(version: str) -> RitualsRules:
    try:
        return _VERSIONS[version]
    except KeyError as exc:
        raise ValueError(f"Unknown rituals version: {version!r}") from exc
