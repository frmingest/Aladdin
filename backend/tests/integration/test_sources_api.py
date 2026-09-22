"""Integration tests for /sources/* (SEC EDGAR import + Newsweb
announcements) against fake providers — no real SEC/Newsweb calls."""
from __future__ import annotations

from datetime import datetime, timezone
from decimal import Decimal

import pytest

from app.main import app
from app.models import Document, FinancialLineItem
from app.providers.base import (
    CompanyFundamentals,
    FundamentalsUnavailableError,
    ReportedFact,
    ResearchItem,
    ResearchUnavailableError,
)
from app.providers.factory import (
    get_announcements_provider_or_none,
    get_fundamentals_provider_or_none,
)

NOW = datetime(2026, 9, 22, tzinfo=timezone.utc)


def _fact(metric, value, period, *, accn="0000320193-24-000123"):
    return ReportedFact(
        metric=metric, value=Decimal(value), unit="USD", currency="USD", period=period,
        period_end=f"{period[2:]}-09-28", concept=f"us-gaap:{metric}", form="10-K",
        accession_number=accn, filed=f"{period[2:]}-11-01",
    )


class FakeEdgar:
    name = "SEC EDGAR"

    def __init__(self, *, ticker_map=None, facts=None, payload=b'{"v":1}', fail=None):
        self.ticker_map = ticker_map if ticker_map is not None else {"AAPL": ("0000320193", "Apple Inc.")}
        self.facts = facts if facts is not None else [
            _fact("revenue", 1000, "FY2024"), _fact("net_income", 100, "FY2024"),
            _fact("revenue", 900, "FY2023", accn="0000320193-23-000106"),
        ]
        self.payload = payload
        self.fail = fail

    def resolve_company(self, ticker):
        return self.ticker_map.get(ticker.upper().split(".")[0])

    def get_annual_fundamentals(self, company_id):
        if self.fail:
            raise FundamentalsUnavailableError(self.fail)
        return CompanyFundamentals(
            source_name="SEC EDGAR", source_url="https://www.sec.gov/x", company_id=company_id,
            entity_name="Apple Inc.", facts=self.facts, raw_payload=self.payload, retrieved_at=NOW,
        )


class FakeNewsweb:
    name = "Oslo Børs Newsweb"

    def __init__(self, fail=False):
        self.calls = 0
        self.fail = fail

    def get_announcements(self, ticker):
        self.calls += 1
        if self.fail:
            raise ResearchUnavailableError("newsweb down")
        return [
            ResearchItem(
                source_url="https://newsweb.oslobors.no/message/1", source_name="Oslo Børs Newsweb",
                title="Q2 2026 results", summary="Regulated announcement...",
                source_type="regulatory_announcement", retrieved_at=NOW,
                published_at=datetime(2026, 7, 15, tzinfo=timezone.utc),
            )
        ]


@pytest.fixture()
def edgar():
    fake = FakeEdgar()
    app.dependency_overrides[get_fundamentals_provider_or_none] = lambda: fake
    yield fake


@pytest.fixture()
def newsweb():
    fake = FakeNewsweb()
    app.dependency_overrides[get_announcements_provider_or_none] = lambda: fake
    yield fake


def _holding(client, ticker="AAPL", name="Apple Inc.", currency="USD"):
    r = client.post("/holdings", json={"ticker": ticker, "name": name, "trading_currency": currency})
    assert r.status_code == 201, r.text
    return r.json()["id"]


def test_edgar_import_creates_traceable_line_items(client, db_session, edgar):
    hid = _holding(client)
    assert client.get(f"/sources/holdings/{hid}/sec-edgar").json()["imported"] is False

    r = client.post(f"/sources/holdings/{hid}/sec-edgar/import")
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["cik"] == "0000320193"
    assert body["facts_imported"] == 3
    assert body["periods_imported"] == ["FY2024", "FY2023"]
    assert {f["accession_number"] for f in body["filings"]} == {"0000320193-24-000123", "0000320193-23-000106"}
    assert body["filings"][0]["url"].startswith("https://www.sec.gov/Archives/edgar/data/320193/")

    doc = db_session.query(Document).filter_by(type="sec_xbrl_facts").one()
    assert doc.quality_flags["provenance"]["FY2024:revenue"]["accession_number"] == "0000320193-24-000123"
    assert db_session.query(FinancialLineItem).filter_by(document_id=doc.id).count() == 3

    # Existing metrics endpoint picks the imported facts up unchanged.
    assert client.get(f"/holdings/{hid}/periods").json() == ["FY2023", "FY2024"]
    metrics = client.get(f"/holdings/{hid}/metrics", params={"period": "FY2024"}).json()
    assert "net_margin" in str(metrics)

    again = client.get(f"/sources/holdings/{hid}/sec-edgar").json()
    assert again["imported"] is True and again["facts_imported"] == 3


def test_reimport_same_payload_is_noop_and_new_payload_supersedes(client, db_session, edgar):
    hid = _holding(client)
    client.post(f"/sources/holdings/{hid}/sec-edgar/import")
    r = client.post(f"/sources/holdings/{hid}/sec-edgar/import")
    assert r.json()["was_duplicate"] is True
    assert db_session.query(FinancialLineItem).count() == 3

    edgar.payload = b'{"v":2}'
    edgar.facts = [_fact("revenue", 1100, "FY2025")] + edgar.facts
    r = client.post(f"/sources/holdings/{hid}/sec-edgar/import")
    assert r.json()["facts_imported"] == 4
    db_session.expire_all()
    assert db_session.query(FinancialLineItem).count() == 4  # old import's rows replaced, not doubled
    assert db_session.query(Document).filter_by(type="sec_xbrl_facts").count() == 2  # audit trail kept


def test_manually_uploaded_period_is_not_overwritten(client, db_session, edgar):
    hid = _holding(client)
    manual = Document(
        holding_id=hid, type="annual_report", original_filename="ar.pdf", mime_type="application/pdf",
        size_bytes=1, storage_path="x", sha256="b" * 64, status="processed", quality_flags={},
    )
    db_session.add(manual)
    db_session.flush()
    db_session.add(FinancialLineItem(
        document_id=manual.id, holding_id=hid, metric="revenue", value=Decimal(1), unit="USD",
        currency="USD", period="FY2024", confidence=0.8,
    ))
    db_session.commit()

    body = client.post(f"/sources/holdings/{hid}/sec-edgar/import").json()
    assert body["periods_skipped_manual"] == ["FY2024"]
    assert body["periods_imported"] == ["FY2023"]


def test_unknown_ticker_is_422(client, edgar):
    hid = _holding(client, ticker="NOPE", name="Nope Corp")
    r = client.post(f"/sources/holdings/{hid}/sec-edgar/import")
    assert r.status_code == 422
    assert "not an SEC-registered ticker" in r.json()["detail"]


def test_oslo_ticker_colliding_with_unrelated_us_filer_is_refused(client, edgar):
    edgar.ticker_map = {"VAR": ("0000203527", "Varian Medical Systems Inc")}
    hid = _holding(client, ticker="VAR.OL", name="Vår Energi ASA", currency="NOK")
    r = client.post(f"/sources/holdings/{hid}/sec-edgar/import")
    assert r.status_code == 422
    assert "refusing" in r.json()["detail"]


def test_provider_failure_is_422_not_500(client, edgar):
    edgar.fail = "SEC_EDGAR_USER_AGENT is not set"
    hid = _holding(client)
    r = client.post(f"/sources/holdings/{hid}/sec-edgar/import")
    assert r.status_code == 422
    assert "SEC_EDGAR_USER_AGENT" in r.json()["detail"]


def test_announcements_for_oslo_holding_are_cached(client, newsweb):
    hid = _holding(client, ticker="VAR.OL", name="Vår Energi ASA", currency="NOK")
    r = client.get(f"/sources/holdings/{hid}/announcements")
    assert r.status_code == 200
    body = r.json()
    assert body["available"] is True
    assert body["items"][0]["title"] == "Q2 2026 results"
    client.get(f"/sources/holdings/{hid}/announcements")
    assert newsweb.calls == 1  # served from cache
    client.post(f"/sources/holdings/{hid}/announcements/refresh")
    assert newsweb.calls == 2


def test_announcements_not_applicable_for_us_holding(client, newsweb):
    hid = _holding(client)
    body = client.get(f"/sources/holdings/{hid}/announcements").json()
    assert body["available"] is False
    assert "Oslo" in body["reason"]
    assert newsweb.calls == 0


def test_eligibility_hint(client):
    hid = _holding(client, ticker="EQNR.OL", name="Equinor ASA", currency="NOK")
    body = client.get(f"/sources/holdings/{hid}").json()
    assert body["newsweb"] is True
    assert body["sec_edgar"] is True and "Oslo ticker" in body["sec_edgar_reason"]
