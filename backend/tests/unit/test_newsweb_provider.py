"""Unit tests for app.providers.newsweb_provider (fixture shaped like the
live api3.oslo.oslobors.no response confirmed 2026-09-22)."""
from __future__ import annotations

from datetime import date, datetime, timezone

import httpx
import pytest

from app.providers.base import ResearchUnavailableError
from app.providers.newsweb_provider import (
    NewswebAnnouncementsProvider,
    issuer_sign_for_ticker,
    parse_messages,
)

NOW = datetime(2026, 9, 22, tzinfo=timezone.utc)


def _msg(mid, title, sign="VAR", published="2026-09-15T15:08:17.237Z", **extra):
    base = {
        "id": mid, "messageId": mid, "title": title,
        "category": [{"id": 1, "category_no": "X", "category_en": "INSIDE INFORMATION"}],
        "issuerSign": sign, "issuerName": "Vår Energi ASA", "publishedTime": published,
        "test": False, "numbAttachments": 1, "correctionForMessageId": 0,
    }
    base.update(extra)
    return base


def _payload(*messages):
    return {"header": {}, "data": {"messages": list(messages), "overflow": False}}


def test_parses_and_sorts_newest_first():
    items = parse_messages(
        _payload(
            _msg(1, "Older", published="2026-09-01T00:00:00Z"),
            _msg(2, "Newer", published="2026-09-16T05:00:16.428Z"),
        ),
        issuer_sign="VAR", retrieved_at=NOW,
    )
    assert [i.title for i in items] == ["Newer", "Older"]
    assert items[0].source_url == "https://newsweb.oslobors.no/message/2"
    assert items[0].source_type == "regulatory_announcement"
    assert "INSIDE INFORMATION" in items[0].summary
    assert items[0].published_at.tzinfo is not None


def test_drops_other_issuers_and_test_messages():
    items = parse_messages(
        _payload(_msg(1, "Mine"), _msg(2, "Theirs", sign="EQNR"), _msg(3, "Test", test=True)),
        issuer_sign="VAR", retrieved_at=NOW,
    )
    assert [i.title for i in items] == ["Mine"]


def test_malformed_payload_fails_visibly():
    with pytest.raises(ResearchUnavailableError):
        parse_messages({"nope": 1}, issuer_sign="VAR", retrieved_at=NOW)


def test_issuer_sign_for_ticker():
    assert issuer_sign_for_ticker("var.ol") == "VAR"


def test_provider_sends_issuer_and_date_window():
    captured = {}

    def handler(request: httpx.Request):
        captured.update(dict(request.url.params))
        return httpx.Response(200, json=_payload(_msg(9, "Q2 report")))

    provider = NewswebAnnouncementsProvider(
        lookback_days=30, client=httpx.Client(transport=httpx.MockTransport(handler))
    )
    items = provider.get_announcements("VAR.OL", today=date(2026, 9, 22))
    assert captured == {"issuer": "VAR", "fromDate": "2026-08-23", "toDate": "2026-09-22"}
    assert items[0].title == "Q2 report"


def test_provider_http_error_is_unavailable():
    provider = NewswebAnnouncementsProvider(
        client=httpx.Client(transport=httpx.MockTransport(lambda r: httpx.Response(500)))
    )
    with pytest.raises(ResearchUnavailableError, match="500"):
        provider.get_announcements("VAR.OL")
