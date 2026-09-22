"""Unit tests for app.providers.sec_edgar_provider — pure fact selection
over fixture company-facts payloads, plus the HTTP layer via
httpx.MockTransport (no real SEC calls)."""
from __future__ import annotations

import json
from decimal import Decimal

import httpx
import pytest

from app.providers.base import FundamentalsUnavailableError
from app.providers.sec_edgar_provider import (
    SecEdgarFundamentalsProvider,
    extract_annual_facts,
    normalize_ticker,
)


def _e(val, end, *, start=None, form="10-K", filed="2024-11-01", accn="0000320193-24-000123", fy=2024, fp="FY"):
    entry = {"val": val, "end": end, "form": form, "filed": filed, "accn": accn, "fy": fy, "fp": fp}
    if start:
        entry["start"] = start
    return entry


def _payload(facts: dict) -> dict:
    out: dict = {"cik": 320193, "entityName": "Apple Inc.", "facts": {}}
    for concept, units in facts.items():
        taxonomy, name = concept.split(":")
        out["facts"].setdefault(taxonomy, {})[name] = {"label": name, "units": units}
    return out


def _by(facts):
    return {(f.metric, f.period): f for f in facts}


def test_selects_annual_durations_and_ignores_quarters():
    payload = _payload({
        "us-gaap:Revenues": {"USD": [
            _e(1000, "2024-09-28", start="2023-10-01"),
            _e(250, "2024-06-29", start="2024-03-31", form="10-Q"),
            _e(300, "2024-09-28", start="2024-06-30"),  # Q4 duration inside a 10-K
        ]},
    })
    facts = _by(extract_annual_facts(payload))
    assert facts[("revenue", "FY2024")].value == Decimal(1000)
    assert len(facts) == 1


def test_latest_filed_value_wins_for_restated_year():
    payload = _payload({
        "us-gaap:NetIncomeLoss": {"USD": [
            _e(90, "2023-09-30", start="2022-10-01", filed="2023-11-03", accn="A-1"),
            _e(95, "2023-09-30", start="2022-10-01", filed="2024-11-01", accn="A-2"),
        ]},
    })
    fact = _by(extract_annual_facts(payload))[("net_income", "FY2023")]
    assert fact.value == Decimal(95)
    assert fact.accession_number == "A-2"
    assert fact.concept == "us-gaap:NetIncomeLoss"


def test_instant_facts_only_kept_at_fiscal_year_ends():
    payload = _payload({
        "us-gaap:Revenues": {"USD": [_e(1000, "2024-09-28", start="2023-10-01")]},
        "us-gaap:Assets": {"USD": [
            _e(5000, "2024-09-28"),
            _e(4800, "2024-06-29", form="10-K"),  # odd mid-year instant
        ]},
    })
    facts = _by(extract_annual_facts(payload))
    assert facts[("total_assets", "FY2024")].value == Decimal(5000)
    assert sum(1 for k in facts if k[0] == "total_assets") == 1


def test_concept_fallback_across_years():
    payload = _payload({
        "us-gaap:SalesRevenueNet": {"USD": [_e(800, "2017-09-30", start="2016-10-01", filed="2017-11-03")]},
        "us-gaap:RevenueFromContractWithCustomerExcludingAssessedTax": {"USD": [
            _e(1000, "2024-09-28", start="2023-10-01")
        ]},
    })
    facts = _by(extract_annual_facts(payload))
    assert facts[("revenue", "FY2017")].concept == "us-gaap:SalesRevenueNet"
    assert facts[("revenue", "FY2024")].concept.endswith("RevenueFromContractWithCustomerExcludingAssessedTax")


def test_shares_use_share_unit_and_no_currency():
    payload = _payload({
        "us-gaap:Revenues": {"USD": [_e(1000, "2024-09-28", start="2023-10-01")]},
        "us-gaap:WeightedAverageNumberOfDilutedSharesOutstanding": {"shares": [
            _e(15_400_000_000, "2024-09-28", start="2023-10-01")
        ]},
    })
    fact = _by(extract_annual_facts(payload))[("shares_outstanding", "FY2024")]
    assert fact.unit == "shares"
    assert fact.currency is None


def test_ifrs_filer_in_its_own_currency():
    payload = _payload({
        "ifrs-full:Revenue": {"NOK": [_e(900, "2023-12-31", start="2023-01-01", form="20-F")]},
        "ifrs-full:ProfitLoss": {"NOK": [_e(100, "2023-12-31", start="2023-01-01", form="20-F")]},
    })
    facts = _by(extract_annual_facts(payload))
    assert facts[("revenue", "FY2023")].currency == "NOK"
    assert facts[("net_income", "FY2023")].form == "20-F"


def test_max_years_limits_history():
    entries = [_e(i, f"{2010 + i}-12-31", start=f"{2010 + i}-01-01") for i in range(12)]
    facts = extract_annual_facts(_payload({"us-gaap:Revenues": {"USD": entries}}), max_years=5)
    assert sorted(f.period for f in facts) == [f"FY{y}" for y in range(2017, 2022)]


def test_no_annual_facts_returns_empty():
    payload = _payload({"us-gaap:Revenues": {"USD": [_e(1, "2024-06-30", start="2024-04-01", form="10-Q")]}})
    assert extract_annual_facts(payload) == []


def test_normalize_ticker():
    assert normalize_ticker("eqnr.ol") == "EQNR"
    assert normalize_ticker(" brk-b ") == "BRK-B"


def _client(handler) -> httpx.Client:
    return httpx.Client(transport=httpx.MockTransport(handler))


def test_missing_user_agent_fails_visibly_without_a_request():
    def handler(request):  # pragma: no cover - must not be called
        raise AssertionError("no request expected")

    provider = SecEdgarFundamentalsProvider(user_agent=None, client=_client(handler))
    with pytest.raises(FundamentalsUnavailableError, match="SEC_EDGAR_USER_AGENT"):
        provider.resolve_company("AAPL")


def test_resolve_and_fetch_send_user_agent():
    seen = []
    companyfacts = _payload({"us-gaap:Revenues": {"USD": [_e(1000, "2024-09-28", start="2023-10-01")]}})

    def handler(request: httpx.Request):
        seen.append(request.headers["User-Agent"])
        if request.url.path.endswith("company_tickers.json"):
            return httpx.Response(200, json={"0": {"cik_str": 320193, "ticker": "AAPL", "title": "Apple Inc."}})
        assert request.url.path == "/api/xbrl/companyfacts/CIK0000320193.json"
        return httpx.Response(200, content=json.dumps(companyfacts).encode())

    provider = SecEdgarFundamentalsProvider(user_agent="Aladdin test me@example.com", client=_client(handler))
    assert provider.resolve_company("aapl") == ("0000320193", "Apple Inc.")
    assert provider.resolve_company("NOPE") is None
    result = provider.get_annual_fundamentals("320193")
    assert result.entity_name == "Apple Inc."
    assert result.facts[0].metric == "revenue"
    assert set(seen) == {"Aladdin test me@example.com"}
    assert len(seen) == 2  # ticker map cached after first load


def test_http_error_becomes_unavailable():
    provider = SecEdgarFundamentalsProvider(
        user_agent="x me@example.com", client=_client(lambda r: httpx.Response(403))
    )
    with pytest.raises(FundamentalsUnavailableError, match="403"):
        provider.get_annual_fundamentals("1")
