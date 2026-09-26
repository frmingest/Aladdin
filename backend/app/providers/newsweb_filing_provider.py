"""Oslo Børs Newsweb annual-report *filing* fetch (Sprint 15, 2026-09-26).

Companion to app/providers/newsweb_provider.py, which only ever reads
announcement *metadata* (title, category, date — CLAUDE.md Rule 5 keeps
issuer body text away from the LLM). This module goes one step further and
downloads the actual ESEF filing attached to a company's "ANNUAL FINANCIAL
REPORT" announcement, so its .xhtml can be run through the same iXBRL
extractor an upload uses (app/services/filings/newsweb_annual_report.py).

Three keyless api3.oslo.oslobors.no endpoints, all confirmed live
2026-09-26 (by inspecting the real newsweb.oslobors.no SPA's own network
calls for a real filing, Nykode Therapeutics' Annual Report 2025):

    GET /v1/newsreader/list?issuer=<sign>&category=1001&fromDate=&toDate=
        -> {"data": {"messages": [...]}}, one row per announcement.
        category 1001 is Oslo Børs' own taxonomy id for "ANNUAL FINANCIAL
        REPORT" (Norwegian: ÅRSRAPPORT) — confirmed against the live list,
        it is stable across issuers, not a per-company label.

    GET /v1/newsreader/message?messageId=<id>
        -> {"data": {"message": {..., "attachments": [{"id", "name"}, ...]}}}
        The list endpoint only gives a count (numbAttachments); the actual
        attachment ids/names need this per-message call.

    GET /v1/newsreader/attachment?messageId=<id>&attachmentId=<attId>
        -> the raw file bytes (a PDF, or an ESEF .zip/.xhtml).

Like newsweb_provider.py, this is an undocumented endpoint behind a public
site, not a contracted API: every parse is defensive and anything
unexpected raises NewswebFilingUnavailableError (fail visibly) rather than
guessing.
"""
from __future__ import annotations

import io
import zipfile
from dataclasses import dataclass, field
from datetime import date, datetime, timedelta, timezone
from typing import Any

import httpx

from app.providers.base import ResearchUnavailableError

LIST_URL = "https://api3.oslo.oslobors.no/v1/newsreader/list"
MESSAGE_URL = "https://api3.oslo.oslobors.no/v1/newsreader/message"
ATTACHMENT_URL = "https://api3.oslo.oslobors.no/v1/newsreader/attachment"
MESSAGE_PAGE_URL = "https://newsweb.oslobors.no/message/{message_id}"

# Oslo Børs' own category id for "ANNUAL FINANCIAL REPORT" (ÅRSRAPPORT) —
# confirmed against the live list endpoint, not guessed from a title match.
ANNUAL_REPORT_CATEGORY_ID = 1001

# ESEF packages carry the report text, the taxonomy and (often) an iXBRL
# viewer bundled together; the report itself is always the largest
# .xhtml/.htm(l) member by a wide margin. "viewer" copies of the same
# report are excluded outright rather than risked as the pick.
_REPORT_EXTENSIONS = (".xhtml", ".htm", ".html")


class NewswebFilingUnavailableError(ResearchUnavailableError):
    """The filing list/detail/attachment fetch failed, or returned
    something unusable. Mirrors ResearchUnavailableError's role for the
    announcements-metadata provider: callers show the message, they don't
    invent a result."""


@dataclass(frozen=True)
class NewswebAttachmentRef:
    attachment_id: str
    name: str


@dataclass(frozen=True)
class NewswebAnnualReportRef:
    message_id: str
    message_url: str
    title: str
    published_at: datetime | None
    attachments: list[NewswebAttachmentRef] = field(default_factory=list)


def _parse_time(value: Any) -> datetime | None:
    if not isinstance(value, str) or not value:
        return None
    try:
        parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        return None
    return parsed if parsed.tzinfo else parsed.replace(tzinfo=timezone.utc)


def _has_annual_report_category(message: dict[str, Any]) -> bool:
    for cat in message.get("category") or []:
        if isinstance(cat, dict) and cat.get("id") == ANNUAL_REPORT_CATEGORY_ID:
            return True
    return False


def parse_annual_report_list(payload: Any, *, issuer_sign: str) -> list[tuple[str, str, datetime | None]]:
    """Pure parse of a /list payload -> [(message_id, title, published_at)],
    newest first, restricted to this issuer's ANNUAL FINANCIAL REPORT rows
    with at least one attachment. Unit-tested against a fixture."""
    if not isinstance(payload, dict) or not isinstance(payload.get("data"), dict):
        raise NewswebFilingUnavailableError("Newsweb response had no 'data' object")
    messages = payload["data"].get("messages")
    if not isinstance(messages, list):
        raise NewswebFilingUnavailableError("Newsweb response had no 'data.messages' list")

    rows: list[tuple[str, str, datetime | None]] = []
    for message in messages:
        if not isinstance(message, dict) or message.get("test"):
            continue
        if str(message.get("issuerSign", "")).upper() != issuer_sign:
            continue
        if not _has_annual_report_category(message):
            continue
        if not (message.get("numbAttachments") or 0):
            continue
        message_id = message.get("messageId") or message.get("id")
        title = str(message.get("title") or "").strip()
        if not message_id or not title:
            continue
        rows.append((str(message_id), title, _parse_time(message.get("publishedTime"))))
    rows.sort(key=lambda r: r[2] or datetime.min.replace(tzinfo=timezone.utc), reverse=True)
    return rows


def parse_message_attachments(payload: Any) -> list[NewswebAttachmentRef]:
    """Pure parse of a /message payload -> its attachments. Unit-tested."""
    if not isinstance(payload, dict) or not isinstance(payload.get("data"), dict):
        raise NewswebFilingUnavailableError("Newsweb message response had no 'data' object")
    message = payload["data"].get("message")
    if not isinstance(message, dict):
        raise NewswebFilingUnavailableError("Newsweb message response had no 'data.message' object")
    attachments = message.get("attachments")
    if not isinstance(attachments, list):
        raise NewswebFilingUnavailableError("Newsweb message response had no 'attachments' list")
    out: list[NewswebAttachmentRef] = []
    for att in attachments:
        if not isinstance(att, dict):
            continue
        att_id = att.get("id")
        name = str(att.get("name") or "").strip()
        if att_id is None or not name:
            continue
        out.append(NewswebAttachmentRef(attachment_id=str(att_id), name=name))
    return out


def pick_esef_attachment(attachments: list[NewswebAttachmentRef]) -> NewswebAttachmentRef | None:
    """The one attachment worth extracting facts from: a .zip (an ESEF
    package almost always ships this way) takes priority over a bare
    .xhtml/.htm attachment; a PDF-only filing (no ESEF published) is None."""
    for att in attachments:
        if att.name.lower().endswith(".zip"):
            return att
    for att in attachments:
        if att.name.lower().endswith(_REPORT_EXTENSIONS):
            return att
    return None


class ZipHasNoReportError(NewswebFilingUnavailableError):
    """The .zip attachment had no .xhtml/.htm(l) member to extract."""


def extract_xhtml_from_zip(data: bytes, *, max_member_bytes: int) -> tuple[str, bytes]:
    """(filename, content) of the report inside an ESEF .zip package.

    ESEF packages are a folder structure (META-INF/, a reports/ folder,
    sometimes a bundled iXBRL viewer copy of the same file) — never a bare
    file at the zip root — so this walks every member rather than assuming
    a fixed path. "viewer" copies are skipped outright; among what's left,
    the report is always the largest .xhtml/.htm(l) member by a wide
    margin (everything else in the package is taxonomy/schema/asset
    files), so picking the largest is a safe, deterministic heuristic that
    needs no per-jurisdiction path convention.
    """
    try:
        archive = zipfile.ZipFile(io.BytesIO(data))
    except zipfile.BadZipFile as exc:
        raise NewswebFilingUnavailableError(f"the attachment is not a valid .zip file: {exc}") from exc

    candidates = [
        info
        for info in archive.infolist()
        if not info.is_dir()
        and info.filename.lower().endswith(_REPORT_EXTENSIONS)
        and "viewer" not in info.filename.lower()
    ]
    if not candidates:
        candidates = [
            info
            for info in archive.infolist()
            if not info.is_dir() and info.filename.lower().endswith(_REPORT_EXTENSIONS)
        ]
    if not candidates:
        raise ZipHasNoReportError("the ESEF package has no .xhtml/.htm(l) report file inside it")

    chosen = max(candidates, key=lambda info: info.file_size)
    if chosen.file_size > max_member_bytes:
        raise NewswebFilingUnavailableError(
            f"'{chosen.filename}' inside the package is {chosen.file_size / 1_048_576:.1f} MB, "
            f"over the {max_member_bytes / 1_048_576:.0f} MB limit"
        )
    content = archive.read(chosen)
    filename = chosen.filename.rsplit("/", 1)[-1]
    return filename, content


class NewswebFilingProvider:
    name = "Oslo Børs Newsweb"

    def __init__(
        self,
        *,
        lookback_days: int = 730,
        timeout_seconds: float = 30.0,
        max_download_bytes: int = 300 * 1024 * 1024,
        client: httpx.Client | None = None,
    ) -> None:
        self._lookback_days = lookback_days
        self._timeout = timeout_seconds
        self._max_download_bytes = max_download_bytes
        self._client = client

    def _get_json(self, url: str, params: dict[str, str]) -> Any:
        client = self._client or httpx.Client(timeout=self._timeout)
        try:
            try:
                response = client.get(url, params=params, headers={"Accept": "application/json"})
            except httpx.HTTPError as exc:
                raise NewswebFilingUnavailableError(f"Newsweb request failed: {exc}") from exc
            if response.status_code != 200:
                raise NewswebFilingUnavailableError(f"Newsweb returned HTTP {response.status_code}")
            try:
                return response.json()
            except ValueError as exc:
                raise NewswebFilingUnavailableError("Newsweb returned non-JSON") from exc
        finally:
            if self._client is None:
                client.close()

    def find_latest_annual_report(
        self, issuer_sign: str, *, today: date | None = None
    ) -> NewswebAnnualReportRef | None:
        """The newest ANNUAL FINANCIAL REPORT announcement for this issuer,
        with its attachments already fetched — or None if Newsweb has no
        such announcement in the lookback window."""
        issuer_sign = issuer_sign.strip().upper()
        end = today or datetime.now(timezone.utc).date()
        start = end - timedelta(days=self._lookback_days)
        payload = self._get_json(
            LIST_URL,
            {
                "issuer": issuer_sign,
                "category": str(ANNUAL_REPORT_CATEGORY_ID),
                "fromDate": start.isoformat(),
                "toDate": end.isoformat(),
            },
        )
        rows = parse_annual_report_list(payload, issuer_sign=issuer_sign)
        if not rows:
            return None
        message_id, title, published_at = rows[0]
        attachments = self.get_message_attachments(message_id)
        return NewswebAnnualReportRef(
            message_id=message_id,
            message_url=MESSAGE_PAGE_URL.format(message_id=message_id),
            title=title,
            published_at=published_at,
            attachments=attachments,
        )

    def get_message_attachments(self, message_id: str) -> list[NewswebAttachmentRef]:
        payload = self._get_json(MESSAGE_URL, {"messageId": str(message_id)})
        return parse_message_attachments(payload)

    def download_attachment(self, message_id: str, attachment_id: str) -> bytes:
        client = self._client or httpx.Client(timeout=self._timeout)
        try:
            try:
                response = client.get(
                    ATTACHMENT_URL,
                    params={"messageId": str(message_id), "attachmentId": str(attachment_id)},
                )
            except httpx.HTTPError as exc:
                raise NewswebFilingUnavailableError(f"Newsweb attachment request failed: {exc}") from exc
            if response.status_code != 200:
                raise NewswebFilingUnavailableError(
                    f"Newsweb returned HTTP {response.status_code} fetching the attachment"
                )
            content = response.content
            if len(content) > self._max_download_bytes:
                raise NewswebFilingUnavailableError(
                    f"attachment is {len(content) / 1_048_576:.1f} MB, over the "
                    f"{self._max_download_bytes / 1_048_576:.0f} MB limit"
                )
            return content
        finally:
            if self._client is None:
                client.close()
