"""The version registries live in registry.py, not in the frozen v1 rule files (#449)."""

from __future__ import annotations

import pytest

from app.domain.game_mapping import registry, siege_scenarios_v1, standing_v1


def test_v1_files_no_longer_hold_a_registry() -> None:
    # A new version must never need an edit to a v1 file (CLAUDE.md rule 3).
    assert not hasattr(standing_v1, "get_standing_rules")
    assert not hasattr(siege_scenarios_v1, "get_siege_scenarios")


def test_registry_resolves_every_known_version() -> None:
    assert registry.get_standing_rules("v1") is standing_v1.STANDING_V1
    assert registry.get_siege_scenarios("v1") is siege_scenarios_v1.SIEGE_SCENARIOS_V1
    assert registry.get_standing_rules("v3").version == "v3"
    assert registry.get_siege_scenarios("v4").version == "v4"


def test_registry_rejects_unknown_versions() -> None:
    with pytest.raises(ValueError, match="Unknown standing version"):
        registry.get_standing_rules("v99")
    with pytest.raises(ValueError, match="Unknown siege scenarios version"):
        registry.get_siege_scenarios("v9")
