"""filings.xbrl.org — XBRL International's free index of ESEF filings
(Sprint 10, 2026-09-25).

Keyless JSON:API (https://filings.xbrl.org/docs/about):

- ``/api/entities/{LEI}/filings`` — every ESEF filing of one company, with
  ``period_end``, ``json_url`` (the filing as xBRL-JSON), ``report_url``
  (the .xhtml), ``error_count`` and ``date_added``.
- ``{json_url}`` — the filing's facts in the OIM xBRL-JSON format: values
  already in full units with the sign applied, periods as
  ``start/end`` datetimes (end exclusive).

Norway is covered from FY2021, but the index runs about a year behind (the
newest Norwegian filing was added 2025-05-21). It is used for history only;
the latest year still comes from the .xhtml Faiz uploads.

This module only fetches and returns what the index says. Mapping the facts
to metrics is app/services/filings/esef_index.py, with the same code the
.xhtml upload uses.
"""
from __future__ import annotations

import re
import time
from dataclasses import dataclass
from typing import Any

import httpx

from app.providers.base import FundamentalsUnavailableError

BASE_URL = "https://filings.xbrl.org"
LEI_PATTERN = re.compile(r"^[A-Z0-9]{18}[0-9]{2}$")


class EsefIndexUnavailableError(FundamentalsUnavailableError):
    """The index could not be reached or returned something unusable."""


@dataclass(frozen=True)
class EsefFilingRef:
    period_end: str  # "2024-12-31"
    fxo_id: str
    json_url: str  # absolute
    report_url: str  # absolute (.xhtml)
    viewer_url: str  # absolute (ixbrl viewer), may be ""
    error_count: int
    date_added: str
    country: str


def _absolute(url: str | None) -> str:
    if not url:
        return ""
    return url if url.startswith("http") else f"{BASE_URL}{url if url.startswith('/') else '/' + url}"


class FilingsXbrlOrgProvider:
    def __init__(
        self,
        *,
        timeout_seconds: float = 30.0,
        client: httpx.Client | None = None,
        max_payload_bytes: int = 60 * 1024 * 1024,
    ) -> None:
        self._timeout = timeout_seconds
        self._client = client
        self._max_payload_bytes = max_payload_bytes

    def _get(self, url: str) -> tuple[Any, bytes]:
        headers = {"Accept": "application/json", "User-Agent": "Aladdin portfolio app (ESEF history import)"}
        client = self._client or httpx.Client(timeout=self._timeout, follow_redirects=True)
        try:
            response = None
            for attempt in range(2):
                try:
                    response = client.get(url, headers=headers)
                except httpx.HTTPError as exc:
                    raise EsefIndexUnavailableError(f"filings.xbrl.org request failed: {exc}") from exc
                if response.status_code in (429, 500, 502, 503, 504) and attempt == 0:
                    time.sleep(1.0)
                    continue
                break
            assert response is not None
            if response.status_code == 404:
                raise EsefIndexUnavailableError(f"filings.xbrl.org has nothing at {url}")
            if response.status_code != 200:
                raise EsefIndexUnavailableError(f"filings.xbrl.org returned HTTP {response.status_code} for {url}")
            if len(response.content) > self._max_payload_bytes:
                raise EsefIndexUnavailableError(f"filings.xbrl.org payload too large at {url}")
            try:
                return response.json(), response.content
            except ValueError as exc:
                raise EsefIndexUnavailableError(f"filings.xbrl.org returned non-JSON for {url}") from exc
        finally:
            if self._client is None:
                client.close()

    def list_filings(self, lei: str) -> list[EsefFilingRef]:
        """All ESEF filings for one LEI, newest period first, one per period
        end (the index lists a filing once per country it was filed in, and
        sometimes in two languages: the one with the fewest validation
        errors, then the most recently added, is kept)."""
        lei = lei.strip().upper()
        if not LEI_PATTERN.match(lei):
            raise EsefIndexUnavailableError(f"'{lei}' is not a valid LEI (20 characters, ISO 17442)")
        data, _raw = self._get(f"{BASE_URL}/api/entities/{lei}/filings?page%5Bsize%5D=100")
        rows = data.get("data") if isinstance(data, dict) else None
        if not isinstance(rows, list):
            raise EsefIndexUnavailableError("filings.xbrl.org returned an unexpected filings list")
        by_period: dict[str, list[EsefFilingRef]] = {}
        for row in rows:
            attrs = row.get("attributes") if isinstance(row, dict) else None
            if not isinstance(attrs, dict):
                continue
            period_end = str(attrs.get("period_end") or "")[:10]
            json_url = attrs.get("json_url")
            if not re.fullmatch(r"\d{4}-\d{2}-\d{2}", period_end) or not json_url:
                continue
            ref = EsefFilingRef(
                period_end=period_end,
                fxo_id=str(attrs.get("fxo_id") or ""),
                json_url=_absolute(json_url),
                report_url=_absolute(attrs.get("report_url")),
                viewer_url=_absolute(attrs.get("viewer_url")),
                error_count=int(attrs.get("error_count") or 0),
                date_added=str(attrs.get("date_added") or ""),
                country=str(attrs.get("country") or ""),
            )
            by_period.setdefault(period_end, []).append(ref)
        best = []
        for candidates in by_period.values():
            newest_first = sorted(candidates, key=lambda r: r.date_added, reverse=True)
            best.append(min(newest_first, key=lambda r: r.error_count))  # min() keeps the first of equals
        return sorted(best, key=lambda r: r.period_end, reverse=True)

    def get_filing_json(self, ref: EsefFilingRef) -> tuple[dict[str, Any], bytes]:
        data, raw = self._get(ref.json_url)
        if not isinstance(data, dict) or not isinstance(data.get("facts"), dict):
            raise EsefIndexUnavailableError(f"{ref.json_url} is not an xBRL-JSON report")
        return data, raw

