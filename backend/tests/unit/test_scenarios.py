"""Unit tests for app.domain.scenarios (architecture §18, §26 Phase 5)."""

from decimal import Decimal

import pytest

from app.domain.scenarios import (
    ScenarioDefinition,
    UnknownScenarioKeyError,
    UnknownScenarioVersionError,
    estimate_scenario_impact,
    load_scenario_registry,
)


def test_load_scenario_registry_v1_has_the_eight_architecture_scenarios():
    registry = load_scenario_registry("v1")
    assert registry.version == "v1"
    expected = {
        "recession", "stagflation", "disinflation", "deflation",
        "commodity_shock", "interest_rate_shock", "geopolitical_escalation", "liquidity_crisis",
    }
    assert expected <= set(registry.scenarios)


def test_load_scenario_registry_unknown_version_raises():
    with pytest.raises(UnknownScenarioVersionError):
        load_scenario_registry("does-not-exist")


def test_registry_get_unknown_scenario_key_raises():
    registry = load_scenario_registry("v1")
    with pytest.raises(UnknownScenarioKeyError):
        registry.get("not-a-real-scenario")


def _scenario(**overrides) -> ScenarioDefinition:
    defaults = dict(
        key="test",
        label="Test Scenario",
        description="",
        context={},
        asset_class_shocks={"EQUITY": Decimal("-20")},
        sector_shocks={"gold": Decimal("15")},
        currency_shocks={"USD": Decimal("5")},
    )
    defaults.update(overrides)
    return ScenarioDefinition(**defaults)


def test_estimate_scenario_impact_all_equity_portfolio():
    impact = estimate_scenario_impact(
        _scenario(),
        asset_class_weights_pct={"EQUITY": Decimal("100")},
        sector_weights_pct={},
        currency_weights_pct={"NOK": Decimal("100")},
        reporting_currency="NOK",
    )
    assert impact.estimated_portfolio_impact_pct == Decimal("-20.0000")
    assert impact.contributions["asset_class:EQUITY"] == Decimal("-20.0000")


def test_estimate_scenario_impact_currency_shock_skipped_for_reporting_currency():
    impact = estimate_scenario_impact(
        _scenario(asset_class_shocks={}),
        asset_class_weights_pct={},
        sector_weights_pct={},
        currency_weights_pct={"USD": Decimal("100")},
        reporting_currency="USD",
    )
    # USD is the reporting currency here, so its own currency shock must not apply.
    assert impact.estimated_portfolio_impact_pct is None
    assert impact.contributions == {}


def test_estimate_scenario_impact_currency_shock_applies_for_foreign_currency():
    impact = estimate_scenario_impact(
        _scenario(asset_class_shocks={}),
        asset_class_weights_pct={},
        sector_weights_pct={},
        currency_weights_pct={"USD": Decimal("40"), "NOK": Decimal("60")},
        reporting_currency="NOK",
    )
    assert impact.estimated_portfolio_impact_pct == Decimal("2.0000")  # 40% * 5%
    assert "currency:USD" in impact.contributions
    assert "currency:NOK" not in impact.contributions


def test_estimate_scenario_impact_sector_matching_is_case_insensitive_and_tracks_unmatched():
    impact = estimate_scenario_impact(
        _scenario(asset_class_shocks={}),
        asset_class_weights_pct={},
        sector_weights_pct={"Gold": Decimal("10"), "Technology": Decimal("90")},
        currency_weights_pct={},
        reporting_currency="NOK",
    )
    assert impact.contributions["sector:Gold"] == Decimal("1.5000")  # 10% * 15%
    assert impact.unmatched_sector_weight_pct == Decimal("90.0000")


def test_estimate_scenario_impact_no_matches_returns_none_impact():
    impact = estimate_scenario_impact(
        _scenario(asset_class_shocks={}, sector_shocks={}, currency_shocks={}),
        asset_class_weights_pct={"BOND": Decimal("100")},
        sector_weights_pct={},
        currency_weights_pct={},
        reporting_currency="NOK",
    )
    assert impact.estimated_portfolio_impact_pct is None
