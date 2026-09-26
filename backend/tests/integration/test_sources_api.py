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


# --- ESEF history import (Sprint 10) -------------------------------------------------


def test_esef_index_import_endpoint(client):
    from app.providers.factory import get_esef_index_provider_or_none
    from tests.unit.test_esef_index import LEI, FakeIndex, _three_years

    holding = client.post(
        "/holdings", json={"ticker": "ACME.OL", "name": "ACME ASA", "trading_currency": "NOK"}
    ).json()
    hid = holding["id"]

    before = client.get(f"/sources/holdings/{hid}/esef-index").json()
    assert before["imported"] is False and before["suggested_lei"] is None

    # Switched off -> 422 with a reason.
    off = client.post(f"/sources/holdings/{hid}/esef-index/import", json={"lei": LEI})
    assert off.status_code == 422 and "switched off" in off.json()["detail"]

    app.dependency_overrides[get_esef_index_provider_or_none] = lambda: FakeIndex(_three_years())
    no_lei = client.post(f"/sources/holdings/{hid}/esef-index/import")
    assert no_lei.status_code == 422 and "No LEI found" in no_lei.json()["detail"]

    resp = client.post(f"/sources/holdings/{hid}/esef-index/import", json={"lei": LEI.lower()})
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["imported"] and body["lei"] == LEI
    assert body["periods_imported"] == ["FY2024", "FY2023", "FY2022", "FY2021"]
    assert body["latest_period_in_index"] == "FY2024"
    assert len(body["filings"]) == 3

    again = client.get(f"/sources/holdings/{hid}/esef-index").json()
    assert again["imported"] and again["facts_imported"] == body["facts_imported"]
    assert again["suggested_lei"] == LEI  # from the previous import

    # The imported years feed the metrics panel like uploaded ones: ROE on
    # average equity needs the prior year, which the import supplies.
    metrics = client.get(f"/holdings/{hid}/metrics", params={"period": "FY2023"})
    assert metrics.status_code == 200, metrics.text
    assert "roe" in metrics.json()["computed"]
    eligibility = client.get(f"/sources/holdings/{hid}").json()
    assert eligibility["esef_index"] is True


# --- Newsweb annual-report filing fetch (Sprint 15) -----------------------------


def _newsweb_zip(xhtml_bytes: bytes, *, xhtml_name: str = "acme-2025-12-31-0-en.xhtml") -> bytes:
    import io
    import zipfile

    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w") as zf:
        zf.writestr("META-INF/taxonomyPackage.xml", "<xml/>")
        zf.writestr(f"reports/{xhtml_name}", xhtml_bytes)
    return buf.getvalue()


class FakeNewswebFiling:
    """``refs`` is the full list list_annual_reports() should return (newest
    first) — the "fetch every available year" flow (2026-09-26) always
    calls that, never find_latest_annual_report."""

    name = "Oslo Børs Newsweb"

    def __init__(self, *, refs=None, attachment_bytes=None, fail=None):
        self.refs = refs or []
        # message_id -> bytes, so different years can return different content.
        self.attachment_bytes = attachment_bytes or {}
        self.fail = fail
        self.downloaded: list[tuple[str, str]] = []
        self.list_calls = 0

    def list_annual_reports(self, issuer_sign, *, since, today=None):
        self.list_calls += 1
        if self.fail:
            from app.providers.newsweb_filing_provider import (
                NewswebFilingUnavailableError,
            )

            raise NewswebFilingUnavailableError(self.fail)
        return self.refs

    def download_attachment(self, message_id, attachment_id):
        self.downloaded.append((message_id, attachment_id))
        return self.attachment_bytes[message_id]


@pytest.fixture()
def newsweb_filing():
    from app.providers.factory import get_newsweb_filing_provider_or_none

    fake = FakeNewswebFiling()
    app.dependency_overrides[get_newsweb_filing_provider_or_none] = lambda: fake
    yield fake
    del app.dependency_overrides[get_newsweb_filing_provider_or_none]


def _annual_xhtml(marker: str) -> bytes:
    """The shared iXBRL fixture from test_extraction_ixbrl.py, tagged with
    a distinguishing comment so different "years" in a test don't collide
    on the importer's sha256 de-dup (which is content-based, not
    filename-based) — this suite only needs each fetched year to land as
    its own Document, not that the extracted period label matches ``marker``."""
    from tests.unit.test_extraction_ixbrl import BALANCE, HEAD, INCOME

    return (HEAD + f"<!-- {marker} -->" + INCOME + BALANCE + "</div></body></html>").encode("utf-8")


def test_newsweb_annual_report_import_round_trip(client, db_session, newsweb_filing):
    """A fake Newsweb list -> a .zip attachment -> the real iXBRL extractor
    (same fixture as test_extraction_ixbrl.py) -> facts on the holding,
    exactly as an equivalent manual upload of the same .xhtml would give."""
    from app.providers.newsweb_filing_provider import (
        NewswebAnnualReportRef,
        NewswebAttachmentRef,
    )

    xhtml = _annual_xhtml("2025-12-31")
    newsweb_filing.refs = [
        NewswebAnnualReportRef(
            message_id="670839",
            message_url="https://newsweb.oslobors.no/message/670839",
            title="ACME ASA - Annual Report 2025",
            published_at=datetime(2026, 4, 17, 7, 30, tzinfo=timezone.utc),
            attachments=[
                NewswebAttachmentRef("323509", "ACME ASA - Annual Report 2025.pdf"),
                NewswebAttachmentRef("323510", "acme-2025-12-31-0-en.zip"),
            ],
        )
    ]
    newsweb_filing.attachment_bytes = {"670839": _newsweb_zip(xhtml)}

    hid = _holding(client, ticker="ACME.OL", name="ACME ASA", currency="NOK")

    before = client.get(f"/sources/holdings/{hid}/newsweb-annual-report").json()
    assert before["reports"] == []
    assert before["history_since"] == "2022-01-01"

    resp = client.post(f"/sources/holdings/{hid}/newsweb-annual-report/import")
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["newly_imported_this_run"] == 1
    report = body["reports"][0]
    assert report["message_id"] == "670839"
    assert report["message_url"] == "https://newsweb.oslobors.no/message/670839"
    assert report["attachment_name"] == "acme-2025-12-31-0-en.zip"
    assert report["facts_imported"] > 0
    assert "FY2025" in report["periods_imported"]
    assert newsweb_filing.downloaded == [("670839", "323510")]

    # It's a real Document like any upload: shows up in the documents list,
    # is the right type, and carries Newsweb's own provenance.
    doc = client.get(f"/documents/{report['document_id']}").json()
    assert doc["type"] == "annual_report"
    assert doc["quality_flags"]["newsweb_source"]["message_id"] == "670839"

    # GET now returns the same stored result without re-fetching Newsweb.
    again = client.get(f"/sources/holdings/{hid}/newsweb-annual-report").json()
    assert len(again["reports"]) == 1 and again["reports"][0]["facts_imported"] == report["facts_imported"]
    assert newsweb_filing.list_calls == 1  # GET reads from the DB, doesn't call the provider

    # A second POST doesn't re-download the year already on file.
    again_post = client.post(f"/sources/holdings/{hid}/newsweb-annual-report/import").json()
    assert again_post["newly_imported_this_run"] == 0
    assert again_post["already_on_file_this_run"] == ["ACME ASA - Annual Report 2025"]
    assert newsweb_filing.downloaded == [("670839", "323510")]  # not called again

    eligibility = client.get(f"/sources/holdings/{hid}").json()
    assert eligibility["newsweb_annual_report"] is True


def test_newsweb_annual_report_fetches_every_available_year(client, db_session, newsweb_filing):
    """Faiz's follow-up ask (2026-09-26): don't stop at the newest report —
    pull every year Newsweb has, back to the configured history start."""
    from app.providers.newsweb_filing_provider import (
        NewswebAnnualReportRef,
        NewswebAttachmentRef,
    )

    years = [("2025-12-31", "670839", "323510"), ("2024-12-31", "550001", "220001"), ("2023-12-31", "440001", "110001")]
    newsweb_filing.refs = [
        NewswebAnnualReportRef(
            message_id=mid,
            message_url=f"https://newsweb.oslobors.no/message/{mid}",
            title=f"ACME ASA - Annual Report {period[:4]}",
            published_at=datetime(int(period[:4]) + 1, 4, 1, tzinfo=timezone.utc),
            attachments=[NewswebAttachmentRef(att, f"acme-{period}-0-en.zip")],
        )
        for period, mid, att in years
    ]
    newsweb_filing.attachment_bytes = {
        mid: _newsweb_zip(_annual_xhtml(period)) for period, mid, _ in years
    }

    hid = _holding(client, ticker="ACME.OL", name="ACME ASA", currency="NOK")
    resp = client.post(f"/sources/holdings/{hid}/newsweb-annual-report/import")
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["newly_imported_this_run"] == 3
    assert len(body["reports"]) == 3
    assert sorted(newsweb_filing.downloaded) == sorted((mid, att) for _, mid, att in years)

    # Newest first.
    assert [r["message_id"] for r in body["reports"]] == ["670839", "550001", "440001"]


def test_newsweb_annual_report_bare_xhtml_attachment_no_zip(client, db_session, newsweb_filing):
    from app.providers.newsweb_filing_provider import (
        NewswebAnnualReportRef,
        NewswebAttachmentRef,
    )

    xhtml = _annual_xhtml("2025-12-31")
    newsweb_filing.refs = [
        NewswebAnnualReportRef(
            message_id="1", message_url="https://newsweb.oslobors.no/message/1",
            title="ACME ASA - Annual Report 2025", published_at=None,
            attachments=[NewswebAttachmentRef("2", "acme-2025.xhtml")],
        )
    ]
    newsweb_filing.attachment_bytes = {"1": xhtml}

    hid = _holding(client, ticker="ACME.OL", name="ACME ASA", currency="NOK")
    resp = client.post(f"/sources/holdings/{hid}/newsweb-annual-report/import")
    assert resp.status_code == 200, resp.text
    assert resp.json()["reports"][0]["attachment_name"] == "acme-2025.xhtml"


def test_newsweb_annual_report_pdf_only_is_skipped_not_fatal(client, db_session, newsweb_filing):
    from app.providers.newsweb_filing_provider import (
        NewswebAnnualReportRef,
        NewswebAttachmentRef,
    )

    newsweb_filing.refs = [
        NewswebAnnualReportRef(
            message_id="1", message_url="https://newsweb.oslobors.no/message/1",
            title="ACME ASA - Annual Report 2025", published_at=None,
            attachments=[NewswebAttachmentRef("2", "ACME Annual Report.pdf")],
        )
    ]
    hid = _holding(client, ticker="ACME.OL", name="ACME ASA", currency="NOK")
    resp = client.post(f"/sources/holdings/{hid}/newsweb-annual-report/import")
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["newly_imported_this_run"] == 0
    assert body["no_esef_file_this_run"] == ["ACME ASA - Annual Report 2025"]
    assert body["reports"] == []


def test_newsweb_annual_report_none_found_is_422(client, db_session, newsweb_filing):
    newsweb_filing.refs = []
    hid = _holding(client, ticker="ACME.OL", name="ACME ASA", currency="NOK")
    resp = client.post(f"/sources/holdings/{hid}/newsweb-annual-report/import")
    assert resp.status_code == 422
    assert "no ANNUAL FINANCIAL REPORT" in resp.json()["detail"]


def test_newsweb_annual_report_provider_failure_is_422_not_500(client, db_session, newsweb_filing):
    newsweb_filing.fail = "Newsweb returned HTTP 500"
    hid = _holding(client, ticker="ACME.OL", name="ACME ASA", currency="NOK")
    resp = client.post(f"/sources/holdings/{hid}/newsweb-annual-report/import")
    assert resp.status_code == 422
    assert "500" in resp.json()["detail"]


def test_newsweb_annual_report_not_applicable_for_us_holding(client, db_session):
    hid = _holding(client)
    resp = client.post(f"/sources/holdings/{hid}/newsweb-annual-report/import")
    assert resp.status_code == 422
    assert "Oslo" in resp.json()["detail"]


def test_newsweb_annual_report_switched_off_is_422(client, db_session):
    from app.providers.factory import get_newsweb_filing_provider_or_none

    app.dependency_overrides[get_newsweb_filing_provider_or_none] = lambda: None
    hid = _holding(client, ticker="ACME.OL", name="ACME ASA", currency="NOK")
    resp = client.post(f"/sources/holdings/{hid}/newsweb-annual-report/import")
    assert resp.status_code == 422 and "switched off" in resp.json()["detail"]
    del app.dependency_overrides[get_newsweb_filing_provider_or_none]
