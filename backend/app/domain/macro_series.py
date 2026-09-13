"""
Macro series registry (architecture §9.1, §13.1-style versioned config,
§26 Phase 4). Loaded from research/versions/{version}.yaml (see
app.config.paths.RESEARCH_DIR).

This is the config that resolves the §29 "research provider" open question
for *numeric* central-bank/macro data: which vendor (FRED vs. Norges Bank)
owns which canonical series_key, and that vendor's own series identifier.
app.providers.composite_macro_provider reads it to route a series_key to the
right child MacroDataProvider, so the routing itself is data, not an
if/elif chain that grows every time a series is added (§28 rule 8).

Mirrors app.domain.scoring's load pattern deliberately — same versioning
discipline (§2.4), same "never edit a shipped version in place" rule.
"""

from dataclasses import dataclass
from functools import lru_cache

import yaml

from app.config.paths import RESEARCH_DIR


class UnknownMacroSeriesVersionError(Exception):
    def __init__(self, version: str):
        self.version = version
        super().__init__(f"macro series version '{version}' has no config file under research/versions/")


class UnknownMacroSeriesKeyError(Exception):
    def __init__(self, series_key: str, version: str):
        self.series_key = series_key
        self.version = version
        super().__init__(f"'{series_key}' is not a registered series in macro series version '{version}'")


@dataclass(frozen=True)
class FredSeriesDefinition:
    series_key: str
    provider_series_id: str
    fred_units: str
    description: str
    unit: str
    region: str


@dataclass(frozen=True)
class NorgesBankSeriesDefinition:
    series_key: str
    dataset: str
    key: str
    description: str
    unit: str
    region: str


SeriesDefinition = FredSeriesDefinition | NorgesBankSeriesDefinition


@dataclass(frozen=True)
class MacroSeriesRegistry:
    version: str
    series: dict[str, SeriesDefinition]

    def get(self, series_key: str) -> SeriesDefinition:
        definition = self.series.get(series_key)
        if definition is None:
            raise UnknownMacroSeriesKeyError(series_key, self.version)
        return definition

    def keys_for_provider(self, provider: str) -> list[str]:
        return [key for key, definition in self.series.items() if _provider_of(definition) == provider]


def _provider_of(definition: SeriesDefinition) -> str:
    return "fred" if isinstance(definition, FredSeriesDefinition) else "norges_bank"


@lru_cache
def load_macro_series_registry(version: str) -> MacroSeriesRegistry:
    path = RESEARCH_DIR / f"{version}.yaml"
    if not path.exists():
        raise UnknownMacroSeriesVersionError(version)
    raw = yaml.safe_load(path.read_text(encoding="utf-8"))

    series: dict[str, SeriesDefinition] = {}
    for series_key, entry in raw["series"].items():
        provider = entry["provider"]
        if provider == "fred":
            series[series_key] = FredSeriesDefinition(
                series_key=series_key,
                provider_series_id=entry["provider_series_id"],
                fred_units=entry.get("fred_units", "lin"),
                description=entry.get("description", ""),
                unit=entry["unit"],
                region=entry["region"],
            )
        elif provider == "norges_bank":
            series[series_key] = NorgesBankSeriesDefinition(
                series_key=series_key,
                dataset=entry["dataset"],
                key=entry["key"],
                description=entry.get("description", ""),
                unit=entry["unit"],
                region=entry["region"],
            )
        else:
            raise ValueError(
                f"macro series '{series_key}' in version '{version}' has unknown provider '{provider}'"
            )

    return MacroSeriesRegistry(version=raw["version"], series=series)
