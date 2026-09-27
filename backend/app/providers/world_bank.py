"""World Bank Indicators API v2 — keyless (Epic F22, story 22.10).

Takes CWO's *indicator mapping*, not its fetcher code (plan §4a #2): the
CWO fetcher was coupled to its own crud/models and its sibling
internal_order_fetcher fell back to hard-coded mock scores — neither comes
along. A failure here raises WorldBankUnavailableError and the figure
stays missing.

    GET https://api.worldbank.org/v2/country/{iso3}/indicator/{code}
        ?format=json&per_page=20&date=YYYY:YYYY[&source=3 for WGI]
    -> [ {"page":1, "pages":1, "total":N, ...},
         [ {"indicator":{"id":..}, "country":{"id":"NO"}, "countryiso3code":"NOR",
            "date":"2024", "value":-8.5, ...}, ... ] ]

An error comes back as a one-element list: [{"message":[{"id":"120","key":"Invalid value",..}]}].
Checked against the documented v2 shape; this build environment can't
reach the live API (see claude/analyst-modes-epic-f22-2026-09-27.md
build notes), so the first real refresh is the live check.
"""
from __future__ import annotations

from dataclasses import dataclass
from decimal import Decimal, InvalidOperation
from typing import Any, Protocol

import httpx

WORLD_BANK_URL = "https://api.worldbank.org/v2/country/{country}/indicator/{indicator}"
_USER_AGENT = "Aladdin portfolio app (country risk)"


class WorldBankUnavailableError(Exception):
    pass


@dataclass(frozen=True)
class YearValue:
    year: int
    value: Decimal


class CountryIndicatorProvider(Protocol):
    name: str

    def fetch(
        self, country_iso3: str, indicator: str, *, start_year: int, end_year: int, source_id: int | None = None
    ) -> list[YearValue]: ...


def parse_world_bank(payload: Any, label: str = "") -> list[YearValue]:
    if isinstance(payload, list) and len(payload) == 1 and isinstance(payload[0], dict) and "message" in payload[0]:
        messages = payload[0].get("message") or []
        text = "; ".join(str(m.get("value") or m.get("key")) for m in messages if isinstance(m, dict))
        raise WorldBankUnavailableError(f"World Bank {label}: {text or 'error response'}")
    if not isinstance(payload, list) or len(payload) < 2:
        raise WorldBankUnavailableError(f"World Bank {label}: unexpected response shape")
    rows = payload[1]
    if rows is None:
        return []  # a valid, empty answer: the country has no data for this indicator
    if not isinstance(rows, list):
        raise WorldBankUnavailableError(f"World Bank {label}: unexpected response shape")
    out: list[YearValue] = []
    for row in rows:
        if not isinstance(row, dict) or row.get("value") is None:
            continue
        try:
            year = int(str(row.get("date"))[:4])
            value = Decimal(str(row["value"]))
        except (ValueError, InvalidOperation, TypeError):
            continue
        if value.is_finite():
            out.append(YearValue(year, value))
    out.sort(key=lambda yv: yv.year)
    return out


class WorldBankProvider:
    name = "world_bank"

    def __init__(self, *, timeout_seconds: float = 15.0) -> None:
        self._timeout = timeout_seconds

    def fetch(
        self, country_iso3: str, indicator: str, *, start_year: int, end_year: int, source_id: int | None = None
    ) -> list[YearValue]:
        params: dict[str, Any] = {"format": "json", "per_page": 50, "date": f"{start_year}:{end_year}"}
        if source_id is not None:
            params["source"] = source_id
        label = f"{indicator} for {country_iso3}"
        try:
            response = httpx.get(
                WORLD_BANK_URL.format(country=country_iso3, indicator=indicator),
                params=params,
                timeout=self._timeout,
                headers={"User-Agent": _USER_AGENT},
            )
            response.raise_for_status()
            payload = response.json()
        except httpx.HTTPStatusError as exc:
            raise WorldBankUnavailableError(f"World Bank {label}: HTTP {exc.response.status_code}") from exc
        except httpx.HTTPError as exc:
            raise WorldBankUnavailableError(f"World Bank {label}: request failed ({exc.__class__.__name__})") from exc
        except ValueError as exc:
            raise WorldBankUnavailableError(f"World Bank {label}: response was not JSON") from exc
        return parse_world_bank(payload, label)
