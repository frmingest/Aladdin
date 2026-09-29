"""Xtrackers (DWS) public holdings feed — fund look-through data capture.

Confirmed live 2026-09-29 (through the built-in browser; this sandbox has no
route to etf.dws.com) against Faiz's own XDEF holding: DWS's product page
renders its holdings table from a public, unauthenticated JSON endpoint

    GET https://etf.dws.com/api/pdp/en-lu/etf/{ISIN}/holdings

Only the ISIN matters — the `-fund-name-slug` suffix on the page URL is
ignored by the API (checked with a bogus slug: same 200 + same body). The
`en-lu` locale is the one that answers; `en-de` returned 204 (empty).

Response shape (one table, every constituent — 41 rows for XDEF, not just the
15 the page shows):

    {"tables": [{"columns": [...],
                 "values": [{"header": {"value": "<ISIN>"},
                             "column_0": {"value": "<name>"},
                             "column_1": {"value": "11.490%", "sortValue": 11.48997323},
                             "column_2": {"value": "4.59 M EUR", "sortValue": 4589591.65},
                             "column_3": {"value": "<country>"},
                             "column_4": {"value": "<industry>"},
                             "column_5": {"value": "Equities" | "Cash"}}, ...],
                 "disclaimers": [{"text": "<p>Source: DWS 28.09.2026</p>"}], ...}]}

The columns are read by their *header text* (ISIN / Name / % Weight /
Market value / Country / Industry / Asset class), not by position, so a
reordered table still parses. Cash lines (`Asset class` = Cash, ISINs like
`_CURRENCYEUR`) are dropped — they are not businesses to look through into;
the coverage figure downstream is measured against the equity weight only.

This module only fetches and converts. The rows go through the same
deterministic holdings importer as an uploaded CSV
(app/services/funds/holdings_import.py) by way of a generated CSV, so the
fetched data is stored as a real `fund_holdings` document and every figure
stays traceable to it (decision 23, CLAUDE.md Rule 1 — no LLM).
"""
from __future__ import annotations

import csv
import io
import re
from dataclasses import dataclass
from datetime import date
from decimal import Decimal, InvalidOperation
from typing import Any

import httpx

BASE_URL = "https://etf.dws.com/api/pdp/en-lu/etf"
_ISIN_RE = re.compile(r"^[A-Z]{2}[A-Z0-9]{9}\d$")
_SOURCE_DATE_RE = re.compile(r"(\d{1,2})\.(\d{1,2})\.(\d{4})")
_TIMEOUT = 30.0


class XtrackersFeedError(RuntimeError):
    """The feed could not be fetched or did not look like a holdings table."""


@dataclass(frozen=True)
class XtrackersHolding:
    isin: str
    name: str
    weight_pct: Decimal
    market_value: Decimal | None
    country: str | None
    industry: str | None


@dataclass(frozen=True)
class XtrackersHoldings:
    fund_isin: str
    as_of_date: date | None
    holdings: list[XtrackersHolding]
    cash_weight_pct: Decimal
    url: str


def normalize_isin(value: str) -> str:
    isin = (value or "").strip().upper()
    if not _ISIN_RE.fullmatch(isin):
        raise XtrackersFeedError(f"'{value}' is not a valid ISIN (2 letters, 9 letters/digits, 1 check digit)")
    return isin


def feed_url(isin: str) -> str:
    return f"{BASE_URL}/{normalize_isin(isin)}/holdings"


def fetch_holdings_json(isin: str, *, client: httpx.Client | None = None) -> dict[str, Any]:
    url = feed_url(isin)
    owns_client = client is None
    client = client or httpx.Client(timeout=_TIMEOUT, follow_redirects=True, headers={"Accept": "application/json"})
    try:
        response = client.get(url)
    except httpx.HTTPError as exc:
        raise XtrackersFeedError(f"could not reach {url}: {exc}") from exc
    finally:
        if owns_client:
            client.close()
    if response.status_code not in (200, 204):
        raise XtrackersFeedError(f"{url} answered HTTP {response.status_code}")
    if response.status_code == 204 or not response.content:
        raise XtrackersFeedError(f"DWS has no holdings feed for {isin} (empty response) — is it an Xtrackers ETF?")
    try:
        data = response.json()
    except ValueError as exc:
        raise XtrackersFeedError(f"{url} did not return JSON") from exc
    if not isinstance(data, dict):
        raise XtrackersFeedError(f"{url} returned an unexpected JSON document")
    return data


def _cell(row: dict[str, Any], key: str | None) -> dict[str, Any]:
    cell = row.get(key) if key else None
    return cell if isinstance(cell, dict) else {}


def _decimal(value: Any) -> Decimal | None:
    if value is None or value == "":
        return None
    try:
        return Decimal(str(value))
    except InvalidOperation:
        return None


def _text(cell: dict[str, Any]) -> str | None:
    value = cell.get("value")
    text = str(value).strip() if value is not None else ""
    return text if text and text != "--" else None


def _as_of(table: dict[str, Any]) -> date | None:
    for disclaimer in table.get("disclaimers") or []:
        match = _SOURCE_DATE_RE.search(str(disclaimer.get("text", "")))
        if match:
            day, month, year = (int(g) for g in match.groups())
            try:
                return date(year, month, day)
            except ValueError:
                return None
    return None


def parse_holdings(data: dict[str, Any], *, fund_isin: str) -> XtrackersHoldings:
    tables = data.get("tables")
    if not isinstance(tables, list):
        raise XtrackersFeedError("no 'tables' in the feed")
    for table in tables:
        columns = {
            str(c.get("value", "")).strip().lower(): c.get("key")
            for c in table.get("columns") or []
            if isinstance(c, dict)
        }
        if "isin" not in columns or "name" not in columns or "% weight" not in columns:
            continue
        holdings: list[XtrackersHolding] = []
        cash = Decimal(0)
        for row in table.get("values") or []:
            if not isinstance(row, dict):
                continue
            weight_cell = _cell(row, columns["% weight"])
            weight = _decimal(weight_cell.get("sortValue"))
            asset_class = (_text(_cell(row, columns.get("asset class"))) or "").lower()
            if weight is None:
                continue
            if asset_class == "cash":
                cash += weight
                continue
            isin = _text(_cell(row, columns["isin"]))
            name = _text(_cell(row, columns["name"]))
            if not name or weight <= 0:
                continue
            holdings.append(
                XtrackersHolding(
                    isin=isin or "",
                    name=name,
                    weight_pct=weight,
                    market_value=_decimal(_cell(row, columns.get("market value")).get("sortValue")),
                    country=_text(_cell(row, columns.get("country"))),
                    industry=_text(_cell(row, columns.get("industry"))),
                )
            )
        if not holdings:
            raise XtrackersFeedError("the holdings table has no equity rows")
        return XtrackersHoldings(
            fund_isin=fund_isin,
            as_of_date=_as_of(table),
            holdings=holdings,
            cash_weight_pct=cash,
            url=feed_url(fund_isin),
        )
    raise XtrackersFeedError("no holdings table (ISIN / Name / % Weight columns) in the feed")


def to_csv_bytes(feed: XtrackersHoldings) -> bytes:
    """A provider-style CSV the standard holdings importer reads: a title
    row carrying the as-of date, then ISIN / Name / Weight (%) / Country /
    Industry. Generated so a fetch is stored as a real, re-importable
    `fund_holdings` document."""
    buffer = io.StringIO()
    writer = csv.writer(buffer)
    when = feed.as_of_date.strftime("%d.%m.%Y") if feed.as_of_date else "unknown date"
    writer.writerow([f"Holdings as of {when} - source: DWS Xtrackers (etf.dws.com), fund {feed.fund_isin}"])
    writer.writerow([])
    writer.writerow(["ISIN", "Name", "Weight (%)", "Country", "Industry"])
    for h in feed.holdings:
        writer.writerow([h.isin, h.name, f"{h.weight_pct:.6f}", h.country or "", h.industry or ""])
    return buffer.getvalue().encode("utf-8")


def fetch_xtrackers_holdings(isin: str, *, client: httpx.Client | None = None) -> XtrackersHoldings:
    isin = normalize_isin(isin)
    return parse_holdings(fetch_holdings_json(isin, client=client), fund_isin=isin)
