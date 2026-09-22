"""Oslo Børs Newsweb regulated-announcement provider (2026-09-22).

Newsweb (https://newsweb.oslobors.no) is the official feed every Oslo
Børs / Euronext Oslo issuer must publish regulated information to:
quarterly reports, insider trades, buy-backs, material events. Its public
web app reads a keyless JSON endpoint:

    GET https://api3.oslo.oslobors.no/v1/newsreader/list
        ?issuer=<issuer sign>&fromDate=YYYY-MM-DD&toDate=YYYY-MM-DD

returning ``{"data": {"messages": [...]}}`` where each message carries
``messageId``, ``title``, ``issuerSign``, ``issuerName``,
``publishedTime`` (ISO UTC), ``category`` (``[{category_en, category_no}]``)
and ``numbAttachments``. Shape confirmed against the live endpoint
2026-09-22. It is an undocumented endpoint behind a public site, not a
contracted API — every parse here is defensive and any surprise raises
ResearchUnavailableError (fail visibly) rather than inventing data.

Only announcement *metadata* is captured (title, category, date, link) —
not the body text. CLAUDE.md Rule 5: titles are issuer-written text and
reach the LLM only inside the evidence packet, framed as data to cite.
"""
from __future__ import annotations

from datetime import date, datetime, timedelta, timezone
from typing import Any

import httpx

from app.providers.base import ResearchItem, ResearchUnavailableError

_PROVIDER_NAME = "Oslo Børs Newsweb"
LIST_URL = "https://api3.oslo.oslobors.no/v1/newsreader/list"
MESSAGE_URL = "https://newsweb.oslobors.no/message/{message_id}"
SOURCE_TYPE = "regulatory_announcement"


def issuer_sign_for_ticker(ticker: str) -> str:
    """'VAR.OL' -> 'VAR'. Newsweb keys issuers by their Oslo ticker sign."""
    return ticker.strip().upper().split(".", 1)[0]


def _parse_time(value: Any) -> datetime | None:
    if not isinstance(value, str) or not value:
        return None
    try:
        parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        return None
    return parsed if parsed.tzinfo else parsed.replace(tzinfo=timezone.utc)


def parse_messages(payload: Any, *, issuer_sign: str, retrieved_at: datetime) -> list[ResearchItem]:
    """Pure parse of a list payload — unit-tested against a fixture."""
    if not isinstance(payload, dict) or not isinstance(payload.get("data"), dict):
        raise ResearchUnavailableError("Newsweb response had no 'data' object")
    messages = payload["data"].get("messages")
    if not isinstance(messages, list):
        raise ResearchUnavailableError("Newsweb response had no 'data.messages' list")

    items: list[ResearchItem] = []
    for message in messages:
        if not isinstance(message, dict) or message.get("test"):
            continue
        # The issuer filter is server-side; double-check it so a changed
        # endpoint can never attach another company's news to this holding.
        if str(message.get("issuerSign", "")).upper() != issuer_sign:
            continue
        message_id = message.get("messageId") or message.get("id")
        title = str(message.get("title") or "").strip()
        if not message_id or not title:
            continue
        categories = [
            str(c.get("category_en") or c.get("category_no") or "").strip()
            for c in message.get("category") or []
            if isinstance(c, dict)
        ]
        category_text = "; ".join(c for c in categories if c) or "Uncategorised"
        published_at = _parse_time(message.get("publishedTime"))
        attachments = message.get("numbAttachments") or 0
        summary = (
            f"Regulated announcement by {message.get('issuerName') or issuer_sign} ({issuer_sign}). "
            f"Category: {category_text}. "
            f"Published: {published_at.date().isoformat() if published_at else 'unknown'}. "
            f"Attachments: {attachments}."
        )
        if message.get("correctionForMessageId"):
            summary += f" Corrects announcement {message['correctionForMessageId']}."
        items.append(
            ResearchItem(
                source_url=MESSAGE_URL.format(message_id=message_id),
                source_name=_PROVIDER_NAME,
                title=title,
                summary=summary,
                source_type=SOURCE_TYPE,
                retrieved_at=retrieved_at,
                published_at=published_at,
            )
        )
    items.sort(key=lambda i: i.published_at or datetime.min.replace(tzinfo=timezone.utc), reverse=True)
    return items


class NewswebAnnouncementsProvider:
    name = _PROVIDER_NAME

    def __init__(
        self,
        *,
        lookback_days: int = 365,
        timeout_seconds: float = 20.0,
        client: httpx.Client | None = None,
    ) -> None:
        self._lookback_days = lookback_days
        self._timeout = timeout_seconds
        self._client = client

    def get_announcements(self, ticker: str, *, today: date | None = None) -> list[ResearchItem]:
        issuer_sign = issuer_sign_for_ticker(ticker)
        if not issuer_sign:
            raise ResearchUnavailableError("no issuer sign derivable from ticker")
        end = today or datetime.now(timezone.utc).date()
        start = end - timedelta(days=self._lookback_days)
        params = {"issuer": issuer_sign, "fromDate": start.isoformat(), "toDate": end.isoformat()}
        client = self._client or httpx.Client(timeout=self._timeout)
        try:
            try:
                response = client.get(LIST_URL, params=params, headers={"Accept": "application/json"})
            except httpx.HTTPError as exc:
                raise ResearchUnavailableError(f"Newsweb request failed: {exc}") from exc
            if response.status_code != 200:
                raise ResearchUnavailableError(f"Newsweb returned HTTP {response.status_code}")
            try:
                payload = response.json()
            except ValueError as exc:
                raise ResearchUnavailableError("Newsweb returned non-JSON") from exc
        finally:
            if self._client is None:
                client.close()
        return parse_messages(payload, issuer_sign=issuer_sign, retrieved_at=datetime.now(timezone.utc))
