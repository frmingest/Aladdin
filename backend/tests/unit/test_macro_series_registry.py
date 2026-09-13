"""
Unit tests for app.domain.macro_series — the versioned registry that routes
series_key -> vendor (§26 Phase 4). Exercises the real research/versions/v1.yaml
shipped with the repo, plus error paths against a temp override.
"""

import pytest

from app.domain.macro_series import (
    FredSeriesDefinition,
    MacroSeriesRegistry,
    NorgesBankSeriesDefinition,
    UnknownMacroSeriesKeyError,
    UnknownMacroSeriesVersionError,
    load_macro_series_registry,
)


def test_v1_registry_loads_and_routes_known_series():
    load_macro_series_registry.cache_clear()
    registry = load_macro_series_registry("v1")

    us_rate = registry.get("us_policy_rate")
    assert isinstance(us_rate, FredSeriesDefinition)
    assert us_rate.provider_series_id == "DFF"
    assert us_rate.region == "US"

    no_rate = registry.get("no_policy_rate")
    assert isinstance(no_rate, NorgesBankSeriesDefinition)
    assert no_rate.dataset == "IR"
    assert no_rate.region == "NO"


def test_keys_for_provider_splits_by_vendor():
    load_macro_series_registry.cache_clear()
    registry = load_macro_series_registry("v1")

    fred_keys = registry.keys_for_provider("fred")
    norges_keys = registry.keys_for_provider("norges_bank")

    assert "us_policy_rate" in fred_keys
    assert "no_policy_rate" not in fred_keys
    assert norges_keys == ["no_policy_rate"]


def test_get_unknown_series_key_raises():
    load_macro_series_registry.cache_clear()
    registry = load_macro_series_registry("v1")

    with pytest.raises(UnknownMacroSeriesKeyError):
        registry.get("does_not_exist")


def test_unknown_version_raises():
    load_macro_series_registry.cache_clear()
    with pytest.raises(UnknownMacroSeriesVersionError):
        load_macro_series_registry("v999_does_not_exist")


def test_unknown_provider_in_yaml_raises_value_error(tmp_path, monkeypatch):
    from app.config import paths as paths_module

    bad_yaml = tmp_path / "vbad.yaml"
    bad_yaml.write_text(
        "version: vbad\nseries:\n  x:\n    provider: not_a_real_vendor\n    unit: percent\n    region: US\n"
    )
    monkeypatch.setattr(paths_module, "RESEARCH_DIR", tmp_path)
    import app.domain.macro_series as macro_series_module

    monkeypatch.setattr(macro_series_module, "RESEARCH_DIR", tmp_path)
    load_macro_series_registry.cache_clear()

    with pytest.raises(ValueError, match="unknown provider"):
        load_macro_series_registry("vbad")

    load_macro_series_registry.cache_clear()


def test_registry_is_frozen_dataclass():
    registry = MacroSeriesRegistry(version="test", series={})
    with pytest.raises(Exception):
        registry.version = "changed"  # type: ignore[misc]
