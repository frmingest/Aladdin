"""Versioned game-mapping thresholds (game mode, 2026-10-01).

CLAUDE.md Rule 3 applies: these numbers change what Faiz sees about his
real holdings, so a change is a new `vN.py` plus a bump of
Settings.active_game_mapping_version, never an edit of a version already
shown.
"""
from __future__ import annotations

from app.domain.game_mapping.v1 import GAME_MAPPING_V1
from app.domain.game_mapping.value_types import GameMapping

_VERSIONS: dict[str, GameMapping] = {"v1": GAME_MAPPING_V1}


def get_game_mapping(version: str) -> GameMapping:
    try:
        return _VERSIONS[version]
    except KeyError as exc:
        raise ValueError(f"Unknown game mapping version: {version!r}") from exc
