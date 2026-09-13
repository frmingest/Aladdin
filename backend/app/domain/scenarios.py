"""
Macro/stress scenario registry and impact estimation (architecture §18,
§26 Phase 5). Mirrors app.domain.macro_series's load pattern deliberately —
a scenario's shocks are versioned YAML data
(scenarios/versions/{version}.yaml, app.config.paths.SCENARIOS_DIR), not an
if/elif chain in application code (§28 rule 8), with the same "never edit a
shipped version in place" discipline as scoring/macro-series versions (§2.4).

Scenario impact is estimated by applying each shock additively to the
portfolio's already-computed exposure weights (concentration_json's
asset_class/sector/currency weights — app.domain.portfolio_risk /
app.services.market_data.valuation). This is a real methodological
simplification, stated rather than hidden (§21): a holding that matches
both an asset-class shock and a sector shock (e.g. an equity in the energy
sector) gets both applied additively, which can double-count the same
economic exposure rather than picking the more specific one. Good enough
for a directional "what happens to my portfolio" estimate; not a factor
model.
"""

from dataclasses import dataclass, field
from decimal import Decimal
from functools import lru_cache

import yaml

from app.config.paths import SCENARIOS_DIR
from app.domain.calculations import PERCENT_PLACES, quantize


class UnknownScenarioVersionError(Exception):
    def __init__(self, version: str):
        self.version = version
        super().__init__(f"scenario version '{version}' has no config file under scenarios/versions/")


class UnknownScenarioKeyError(Exception):
    def __init__(self, scenario_key: str, version: str):
        self.scenario_key = scenario_key
        self.version = version
        super().__init__(f"'{scenario_key}' is not a registered scenario in scenario version '{version}'")


@dataclass(frozen=True)
class ScenarioDefinition:
    key: str
    label: str
    description: str
    # Macro context shown alongside the estimate (e.g. rates_bp, oil_pct) —
    # informational only, not mechanically applied to portfolio impact
    # (there is no per-holding rate-sensitivity or oil-beta model yet).
    context: dict[str, Decimal]
    asset_class_shocks: dict[str, Decimal]  # canonical AssetClass value -> % move
    sector_shocks: dict[str, Decimal]  # lowercased sector substring -> % move
    currency_shocks: dict[str, Decimal]  # ISO currency code -> % move vs. reporting currency


@dataclass(frozen=True)
class ScenarioRegistry:
    version: str
    scenarios: dict[str, ScenarioDefinition]

    def get(self, scenario_key: str) -> ScenarioDefinition:
        definition = self.scenarios.get(scenario_key)
        if definition is None:
            raise UnknownScenarioKeyError(scenario_key, self.version)
        return definition


@lru_cache
def load_scenario_registry(version: str) -> ScenarioRegistry:
    path = SCENARIOS_DIR / f"{version}.yaml"
    if not path.exists():
        raise UnknownScenarioVersionError(version)
    raw = yaml.safe_load(path.read_text(encoding="utf-8"))

    scenarios: dict[str, ScenarioDefinition] = {}
    for key, entry in raw["scenarios"].items():
        shocks = entry.get("shocks", {})
        scenarios[key] = ScenarioDefinition(
            key=key,
            label=entry.get("label", key),
            description=entry.get("description", ""),
            context={k: Decimal(str(v)) for k, v in entry.get("context", {}).items()},
            asset_class_shocks={k: Decimal(str(v)) for k, v in shocks.get("asset_class", {}).items()},
            sector_shocks={k.lower(): Decimal(str(v)) for k, v in shocks.get("sector", {}).items()},
            currency_shocks={k.upper(): Decimal(str(v)) for k, v in shocks.get("currency", {}).items()},
        )
    return ScenarioRegistry(version=raw["version"], scenarios=scenarios)


@dataclass(frozen=True)
class ScenarioImpact:
    scenario_key: str
    label: str
    context: dict[str, Decimal]
    estimated_portfolio_impact_pct: Decimal | None
    contributions: dict[str, Decimal] = field(default_factory=dict)
    unmatched_sector_weight_pct: Decimal = Decimal("0")


def estimate_scenario_impact(
    scenario: ScenarioDefinition,
    *,
    asset_class_weights_pct: dict[str, Decimal],
    sector_weights_pct: dict[str, Decimal],
    currency_weights_pct: dict[str, Decimal],
    reporting_currency: str,
) -> ScenarioImpact:
    """Deterministic, additive: sum(weight_pct/100 * shock_pct) over every
    exposure dimension that matches a shock in this scenario. A weight with
    no matching shock (e.g. a sector this scenario doesn't mention)
    contributes nothing — silence there means "this scenario has no view on
    that exposure", not "it's unaffected" (§21), which is why
    `unmatched_sector_weight_pct` is surfaced separately rather than folded
    silently into a false sense of completeness."""
    contributions: dict[str, Decimal] = {}
    total = Decimal("0")

    for asset_class, weight in asset_class_weights_pct.items():
        shock = scenario.asset_class_shocks.get(asset_class)
        if shock is None:
            continue
        contribution = weight / Decimal("100") * shock
        contributions[f"asset_class:{asset_class}"] = quantize(contribution, PERCENT_PLACES)
        total += contribution

    matched_sector_weight = Decimal("0")
    total_sector_weight = sum(sector_weights_pct.values(), Decimal("0"))
    for sector, weight in sector_weights_pct.items():
        shock = scenario.sector_shocks.get((sector or "").lower())
        if shock is None:
            continue
        matched_sector_weight += weight
        contribution = weight / Decimal("100") * shock
        contributions[f"sector:{sector}"] = quantize(contribution, PERCENT_PLACES)
        total += contribution
    unmatched_sector_weight_pct = quantize(total_sector_weight - matched_sector_weight, PERCENT_PLACES)

    for currency, weight in currency_weights_pct.items():
        if currency.upper() == reporting_currency.upper():
            continue  # no FX translation effect on exposure already in the reporting currency
        shock = scenario.currency_shocks.get(currency.upper())
        if shock is None:
            continue
        contribution = weight / Decimal("100") * shock
        contributions[f"currency:{currency}"] = quantize(contribution, PERCENT_PLACES)
        total += contribution

    return ScenarioImpact(
        scenario_key=scenario.key,
        label=scenario.label,
        context=scenario.context,
        estimated_portfolio_impact_pct=quantize(total, PERCENT_PLACES) if contributions else None,
        contributions=contributions,
        unmatched_sector_weight_pct=unmatched_sector_weight_pct or Decimal("0"),
    )
