"""Numeric macro data providers (2026-09-24): Norges Bank, FRED and
Statistics Norway (SSB). All three are free public APIs; only FRED needs a
key (the same FRED_API_KEY the DCF's risk-free rate already uses).

Each provider returns raw observations for one catalogue series
(app/domain/macro_series.py) from a start date. Transforms such as CPI
y/y are applied later, deterministically, in app/services/macro/ —
providers never compute anything (CLAUDE.md Rule 1).

Response shapes, checked against the live endpoints 2026-09-24:

- Norges Bank (SDMX-JSON 1.0)
  GET https://data.norges-bank.no/api/data/{flow}/{key}?format=sdmx-json&startPeriod=YYYY-MM-DD&locale=en
  -> data.structure.dimensions.observation[0].values = [{"id": "2026-09-22"}, ...]
     data.dataSets[0].series["0:0:0:0"].observations = {"0": ["4.25"], "1": ["4.25"]}
     optional series attribute UNIT_MULT (10^n units per quote, e.g. JPY per 100).
- FRED
  GET https://api.stlouisfed.org/fred/series/observations?series_id=..&observation_start=..&file_type=json
  -> {"observations": [{"date": "2026-09-22", "value": "4.13"}, ...]}; "." = missing.
- SSB PxWebApi v2 (JSON-stat 2)
  GET https://data.ssb.no/api/pxwebapi/v2/tables/{table}/data?lang=en
      &valueCodes[ContentsCode]={code}&valueCodes[Tid]=top(N)&outputFormat=json-stat2
  -> {"id": ["ContentsCode","Tid"], "size": [1,N],
      "dimension": {"Tid": {"category": {"index": {"2026M08": 12, ...}}}}, "value": [..]}

Any surprise raises MacroDataUnavailableError (fail visibly) rather than
inventing data.
"""
from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass
from datetime import date, datetime, timezone
from decimal import Decimal, InvalidOperation
from typing import Any

import httpx

from app.domain.macro_series import MacroSeriesSpec

NORGES_BANK_URL = "https://data.norges-bank.no/api/data/{flow}/{key}"
FRED_URL = "https://api.stlouisfed.org/fred/series/observations"
SSB_URL = "https://data.ssb.no/api/pxwebapi/v2/tables/{table}/data"
_USER_AGENT = "Aladdin portfolio app (macro data)"


class MacroDataUnavailableError(Exception):
    """A macro series couldn't be fetched or parsed (network, missing key,
    unexpected shape). Carries a human-readable reason."""


@dataclass(frozen=True)
class MacroPoint:
    observed_on: date
    value: Decimal


class MacroDataProvider(ABC):
    name: str

    @abstractmethod
    def fetch(self, spec: MacroSeriesSpec, start: date) -> list[MacroPoint]:
        """Observations on or after `start`, oldest first."""


def _decimal(raw: Any) -> Decimal | None:
    if raw is None:
        return None
    try:
        value = Decimal(str(raw).strip())
    except (InvalidOperation, ValueError):
        return None
    return value if value.is_finite() else None


def _get_json(url: str, params: dict[str, Any], timeout: float, label: str) -> Any:
    try:
        response = httpx.get(url, params=params, timeout=timeout, headers={"User-Agent": _USER_AGENT})
        response.raise_for_status()
        return response.json()
    except httpx.HTTPStatusError as exc:
        raise MacroDataUnavailableError(f"{label}: HTTP {exc.response.status_code}") from exc
    except httpx.HTTPError as exc:
        raise MacroDataUnavailableError(f"{label}: request failed ({exc.__class__.__name__})") from exc
    except ValueError as exc:
        raise MacroDataUnavailableError(f"{label}: response was not JSON") from exc


# --- Norges Bank --------------------------------------------------------------


class NorgesBankMacroProvider(MacroDataProvider):
    name = "norges_bank"

    def __init__(self, *, timeout_seconds: float = 15.0) -> None:
        self._timeout = timeout_seconds

    def fetch(self, spec: MacroSeriesSpec, start: date) -> list[MacroPoint]:
        flow, key = spec.source_series_id.split("/", 1)
        payload = _get_json(
            NORGES_BANK_URL.format(flow=flow, key=key),
            {"format": "sdmx-json", "startPeriod": start.isoformat(), "locale": "en"},
            self._timeout,
            f"Norges Bank {spec.source_series_id}",
        )
        return parse_norges_bank(payload, spec.source_series_id)


def parse_norges_bank(payload: Any, label: str = "") -> list[MacroPoint]:
    try:
        data = payload["data"]
        structure = data["structure"]
        periods = structure["dimensions"]["observation"][0]["values"]
        series_map = data["dataSets"][0]["series"]
    except (KeyError, IndexError, TypeError) as exc:
        raise MacroDataUnavailableError(f"Norges Bank {label}: unexpected response shape") from exc
    if not isinstance(series_map, dict) or len(series_map) != 1:
        raise MacroDataUnavailableError(
            f"Norges Bank {label}: expected exactly one series, got {len(series_map) if isinstance(series_map, dict) else 'none'}"
        )
    series = next(iter(series_map.values()))
    multiplier = _unit_multiplier(structure, series)
    points: list[MacroPoint] = []
    for index_text, obs in (series.get("observations") or {}).items():
        try:
            period_id = periods[int(index_text)]["id"]
            observed_on = date.fromisoformat(period_id[:10])
        except (ValueError, IndexError, KeyError, TypeError):
            continue
        value = _decimal(obs[0] if isinstance(obs, list) and obs else None)
        if value is None:
            continue
        points.append(MacroPoint(observed_on, value / multiplier if multiplier != 1 else value))
    points.sort(key=lambda p: p.observed_on)
    return points


def _unit_multiplier(structure: dict, series: dict) -> Decimal:
    """SDMX UNIT_MULT: a quote of 7.1 with UNIT_MULT 2 means 7.1 per 100
    units. Returns the divisor that turns a quote into a per-unit value."""
    definitions = (structure.get("attributes") or {}).get("series") or []
    indexes = series.get("attributes") or []
    for position, definition in enumerate(definitions):
        if definition.get("id") != "UNIT_MULT" or position >= len(indexes):
            continue
        chosen = indexes[position]
        values = definition.get("values") or []
        if chosen is None or not isinstance(chosen, int) or chosen >= len(values):
            return Decimal(1)
        try:
            return Decimal(10) ** int(values[chosen]["id"])
        except (KeyError, ValueError, TypeError):
            return Decimal(1)
    return Decimal(1)


# --- FRED ---------------------------------------------------------------------


class FredMacroProvider(MacroDataProvider):
    name = "fred"

    def __init__(self, *, api_key: str, timeout_seconds: float = 15.0) -> None:
        self._api_key = api_key
        self._timeout = timeout_seconds

    def fetch(self, spec: MacroSeriesSpec, start: date) -> list[MacroPoint]:
        if not self._api_key:
            raise MacroDataUnavailableError(
                "FRED_API_KEY is not set — get a free key at https://fred.stlouisfed.org/docs/api/api_key.html"
            )
        payload = _get_json(
            FRED_URL,
            {
                "series_id": spec.source_series_id,
                "api_key": self._api_key,
                "file_type": "json",
                "observation_start": start.isoformat(),
                "sort_order": "asc",
            },
            self._timeout,
            f"FRED {spec.source_series_id}",
        )
        return parse_fred(payload, spec.source_series_id)


def parse_fred(payload: Any, label: str = "") -> list[MacroPoint]:
    observations = payload.get("observations") if isinstance(payload, dict) else None
    if not isinstance(observations, list):
        raise MacroDataUnavailableError(f"FRED {label}: unexpected response shape")
    points: list[MacroPoint] = []
    for obs in observations:
        raw = obs.get("value") if isinstance(obs, dict) else None
        if raw in (None, "."):  # FRED's own missing-value sentinel, never 0
            continue
        value = _decimal(raw)
        try:
            observed_on = date.fromisoformat(str(obs.get("date")))
        except ValueError:
            continue
        if value is not None:
            points.append(MacroPoint(observed_on, value))
    points.sort(key=lambda p: p.observed_on)
    return points


# --- Statistics Norway ----------------------------------------------------------


class SsbMacroProvider(MacroDataProvider):
    name = "ssb"

    def __init__(self, *, timeout_seconds: float = 15.0) -> None:
        self._timeout = timeout_seconds

    def fetch(self, spec: MacroSeriesSpec, start: date) -> list[MacroPoint]:
        table, contents_code = spec.source_series_id.split("/", 1)
        today = datetime.now(timezone.utc).date()
        months = max(1, (today.year - start.year) * 12 + today.month - start.month + 1)
        payload = _get_json(
            SSB_URL.format(table=table),
            {
                "lang": "en",
                "valueCodes[ContentsCode]": contents_code,
                "valueCodes[Tid]": f"top({min(months, 240)})",
                "outputFormat": "json-stat2",
            },
            self._timeout,
            f"SSB table {table}",
        )
        return [p for p in parse_ssb(payload, table) if p.observed_on >= start.replace(day=1)]


def parse_ssb(payload: Any, label: str = "") -> list[MacroPoint]:
    """Single-ContentsCode JSON-stat 2 table with a monthly Tid dimension
    ("2026M08" -> 2026-08-01). Any other dimension must have size 1."""
    try:
        ids: list[str] = payload["id"]
        sizes: list[int] = payload["size"]
        values: list[Any] = payload["value"]
        tid_index: dict[str, int] = payload["dimension"]["Tid"]["category"]["index"]
    except (KeyError, TypeError) as exc:
        raise MacroDataUnavailableError(f"SSB {label}: unexpected response shape") from exc
    if "Tid" not in ids or any(size != 1 for dim, size in zip(ids, sizes, strict=False) if dim != "Tid"):
        raise MacroDataUnavailableError(f"SSB {label}: expected one series over time")
    points: list[MacroPoint] = []
    for period, position in tid_index.items():
        try:
            year_text, month_text = period.split("M")
            observed_on = date(int(year_text), int(month_text), 1)
        except ValueError:
            continue
        value = _decimal(values[position] if 0 <= position < len(values) else None)
        if value is not None:
            points.append(MacroPoint(observed_on, value))
    points.sort(key=lambda p: p.observed_on)
    return points


# --- Routing --------------------------------------------------------------------


class CompositeMacroDataProvider(MacroDataProvider):
    """Routes each catalogue series to its publisher's provider."""

    name = "composite"

    def __init__(self, providers: dict[str, MacroDataProvider]) -> None:
        self._providers = providers

    def provider_name_for(self, spec: MacroSeriesSpec) -> str:
        return self._providers[spec.source].name if spec.source in self._providers else spec.source

    def fetch(self, spec: MacroSeriesSpec, start: date) -> list[MacroPoint]:
        provider = self._providers.get(spec.source)
        if provider is None:
            raise MacroDataUnavailableError(f"No provider configured for source {spec.source!r}")
        return provider.fetch(spec, start)
