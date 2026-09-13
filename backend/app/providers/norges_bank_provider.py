"""
Norges Bank-backed MacroDataProvider (architecture §9.1, §26 Phase 4) — the
NOK-specific half of the §29 "research provider" resolution (Faiz's explicit
choice: FRED primary, Norges Bank for NOK-specific series — see
docs/decisions/0007).

Norges Bank's open data warehouse (https://data.norges-bank.no/api) needs no
API key and serves `/api/data/{dataset}/{key}` in several formats, including
`format=csv`, which follows the SDMX-CSV convention (fixed `TIME_PERIOD` and
`OBS_VALUE` columns) — see
https://www.norges-bank.no/en/topics/statistics/open-data/guide-data-warehouse/.
CSV is used here rather than sdmx-json specifically because the SDMX-CSV
column names are the one part of this API this session could actually verify
from Norges Bank's own published guide (see decision 0007's Consequences for
what could and couldn't be confirmed).

CAUTION: this build environment has no verified live access to this API —
see decision 0007. The dataset/key for the registered `no_policy_rate`
series (research/versions/v1.yaml) is a best-effort reading of Norges Bank's
API guide, not a value confirmed against a real response. This provider's
*mechanics* (HTTP call, SDMX-CSV parsing, error handling) are exercised by
unit tests against a canned response shaped like the documented format; the
*specific* dataset/key strings are the part that may need a one-line config
fix once verified against a live response.
"""

import csv
import io
from collections.abc import Sequence
from datetime import datetime, timezone
from decimal import Decimal, InvalidOperation
from typing import Any

import requests

from app.domain.macro_series import MacroSeriesRegistry, NorgesBankSeriesDefinition, UnknownMacroSeriesKeyError
from app.providers.base import MacroDataProvider, MacroDataUnavailableError, MacroSeriesPoint

PROVIDER_NAME = "norges_bank"
_BASE_URL = "https://data.norges-bank.no/api/data"
_REQUEST_TIMEOUT_SECONDS = 15


class NorgesBankMacroDataProvider(MacroDataProvider):
    def __init__(self, registry: MacroSeriesRegistry):
        self._registry = registry

    def get_latest(self, series_key: str) -> MacroSeriesPoint:
        definition = self._resolve(series_key)
        points = self._fetch(definition, params={"lastNObservations": 1, "locale": "en"})
        if not points:
            raise MacroDataUnavailableError(series_key, "Norges Bank returned no usable observations")
        return points[-1]

    def get_series(self, series_key: str, start: datetime, end: datetime) -> list[MacroSeriesPoint]:
        definition = self._resolve(series_key)
        points = self._fetch(
            definition,
            params={
                "startPeriod": start.date().isoformat(),
                "endPeriod": end.date().isoformat(),
                "locale": "en",
            },
        )
        if not points:
            raise MacroDataUnavailableError(
                series_key, f"Norges Bank returned no observations between {start} and {end}"
            )
        return points

    # --- internal helpers ---

    def _resolve(self, series_key: str) -> NorgesBankSeriesDefinition:
        # See FredMacroDataProvider._resolve's comment — an unregistered
        # series_key must surface as MacroDataUnavailableError, not the
        # registry's own exception type (§21/§8.3, §28 rule 8).
        try:
            definition = self._registry.get(series_key)
        except UnknownMacroSeriesKeyError as exc:
            raise MacroDataUnavailableError(series_key, str(exc)) from exc
        if not isinstance(definition, NorgesBankSeriesDefinition):
            raise MacroDataUnavailableError(
                series_key, "this series is not registered under provider 'norges_bank'"
            )
        return definition

    def _fetch(self, definition: NorgesBankSeriesDefinition, params: dict[str, Any]) -> list[MacroSeriesPoint]:
        url = f"{_BASE_URL}/{definition.dataset}/{definition.key}"
        request_params = {"format": "csv", **params}
        try:
            response = requests.get(url, params=request_params, timeout=_REQUEST_TIMEOUT_SECONDS)
            response.raise_for_status()
        except requests.RequestException as exc:
            raise MacroDataUnavailableError(
                definition.series_key,
                f"Norges Bank API call failed for dataset '{definition.dataset}' key '{definition.key}': {exc}",
            ) from exc

        return _parse_sdmx_csv(response.text, definition)


def _parse_sdmx_csv(text: str, definition: NorgesBankSeriesDefinition) -> list[MacroSeriesPoint]:
    reader = csv.DictReader(io.StringIO(text), delimiter=";")
    if reader.fieldnames is None:
        return []

    # Norges Bank's CSV export has used both ";" and "," as the delimiter
    # across different dataset/format combinations in past documentation
    # examples; re-read with "," if ";" didn't actually split the header.
    if len(reader.fieldnames) <= 1:
        reader = csv.DictReader(io.StringIO(text), delimiter=",")

    fieldnames = reader.fieldnames
    if not fieldnames:
        return []

    time_field = _find_field(fieldnames, "TIME_PERIOD")
    value_field = _find_field(fieldnames, "OBS_VALUE")
    if time_field is None or value_field is None:
        raise MacroDataUnavailableError(
            definition.series_key,
            f"unrecognized Norges Bank CSV response shape (columns: {fieldnames})",
        )

    points: list[MacroSeriesPoint] = []
    for row in reader:
        observed_at = _parse_period(row.get(time_field))
        value = _to_decimal(row.get(value_field))
        if observed_at is None or value is None:
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


def _find_field(fieldnames: Sequence[str], target: str) -> str | None:
    for name in fieldnames:
        if name.strip().upper() == target:
            return name
    return None


def _to_decimal(raw: Any) -> Decimal | None:
    if raw is None or str(raw).strip() == "":
        return None
    try:
        return Decimal(str(raw).strip())
    except InvalidOperation:
        return None


def _parse_period(raw: Any) -> datetime | None:
    if not raw:
        return None
    raw = str(raw).strip()
    for fmt in ("%Y-%m-%d", "%Y-%m", "%Y"):
        try:
            return datetime.strptime(raw, fmt).replace(tzinfo=timezone.utc)
        except ValueError:
            continue
    return None
