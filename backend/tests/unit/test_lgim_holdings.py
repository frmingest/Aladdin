"""L&G (LGIM) holdings file: parsing the real basket CSV (captured 2026-09-29
for the L&G Gold Mining UCITS ETF, all 44 rows), the resolver fragment, name
cleaning, the generated CSV re-read by the standard importer, the safety
checks (wrong fund / truncated file / foreign host) and the fetch's failure
modes."""
from __future__ import annotations

from datetime import date
from decimal import Decimal
from pathlib import Path

import httpx
import pytest

from app.providers.lgim_holdings import (
    KNOWN_FUNDS,
    LgimFeedError,
    clean_name,
    extract_file_url,
    fetch_lgim_holdings,
    known_fund,
    normalize_isin,
    parse_holdings_csv,
    to_csv_bytes,
)
from app.services.funds.holdings_import import parse_holdings_file

FIXTURES = Path(__file__).parent.parent / "fixtures"
CSV = (FIXTURES / "lgim_fundholdings_gold_mining.csv").read_text()
FRAGMENT = (FIXTURES / "lgim_resolver_gold_mining.html").read_text()
ISIN = "IE00B3CNHG25"
FILE_URL = "https://fundcentres.lgim.com/srp/documents-id/da7a67a8-9b13-48d9-b06c-0ac110c52180/Fundholdings.csv"


def test_parses_the_real_basket_file():
    feed = parse_holdings_csv(CSV, fund_isin=ISIN)
    assert feed.as_of_date == date(2026, 9, 29)
    assert feed.fund_name == "L&G Gold Mining UCITS ETF"
    assert len(feed.holdings) == 44
    newmont = next(h for h in feed.holdings if h.isin == "US6516391066")
    assert newmont.name == "NEWMONT CORP"  # 'USD 1.6' share descriptor stripped
    assert newmont.weight_pct == Decimal("16.2972902934")  # fraction -> percent
    assert newmont.currency == "USD"
    # weights add up to ~100%; the cash balance is a rounding-level residual, never negative
    assert Decimal("99.99") < sum(h.weight_pct for h in feed.holdings) < Decimal("100.01")
    assert feed.cash_weight_pct == 0


def test_metadata_lines_parse_with_or_without_a_delimiter():
    with_commas = (
        CSV.replace("ETF Trading ID", "ETF Trading ID,")
        .replace("Basket Trade Date", "Basket Trade Date,")
        .replace("Record Count", "Record Count,")
    )
    feed = parse_holdings_csv(with_commas, fund_isin=ISIN)
    assert feed.as_of_date == date(2026, 9, 29) and len(feed.holdings) == 44


def test_clean_name_strips_share_descriptors_only():
    assert clean_name("KINROSS GOLD CORP CAD NPV") == "KINROSS GOLD CORP"
    assert clean_name("ALAMOS GOLD INC NEW NPV") == "ALAMOS GOLD INC"
    assert clean_name("HOCHSCHILD MINING PLC 1P") == "HOCHSCHILD MINING PLC"
    assert clean_name("GOLD FIELDS LTD ZAR 0.5") == "GOLD FIELDS LTD"
    assert clean_name("AGNICO-EAGLE MINES LIMITED") == "AGNICO-EAGLE MINES LIMITED"


def test_refuses_another_funds_file_a_truncated_file_and_a_partial_basket():
    with pytest.raises(LgimFeedError, match="not IE00B0000000"):
        parse_holdings_csv(CSV, fund_isin="IE00B0000000")

    lines = CSV.split("\n")
    truncated = "\n".join(lines[:10] + lines[49:])  # 5 rows kept, footer still says 44
    with pytest.raises(LgimFeedError, match="truncated"):
        parse_holdings_csv(truncated, fund_isin=ISIN)

    partial = "\n".join(lines[:10] + lines[49:]).replace("Record Count44", "Record Count5")
    with pytest.raises(LgimFeedError, match="not a full basket"):
        parse_holdings_csv(partial, fund_isin=ISIN)

    with pytest.raises(LgimFeedError, match="header row"):
        parse_holdings_csv("ETF Trading IDIE00B3CNHG25\nnothing here", fund_isin=ISIN)


def test_generated_csv_round_trips_through_the_standard_importer():
    feed = parse_holdings_csv(CSV, fund_isin=ISIN)
    parsed = parse_holdings_file("x.csv", to_csv_bytes(feed))
    assert parsed.as_of_date == date(2026, 9, 29)
    assert len(parsed.rows) == 44
    assert not parsed.weights_were_fractions
    top = parsed.rows[0]
    assert top.name == "NEWMONT CORP" and top.isin == "US6516391066"
    assert top.weight_pct == Decimal("16.2973")
    assert dict(parsed.derived_exposures("currency"))["CAD"] > Decimal(30)


def test_resolver_fragment_yields_the_file_url_for_the_share_class():
    assert extract_file_url(FRAGMENT, 896) == FILE_URL
    with pytest.raises(LgimFeedError, match="no 'Download full fund holdings'"):
        extract_file_url(FRAGMENT, 999)
    evil = FRAGMENT.replace("fundcentres.lgim.com", "evil.example.com")
    with pytest.raises(LgimFeedError, match="unexpected host"):
        extract_file_url(evil, 896)
    http_only = FRAGMENT.replace("https://", "http://")
    with pytest.raises(LgimFeedError, match="unexpected host"):
        extract_file_url(http_only, 896)


def test_isin_validation_and_registry():
    assert normalize_isin(" ie00b3cnhg25 ") == ISIN
    with pytest.raises(LgimFeedError):
        normalize_isin("not-an-isin")
    assert known_fund(ISIN) is KNOWN_FUNDS[ISIN]
    with pytest.raises(LgimFeedError, match="not a configured L&G ETF"):
        known_fund("IE00B0000000")


def _client(handler) -> httpx.Client:
    return httpx.Client(transport=httpx.MockTransport(handler))


def _ok(request: httpx.Request) -> httpx.Response:
    if request.url.host == "fundcentres.landg.com":
        assert request.url.params["share_class_id"] == "896" and request.url.params["fund_id"] == "96"
        return httpx.Response(200, text=FRAGMENT)
    assert str(request.url) == FILE_URL
    return httpx.Response(200, content=CSV.encode())


def test_fetch_resolves_the_url_then_downloads_and_parses():
    feed = fetch_lgim_holdings(ISIN, client=_client(_ok))
    assert feed.url == FILE_URL and len(feed.holdings) == 44


def test_fetch_failure_modes():
    with pytest.raises(LgimFeedError, match="not a configured"):
        fetch_lgim_holdings("IE00B0000000", client=_client(_ok))

    with pytest.raises(LgimFeedError, match="503"):
        fetch_lgim_holdings(ISIN, client=_client(lambda r: httpx.Response(503)))

    no_link = _client(lambda r: httpx.Response(200, text="<html>nothing</html>"))
    with pytest.raises(LgimFeedError, match="no 'Download full fund holdings'"):
        fetch_lgim_holdings(ISIN, client=no_link)

    def file_missing(request):
        if request.url.host == "fundcentres.landg.com":
            return httpx.Response(200, text=FRAGMENT)
        return httpx.Response(404)

    with pytest.raises(LgimFeedError, match="404"):
        fetch_lgim_holdings(ISIN, client=_client(file_missing))

    def boom(request):
        raise httpx.ConnectError("blocked")

    with pytest.raises(LgimFeedError, match="could not reach"):
        fetch_lgim_holdings(ISIN, client=_client(boom))
