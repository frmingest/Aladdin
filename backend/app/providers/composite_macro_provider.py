"""
Routes a MacroDataProvider call to whichever vendor provider owns that
series_key, per the registry (architecture §9.1, §26 Phase 4).

This is the "hybrid" resolution of the §29 open question Faiz picked: FRED
as the primary source, Norges Bank for NOK-specific series it doesn't carry.
Application/service code depends only on MacroDataProvider (§3, §28 rule 8)
— it never knows or cares that two vendors are involved, and adding a third
vendor later means a new child provider plus registry entries here, not a
change to any caller.
"""

from datetime import datetime

from app.domain.macro_series import FredSeriesDefinition, MacroSeriesRegistry, UnknownMacroSeriesKeyError
from app.providers.base import MacroDataProvider, MacroDataUnavailableError, MacroSeriesPoint


class CompositeMacroDataProvider(MacroDataProvider):
    def __init__(self, registry: MacroSeriesRegistry, fred: MacroDataProvider, norges_bank: MacroDataProvider):
        self._registry = registry
        self._providers = {"fred": fred, "norges_bank": norges_bank}

    def get_latest(self, series_key: str) -> MacroSeriesPoint:
        return self._route(series_key).get_latest(series_key)

    def get_series(self, series_key: str, start: datetime, end: datetime) -> list[MacroSeriesPoint]:
        return self._route(series_key).get_series(series_key, start, end)

    def _route(self, series_key: str) -> MacroDataProvider:
        # An unregistered series_key must surface as MacroDataUnavailableError,
        # not the registry's own exception type (§21/§8.3, §28 rule 8) — the
        # same reasoning as each child provider's own _resolve().
        try:
            definition = self._registry.get(series_key)
        except UnknownMacroSeriesKeyError as exc:
            raise MacroDataUnavailableError(series_key, str(exc)) from exc
        provider_name = "fred" if isinstance(definition, FredSeriesDefinition) else "norges_bank"
        provider = self._providers.get(provider_name)
        if provider is None:  # pragma: no cover — defensive; every registered provider name is wired in factory.py
            raise MacroDataUnavailableError(series_key, f"no provider wired for '{provider_name}'")
        return provider
