"""Oslo Børs Newsweb annual/interim-report *filing* fetch (Sprint 15,
2026-09-26; extended 2026-09-26 to also cover half-year/interim reports,
category 1002 — Faiz's ask after a document-sources investigation found
Newsweb's other announcement categories).

Companion to app/providers/newsweb_provider.py, which only ever reads
announcement *metadata* (title, category, date — CLAUDE.md Rule 5 keeps
issuer body text away from the LLM). This module goes one step further and
downloads the actual filing attached to one of a company's regulated
report announcements, so it can be run through the same ingestion pipeline
an upload uses (app/services/filings/newsweb_annual_report.py).

Three keyless api3.oslo.oslobors.no endpoints, all confirmed live
2026-09-26 (by inspecting the real newsweb.oslobors.no SPA's own network
calls for a real filing, Nykode Therapeutics' Annual Report 2025):

    GET /v1/newsreader/list?issuer=<sign>&category=1001&fromDate=&toDate=
        -> {"data": {"messages": [...]}}, one row per announcement.
        category 1001 is Oslo Børs' own taxonomy id for "ANNUAL FINANCIAL
        REPORT" (Norwegian: ÅRSRAPPORT); 1002 is "HALF YEAR FINANCIAL
        REPORT" (HALVÅRSRAPPORT) — both confirmed against the live list,
        stable across issuers, not a per-company label.

    GET /v1/newsreader/message?messageId=<id>
        -> {"data": {"message": {..., "attachments": [{"id", "name"}, ...]}}}
        The list endpoint only gives a count (numbAttachments); the actual
        attachment ids/names need this per-message call.

    GET /v1/newsreader/attachment?messageId=<id>&attachmentId=<attId>
        -> the raw file bytes (a PDF, or an ESEF .zip/.xhtml).

Important asymmetry between the two categories: ESEF/iXBRL tagging is an EU
Transparency Directive requirement for *annual* financial reports only —
Norwegian issuers essentially never tag their half-year report, so its
Newsweb attachment is almost always a plain PDF. A PDF still gets ingested
(page text -> citable evidence) but yields no structured financial facts,
per CLAUDE.md Rule 1 (no arithmetic/fact promotion from PDFs — see
app/services/documents/extraction/pdf.py). ``pick_report_attachment``
reflects this: annual imports still require an ESEF file (as before, no
behaviour change); interim imports accept a PDF fallback because that is
normally all that exists.

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

# Oslo Børs' own category ids — confirmed against the live list endpoint,
# not guessed from a title match.
ANNUAL_REPORT_CATEGORY_ID = 1001  # ÅRSRAPPORT / ANNUAL FINANCIAL REPORT
INTERIM_REPORT_CATEGORY_ID = 1002  # HALVÅRSRAPPORT / HALF YEAR FINANCIAL REPORT

_CATEGORY_LABELS = {
    ANNUAL_REPORT_CATEGORY_ID: "ANNUAL FINANCIAL REPORT",
    INTERIM_REPORT_CATEGORY_ID: "HALF YEAR FINANCIAL REPORT",
}

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


def _has_category(message: dict[str, Any], category_id: int) -> bool:
    for cat in message.get("category") or []:
        if isinstance(cat, dict) and cat.get("id") == category_id:
            return True
    return False


def parse_report_list(
    payload: Any, *, issuer_sign: str, category_id: int
) -> list[tuple[str, str, datetime | None]]:
    """Pure parse of a /list payload -> [(message_id, title, published_at)],
    newest first, restricted to this issuer's rows of the given category
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
        if not _has_category(message, category_id):
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


def parse_annual_report_list(payload: Any, *, issuer_sign: str) -> list[tuple[str, str, datetime | None]]:
    """Back-compat wrapper: annual reports only (category 1001)."""
    return parse_report_list(payload, issuer_sign=issuer_sign, category_id=ANNUAL_REPORT_CATEGORY_ID)


def parse_interim_report_list(payload: Any, *, issuer_sign: str) -> list[tuple[str, str, datetime | None]]:
    """Half-year/interim reports only (category 1002)."""
    return parse_report_list(payload, issuer_sign=issuer_sign, category_id=INTERIM_REPORT_CATEGORY_ID)


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


def pick_report_attachment(
    attachments: list[NewswebAttachmentRef], *, allow_pdf_fallback: bool
) -> tuple[NewswebAttachmentRef | None, bool]:
    """(attachment, is_esef). Same ESEF preference as pick_esef_attachment;
    when nothing ESEF-tagged is published and allow_pdf_fallback is True
    (interim reports — see module docstring), falls back to the first PDF
    so the report is at least ingested as text evidence, with no financial
    facts promoted. Annual imports pass allow_pdf_fallback=False, keeping
    their existing "no ESEF -> error" behaviour unchanged."""
    esef = pick_esef_attachment(attachments)
    if esef is not None:
        return esef, True
    if allow_pdf_fallback:
        for att in attachments:
            if att.name.lower().endswith(".pdf"):
                return att, False
    return None, False


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

    def _list_rows(
        self, issuer_sign: str, *, start: date, end: date, category_id: int = ANNUAL_REPORT_CATEGORY_ID
    ) -> list[tuple[str, str, datetime | None]]:
        payload = self._get_json(
            LIST_URL,
            {
                "issuer": issuer_sign,
                "category": str(category_id),
                "fromDate": start.isoformat(),
                "toDate": end.isoformat(),
            },
        )
        return parse_report_list(payload, issuer_sign=issuer_sign, category_id=category_id)

    def find_latest_annual_report(
        self, issuer_sign: str, *, today: date | None = None
    ) -> NewswebAnnualReportRef | None:
        """The newest ANNUAL FINANCIAL REPORT announcement for this issuer,
        with its attachments already fetched — or None if Newsweb has no
        such announcement in the lookback window (self._lookback_days,
        e.g. ~2 years — enough to always catch the latest one)."""
        issuer_sign = issuer_sign.strip().upper()
        end = today or datetime.now(timezone.utc).date()
        start = end - timedelta(days=self._lookback_days)
        rows = self._list_rows(issuer_sign, start=start, end=end)
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

    def _list_reports(
        self, issuer_sign: str, *, since: date, today: date | None, category_id: int
    ) -> list[NewswebAnnualReportRef]:
        issuer_sign = issuer_sign.strip().upper()
        end = today or datetime.now(timezone.utc).date()
        rows = self._list_rows(issuer_sign, start=since, end=end, category_id=category_id)
        return [
            NewswebAnnualReportRef(
                message_id=message_id,
                message_url=MESSAGE_PAGE_URL.format(message_id=message_id),
                title=title,
                published_at=published_at,
                attachments=self.get_message_attachments(message_id),
            )
            for message_id, title, published_at in rows
        ]

    def list_annual_reports(
        self, issuer_sign: str, *, since: date, today: date | None = None
    ) -> list[NewswebAnnualReportRef]:
        """Every ANNUAL FINANCIAL REPORT announcement for this issuer from
        ``since`` through today (inclusive), newest first, each with its
        attachments already fetched. Used by the "fetch every available
        year" flow (Faiz's ask, 2026-09-26) — an explicit calendar start
        date rather than find_latest_annual_report's rolling lookback
        window, so a company that's been reporting since 2022 keeps
        showing all of it no matter how far "today" has moved on."""
        return self._list_reports(issuer_sign, since=since, today=today, category_id=ANNUAL_REPORT_CATEGORY_ID)

    def list_interim_reports(
        self, issuer_sign: str, *, since: date, today: date | None = None
    ) -> list[NewswebAnnualReportRef]:
        """Every HALF YEAR FINANCIAL REPORT announcement for this issuer
        from ``since`` through today, newest first — same shape as
        list_annual_reports, category 1002 instead of 1001 (Faiz's ask,
        2026-09-26, following the document-sources investigation)."""
        return self._list_reports(issuer_sign, since=since, today=today, category_id=INTERIM_REPORT_CATEGORY_ID)

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
