"""
FRED-backed MacroDataProvider (architecture §9.1, §26 Phase 4) — the primary
half of the §29 "research provider" resolution for numeric central-bank/macro
data (Faiz's explicit choice: FRED primary, Norges Bank for NOK-specific
series — see docs/decisions/0007).

FRED (Federal Reserve Bank of St. Louis) hosts a broad set of US and
international series behind one free, documented, keyed HTTP API — see
https://fred.stlouisfed.org/docs/api/fred/series_observations.html. Requires
a free API key (FRED_API_KEY) but no paid tier; this is the "free/low-cost
first" (§2.9) choice for the series this registry maps to it, mirroring the
yfinance/Google-AI-Studio precedent from Phases 2-3 of picking the
free/keyed-but-no-cost option over a paid one.

Which series_key maps to which FRED series id (and which FRED `units`
transform — e.g. `pc1` for "percent change from year ago") is config, not
code — see app.domain.macro_series and research/versions/v1.yaml. This
provider only knows how to call FRED's endpoint and parse its response; it
raises MacroDataUnavailableError for a series_key it isn't asked to serve
(app.providers.composite_macro_provider is what routes by series_key), so it
stays a plain, swappable MarketDataProvider-style implementation (§28
rule 8).
"""

from datetime import datetime, timezone
from decimal import Decimal, InvalidOperation
from typing import Any

import requests

from app.domain.macro_series import FredSeriesDefinition, MacroSeriesRegistry, UnknownMacroSeriesKeyError
from app.providers.base import MacroDataProvider, MacroDataUnavailableError, MacroSeriesPoint

PROVIDER_NAME = "fred"
_BASE_URL = "https://api.stlouisfed.org/fred/series/observations"
_REQUEST_TIMEOUT_SECONDS = 15
# FRED's convention for "no data at this observation" — never a real value,
# so it must never be parsed into a Decimal (§28 rule 10: never invent).
_MISSING_VALUE_SENTINEL = "."


class FredMacroDataProvider(MacroDataProvider):
    def __init__(self, api_key: str, registry: MacroSeriesRegistry):
        if not api_key:
            raise MacroDataUnavailableError(
                "*", "FRED_API_KEY is not configured — set it in backend/.env (get one free at "
                "https://fred.stlouisfed.org/docs/api/api_key.html)"
            )
        self._api_key = api_key
        self._registry = registry

    def get_latest(self, series_key: str) -> MacroSeriesPoint:
        definition = self._resolve(series_key)
        points = self._fetch(definition, params={"sort_order": "desc", "limit": 1})
        if not points:
            raise MacroDataUnavailableError(series_key, "FRED returned no usable observations")
        return points[0]

    def get_series(self, series_key: str, start: datetime, end: datetime) -> list[MacroSeriesPoint]:
        definition = self._resolve(series_key)
        points = self._fetch(
            definition,
            params={
                "observation_start": start.date().isoformat(),
                "observation_end": end.date().isoformat(),
                "sort_order": "asc",
            },
        )
        if not points:
            raise MacroDataUnavailableError(series_key, f"FRED returned no observations between {start} and {end}")
        return points

    # --- internal helpers ---

    def _resolve(self, series_key: str) -> FredSeriesDefinition:
        # A series_key absent from the registry entirely (not just "belongs
        # to the other vendor") is still an expected, callable-facing failure
        # (§21/§8.3), so it must surface as MacroDataUnavailableError like
        # every other resolution failure here — never let the registry's own
        # exception type leak past this boundary (§28 rule 8).
        try:
            definition = self._registry.get(series_key)
        except UnknownMacroSeriesKeyError as exc:
            raise MacroDataUnavailableError(series_key, str(exc)) from exc
        if not isinstance(definition, FredSeriesDefinition):
            raise MacroDataUnavailableError(series_key, "this series is not registered under provider 'fred'")
        return definition

    def _fetch(self, definition: FredSeriesDefinition, params: dict[str, Any]) -> list[MacroSeriesPoint]:
        request_params = {
            "series_id": definition.provider_series_id,
            "api_key": self._api_key,
            "file_type": "json",
            "units": definition.fred_units,
            **params,
        }
        try:
            response = requests.get(_BASE_URL, params=request_params, timeout=_REQUEST_TIMEOUT_SECONDS)
            response.raise_for_status()
            payload = response.json()
        except requests.RequestException as exc:
            raise MacroDataUnavailableError(
                definition.series_key, f"FRED API call failed for series '{definition.provider_series_id}': {exc}"
            ) from exc
        except ValueError as exc:  # response.json() failed to parse
            raise MacroDataUnavailableError(
                definition.series_key, f"FRED returned a non-JSON response: {exc}"
            ) from exc

        observations = payload.get("observations", [])
        points: list[MacroSeriesPoint] = []
        for obs in observations:
            value = _to_decimal(obs.get("value"))
            observed_at = _parse_date(obs.get("date"))
            if value is None or observed_at is None:
                # A missing/unparseable observation is dropped, not zeroed or
                # estimated (§28 rule 10) — FRED itself marks gaps this way
                # (e.g. a bank holiday in a daily series).
                continue
            points.append(
                MacroSeriesPoint(
                    series_key=definition.series_key,
                    value=value,
                    unit=definition.unit,
                    observed_at=observed_at,
                    provider=PROVIDER_NAME,
                    region=definition.region,
                )
            )
        return points


def _to_decimal(raw: Any) -> Decimal | None:
    if raw is None or raw == _MISSING_VALUE_SENTINEL:
        return None
    try:
        return Decimal(str(raw))
    except InvalidOperation:
        return None


def _parse_date(raw: Any) -> datetime | None:
    if not raw:
        return None
    try:
        return datetime.strptime(raw, "%Y-%m-%d").replace(tzinfo=timezone.utc)
    except ValueError:
        return None
