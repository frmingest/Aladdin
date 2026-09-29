"""Xtrackers (DWS) holdings feed: parsing the real response shape (captured
2026-09-29 for XDEF, trimmed to 8 rows), cash lines dropped, as-of date from
the source disclaimer, the generated CSV re-read by the standard importer,
and the fetch's failure modes."""
from __future__ import annotations

import json
from datetime import date
from decimal import Decimal
from pathlib import Path

import httpx
import pytest

from app.providers.xtrackers_holdings import (
    XtrackersFeedError,
    feed_url,
    fetch_xtrackers_holdings,
    normalize_isin,
    parse_holdings,
    to_csv_bytes,
)
from app.services.funds.holdings_import import parse_holdings_file

FIXTURE = json.loads((Path(__file__).parent.parent / "fixtures" / "xtrackers_holdings_xdef.json").read_text())
ISIN = "LU3061478973"


def test_parses_equities_drops_cash_and_reads_the_as_of_date():
    feed = parse_holdings(FIXTURE, fund_isin=ISIN)
    assert feed.as_of_date == date(2026, 9, 28)
    assert [h.name for h in feed.holdings][:2] == ["ROLLS-ROYCE HOLDINGS PLC", "SAFRAN SA"]
    assert len(feed.holdings) == 6  # 8 rows, 2 of them cash
    assert feed.cash_weight_pct == Decimal("0.02805635") + Decimal("-0.0032534")
    rr = feed.holdings[0]
    assert rr.isin == "GB00B63H8491"
    assert rr.weight_pct == Decimal("11.48997323")
    assert rr.country == "United Kingdom" and rr.industry == "Aerospace & Defense"
    assert rr.market_value == Decimal("4589591.65")


def test_columns_are_found_by_header_text_not_position():
    shuffled = json.loads(json.dumps(FIXTURE))
    table = shuffled["tables"][0]
    for col in table["columns"]:
        if col["value"] == "Name":
            col["key"] = "column_9"
    for row in table["values"]:
        row["column_9"] = row.pop("column_0")
    feed = parse_holdings(shuffled, fund_isin=ISIN)
    assert feed.holdings[0].name == "ROLLS-ROYCE HOLDINGS PLC"


def test_generated_csv_round_trips_through_the_standard_importer():
    feed = parse_holdings(FIXTURE, fund_isin=ISIN)
    parsed = parse_holdings_file("x.csv", to_csv_bytes(feed))
    assert parsed.as_of_date == date(2026, 9, 28)
    assert len(parsed.rows) == 6
    top = parsed.rows[0]
    assert top.name == "ROLLS-ROYCE HOLDINGS PLC" and top.isin == "GB00B63H8491"
    assert top.weight_pct == Decimal("11.4900")
    assert dict(parsed.derived_exposures("country"))["France"] > Decimal(10)
    assert "Aerospace & Defense" in dict(parsed.derived_exposures("sector"))


def test_isin_validation_and_url():
    assert normalize_isin(" lu3061478973 ") == ISIN
    assert feed_url(ISIN) == "https://etf.dws.com/api/pdp/en-lu/etf/LU3061478973/holdings"
    with pytest.raises(XtrackersFeedError):
        normalize_isin("not-an-isin")


def _client(handler) -> httpx.Client:
    return httpx.Client(transport=httpx.MockTransport(handler))


def test_fetch_success_and_failures():
    ok = _client(lambda request: httpx.Response(200, json=FIXTURE))
    assert fetch_xtrackers_holdings(ISIN, client=ok).holdings[0].isin == "GB00B63H8491"

    empty = _client(lambda request: httpx.Response(204))
    with pytest.raises(XtrackersFeedError, match="no holdings feed"):
        fetch_xtrackers_holdings(ISIN, client=empty)

    down = _client(lambda request: httpx.Response(503))
    with pytest.raises(XtrackersFeedError, match="503"):
        fetch_xtrackers_holdings(ISIN, client=down)

    junk = _client(lambda request: httpx.Response(200, json={"hello": "world"}))
    with pytest.raises(XtrackersFeedError, match="tables"):
        fetch_xtrackers_holdings(ISIN, client=junk)

    def boom(request):
        raise httpx.ConnectError("blocked")

    with pytest.raises(XtrackersFeedError, match="could not reach"):
        fetch_xtrackers_holdings(ISIN, client=_client(boom))
