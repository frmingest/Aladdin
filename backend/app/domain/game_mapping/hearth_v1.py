"""v1 Hearth settings (game mode E3, 2026-10-16).

The Hearth opens when the stored weather is bad and shows, on three shelves,
what moved, what held and what changed over the last stretch of stored days,
beside your own written invalidation lines and your winter order. It is a
mirror of what is on file, not a forecast and not advice.

- Open when the newest stored frame says "gathering" or "besieged".
- Look back 30 days from that frame; older changes are the Chronicle's job.

CLAUDE.md Rule 3: once shown for real, a change is a new `hearth_v2.py`.
"""
from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class HearthRules:
    version: str
    storm_levels: tuple[str, ...]
    look_back_days: int


HEARTH_V1 = HearthRules(version="v1", storm_levels=("gathering", "besieged"), look_back_days=30)


def get_hearth_rules(version: str) -> HearthRules:
    versions = {"v1": HEARTH_V1}
    try:
        return versions[version]
    except KeyError as exc:
        raise ValueError(f"Unknown hearth version: {version!r}") from exc
