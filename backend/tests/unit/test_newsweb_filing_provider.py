"""Unit tests for app.providers.newsweb_filing_provider (fixtures shaped
like the live api3.oslo.oslobors.no responses confirmed 2026-09-26 by
inspecting the real newsweb.oslobors.no SPA's own network calls for
Nykode Therapeutics' real Annual Report 2025 filing)."""
from __future__ import annotations

import io
import zipfile
from datetime import date, datetime, timezone

import httpx
import pytest

from app.providers.newsweb_filing_provider import (
    NewswebAttachmentRef,
    NewswebFilingProvider,
    NewswebFilingUnavailableError,
    ZipHasNoReportError,
    extract_xhtml_from_zip,
    parse_annual_report_list,
    parse_message_attachments,
    pick_esef_attachment,
)

NOW = datetime(2026, 9, 26, tzinfo=timezone.utc)


def _msg(mid, title, *, sign="NYKD", category_id=1001, published="2026-04-17T07:30:00Z", attachments=1, **extra):
    base = {
        "id": mid, "messageId": mid, "title": title,
        "category": [{"id": category_id, "category_no": "ÅRSRAPPORT", "category_en": "ANNUAL FINANCIAL REPORT"}],
        "issuerSign": sign, "issuerName": "Nykode Therapeutics ASA", "publishedTime": published,
        "test": False, "numbAttachments": attachments,
    }
    base.update(extra)
    return base


def _list_payload(*messages):
    return {"header": {}, "data": {"messages": list(messages)}}


def _message_payload(mid, attachments):
    return {"header": {}, "data": {"message": {"id": mid, "attachments": attachments}}}


def test_parse_annual_report_list_filters_category_issuer_and_attachments():
    rows = parse_annual_report_list(
        _list_payload(
            _msg(670839, "Nykode Therapeutics - Annual Report 2025"),
            _msg(666642, "Nykode Therapeutics - Quarterly Report Q4 2025", category_id=1002),
            _msg(1, "Someone else's annual report", sign="ORK"),
            _msg(2, "No attachment", attachments=0),
        ),
        issuer_sign="NYKD",
    )
    assert [r[0] for r in rows] == ["670839"]
    assert rows[0][1] == "Nykode Therapeutics - Annual Report 2025"
    assert rows[0][2].tzinfo is not None


def test_parse_annual_report_list_sorts_newest_first():
    rows = parse_annual_report_list(
        _list_payload(
            _msg(1, "Older", published="2025-04-01T00:00:00Z"),
            _msg(2, "Newer", published="2026-04-17T07:30:00Z"),
        ),
        issuer_sign="NYKD",
    )
    assert [r[0] for r in rows] == ["2", "1"]


def test_parse_annual_report_list_malformed_payload_fails_visibly():
    with pytest.raises(NewswebFilingUnavailableError):
        parse_annual_report_list({"nope": 1}, issuer_sign="NYKD")


def test_parse_message_attachments():
    attachments = parse_message_attachments(
        _message_payload(
            670839,
            [
                {"id": 323509, "name": "Nykode Therapeutics ASA - Annual Report 2025.pdf"},
                {"id": 323510, "name": "nykode-2025-12-31-0-en.zip"},
            ],
        )
    )
    assert attachments == [
        NewswebAttachmentRef(attachment_id="323509", name="Nykode Therapeutics ASA - Annual Report 2025.pdf"),
        NewswebAttachmentRef(attachment_id="323510", name="nykode-2025-12-31-0-en.zip"),
    ]


def test_parse_message_attachments_malformed_fails_visibly():
    with pytest.raises(NewswebFilingUnavailableError):
        parse_message_attachments({"data": {"message": {}}})


def test_pick_esef_attachment_prefers_zip_over_pdf():
    attachments = [
        NewswebAttachmentRef("1", "Report.pdf"),
        NewswebAttachmentRef("2", "acme-2025-12-31-0-en.zip"),
    ]
    assert pick_esef_attachment(attachments).name == "acme-2025-12-31-0-en.zip"


def test_pick_esef_attachment_falls_back_to_bare_xhtml():
    attachments = [NewswebAttachmentRef("1", "Report.pdf"), NewswebAttachmentRef("2", "acme-2025.xhtml")]
    assert pick_esef_attachment(attachments).name == "acme-2025.xhtml"


def test_pick_esef_attachment_none_when_pdf_only():
    assert pick_esef_attachment([NewswebAttachmentRef("1", "Report.pdf")]) is None


def _zip_bytes(members: dict[str, bytes]) -> bytes:
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w") as zf:
        for name, content in members.items():
            zf.writestr(name, content)
    return buf.getvalue()


def test_extract_xhtml_from_zip_picks_largest_report_not_viewer_copy():
    data = _zip_bytes(
        {
            "META-INF/taxonomyPackage.xml": b"<xml/>",
            "reports/viewer/acme-2025-viewer.xhtml": b"<html>viewer copy, small</html>",
            "reports/acme-2025-12-31-0-en.xhtml": b"<html>" + b"x" * 500 + b"</html>",
        }
    )
    filename, content = extract_xhtml_from_zip(data, max_member_bytes=10_000_000)
    assert filename == "acme-2025-12-31-0-en.xhtml"
    assert content.startswith(b"<html>x")


def test_extract_xhtml_from_zip_no_report_member_fails_visibly():
    data = _zip_bytes({"META-INF/taxonomyPackage.xml": b"<xml/>"})
    with pytest.raises(ZipHasNoReportError):
        extract_xhtml_from_zip(data, max_member_bytes=10_000_000)


def test_extract_xhtml_from_zip_bad_zip_fails_visibly():
    with pytest.raises(NewswebFilingUnavailableError):
        extract_xhtml_from_zip(b"not a zip", max_member_bytes=10_000_000)


def test_extract_xhtml_from_zip_over_limit_fails_visibly():
    data = _zip_bytes({"reports/big.xhtml": b"x" * 1000})
    with pytest.raises(NewswebFilingUnavailableError, match="limit"):
        extract_xhtml_from_zip(data, max_member_bytes=100)


def test_provider_find_latest_annual_report_fetches_attachments():
    calls: list[httpx.Request] = []

    def handler(request: httpx.Request) -> httpx.Response:
        calls.append(request)
        if "list" in str(request.url):
            assert dict(request.url.params)["category"] == "1001"
            assert dict(request.url.params)["issuer"] == "NYKD"
            return httpx.Response(200, json=_list_payload(_msg(670839, "Nykode Therapeutics - Annual Report 2025")))
        assert dict(request.url.params)["messageId"] == "670839"
        return httpx.Response(
            200,
            json=_message_payload(
                670839,
                [
                    {"id": 323509, "name": "Report.pdf"},
                    {"id": 323510, "name": "nykode-2025-12-31-0-en.zip"},
                ],
            ),
        )

    provider = NewswebFilingProvider(client=httpx.Client(transport=httpx.MockTransport(handler)))
    ref = provider.find_latest_annual_report(["NYKD", "OL"][0], today=date(2026, 9, 26))
    assert ref is not None
    assert ref.message_id == "670839"
    assert ref.message_url == "https://newsweb.oslobors.no/message/670839"
    assert [a.name for a in ref.attachments] == ["Report.pdf", "nykode-2025-12-31-0-en.zip"]
    assert len(calls) == 2


def test_provider_find_latest_annual_report_none_when_no_rows():
    provider = NewswebFilingProvider(
        client=httpx.Client(transport=httpx.MockTransport(lambda r: httpx.Response(200, json=_list_payload())))
    )
    assert provider.find_latest_annual_report("XXXX") is None


def test_provider_download_attachment():
    def handler(request: httpx.Request) -> httpx.Response:
        params = dict(request.url.params)
        assert params == {"messageId": "670839", "attachmentId": "323510"}
        return httpx.Response(200, content=b"PK\x03\x04fake-zip-bytes")

    provider = NewswebFilingProvider(client=httpx.Client(transport=httpx.MockTransport(handler)))
    assert provider.download_attachment("670839", "323510") == b"PK\x03\x04fake-zip-bytes"


def test_provider_download_attachment_over_limit_fails_visibly():
    provider = NewswebFilingProvider(
        max_download_bytes=10,
        client=httpx.Client(transport=httpx.MockTransport(lambda r: httpx.Response(200, content=b"x" * 100))),
    )
    with pytest.raises(NewswebFilingUnavailableError, match="limit"):
        provider.download_attachment("1", "2")


def test_provider_http_error_is_unavailable():
    provider = NewswebFilingProvider(
        client=httpx.Client(transport=httpx.MockTransport(lambda r: httpx.Response(500)))
    )
    with pytest.raises(NewswebFilingUnavailableError, match="500"):
        provider.find_latest_annual_report("NYKD")
