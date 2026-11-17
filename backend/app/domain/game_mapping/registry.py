"""Version registry for the game-mapping rule files.

`get_standing_rules` and `get_siege_scenarios` used to live at the bottom of `standing_v1.py` and
`siege_scenarios_v1.py`, so every new version edited a v1 file that CLAUDE.md rule 3 says is frozen
once it has been shown or used. The registries live here instead. Adding `standing_v4` or
`siege_scenarios_v5` means adding one line to the matching table below and nothing else (#449).

The versions are imported lazily: v2 and later import v1 for the dataclasses, so loading them at
the top of this module would be a cycle for any caller that imports v1 first.
"""

from __future__ import annotations

from app.domain.game_mapping.siege_scenarios_v1 import (
    SIEGE_SCENARIOS_V1,
    SiegeScenarios,
)
from app.domain.game_mapping.standing_v1 import STANDING_V1, StandingRules


def get_standing_rules(version: str) -> StandingRules:
    from app.domain.game_mapping.standing_v2 import STANDING_V2
    from app.domain.game_mapping.standing_v3 import STANDING_V3

    versions: dict[str, StandingRules] = {
        "v1": STANDING_V1,
        "v2": STANDING_V2,
        "v3": STANDING_V3,
    }
    try:
        return versions[version]
    except KeyError as exc:
        raise ValueError(f"Unknown standing version: {version!r}") from exc


def get_siege_scenarios(version: str) -> SiegeScenarios:
    from app.domain.game_mapping.siege_scenarios_v2 import SIEGE_SCENARIOS_V2
    from app.domain.game_mapping.siege_scenarios_v3 import SIEGE_SCENARIOS_V3
    from app.domain.game_mapping.siege_scenarios_v4 import SIEGE_SCENARIOS_V4

    versions: dict[str, SiegeScenarios] = {
        "v1": SIEGE_SCENARIOS_V1,
        "v2": SIEGE_SCENARIOS_V2,
        "v3": SIEGE_SCENARIOS_V3,
        "v4": SIEGE_SCENARIOS_V4,
    }
    try:
        return versions[version]
    except KeyError as exc:
        raise ValueError(f"Unknown siege scenarios version: {version!r}") from exc
