"""v1 settings for game mode Sprint 25 rituals: Hall of Records (G18) and
per-holding advisor lines (G20), 2026-10-04.

Nothing here is a prediction or a recommendation. Circle of Competence (G19)
used to live here too (its levels and note length); that page was removed on
2026-10-19, so only the version stays. CLAUDE.md Rule 3: once shown for real, a
change is a new `rituals_v2.py`, not an edit of this file.
"""
from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class RitualsRules:
    version: str


RITUALS_V1 = RitualsRules(version="v1")

_VERSIONS: dict[str, RitualsRules] = {"v1": RITUALS_V1}


def get_rituals(version: str) -> RitualsRules:
    try:
        return _VERSIONS[version]
    except KeyError as exc:
        raise ValueError(f"Unknown rituals version: {version!r}") from exc
