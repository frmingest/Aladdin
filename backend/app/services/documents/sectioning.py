"""Section-aware chunking of extracted document text (Sprint 6).

Before Sprint 6, ingestion stored 1 page = 1 chunk, with no section label.
This module splits a document's pages into chunks that follow its headings
("Risk factors", "Outlook", "Letter from the CEO", "3.2 Capital
allocation" ...), carries a heading across page breaks, and keeps each
chunk under ``SECTION_CHUNK_CHARS`` so one chunk is a citable passage, not
a whole page of mixed content.

Heading detection is deliberately conservative and deterministic (no LLM):
a line counts as a heading only when it matches a known annual-report
heading, is short ALL-CAPS text, or is a short numbered heading. Plain
Title Case lines are *not* headings — PDF text extraction produces too many
short title-cased lines (table labels, column headers) for that to be
reliable. A chunk without a detected heading gets ``UNTITLED_SECTION``,
so new chunks never have ``section = NULL`` — that is how a legacy
1-page-1-chunk row is told apart (see app/services/analysis/document_excerpts.py).

CLAUDE.md Rule 5: chunk content is untrusted issuer-written text. Nothing
here interprets it; the evidence packet frames it to the model as data.
"""
from __future__ import annotations

import re
from dataclasses import dataclass

SECTION_CHUNK_CHARS = 1800
UNTITLED_SECTION = "Untitled section"
TAGGED_FACTS_SECTION = "Tagged XBRL facts"
_MIN_CHUNK_CONTENT_CHARS = 1  # any real text is kept; the excerpt selector filters short passages
_MAX_HEADING_CHARS = 90
_MAX_HEADING_WORDS = 12

# Lower-case, without numbering. A line matches when it equals one of these
# or starts with one and is at most ~25 characters longer ("Risk factors and
# risk management", "Outlook for 2026").
KNOWN_HEADINGS: tuple[str, ...] = (
    # English annual-report sections
    "letter from the ceo", "letter to shareholders", "letter to our shareholders",
    "ceo letter", "message from the ceo", "ceo's statement", "chairman's statement",
    "chair's statement", "chief executive's review", "a word from the ceo",
    "highlights", "key figures", "the year in brief", "year in review",
    "strategy", "our strategy", "strategic priorities", "business model", "our business",
    "business overview", "market overview", "markets", "competitive position", "competition",
    "outlook", "guidance", "prospects", "future prospects",
    "risk factors", "risks", "principal risks", "principal risks and uncertainties",
    "risk management", "risk and risk management", "key risks", "financial risk",
    "capital allocation", "capital structure", "dividend policy", "dividends",
    "shareholder information", "shareholder returns", "share buyback",
    "financial review", "financial performance", "operating review", "operational review",
    "board of directors' report", "board of directors report", "directors' report",
    "report of the board of directors", "management's discussion and analysis",
    "corporate governance", "remuneration", "executive remuneration", "sustainability",
    "segment information", "segments", "production", "reserves", "operations",
    "events after the reporting period", "subsequent events",
    "consolidated income statement", "consolidated statement of financial position",
    "consolidated balance sheet", "consolidated statement of cash flows",
    "notes to the consolidated financial statements", "accounting policies",
    "independent auditor's report", "auditor's report", "forward-looking statements",
    "alternative performance measures", "glossary", "definitions", "contents",
    "table of contents", "responsibility statement", "basis of preparation",
    # Norwegian
    "styrets beretning", "styrets årsberetning", "årsberetning", "konsernsjefens brev",
    "strategi", "utsikter", "fremtidsutsikter", "risikofaktorer", "risikostyring",
    "utbytte", "utbyttepolitikk", "eierstyring og selskapsledelse", "nøkkeltall",
)

_NUMBERED_HEADING = re.compile(r"^(?:\d{1,2}(?:\.\d{1,2}){0,3}\.?|[IVX]{1,4}\.|[A-H]\.)\s+(?P<rest>\S.*)$")
_NUMBER_PREFIX = re.compile(r"^(?:\d{1,2}(?:\.\d{1,2}){0,3}\.?|[IVX]{1,4}\.|[A-H]\.)\s+")


@dataclass(frozen=True)
class SectionChunk:
    page_start: int
    page_end: int
    section: str
    content: str


def _normalize_heading(line: str) -> str:
    return " ".join(_NUMBER_PREFIX.sub("", line.strip()).split()).strip(" :–-")


def _matches_known(text: str) -> bool:
    lowered = text.lower().replace("’", "'")
    for known in KNOWN_HEADINGS:
        if lowered == known:
            return True
        if lowered.startswith(known + " ") and len(lowered) <= len(known) + 25:
            return True
    return False


def detect_heading(line: str) -> str | None:
    """The heading text if ``line`` is a section heading, else None."""
    stripped = line.strip()
    if stripped.startswith(TAGGED_FACTS_SECTION):
        return TAGGED_FACTS_SECTION
    if not (3 <= len(stripped) <= _MAX_HEADING_CHARS) or "|" in stripped:
        return None
    words = stripped.split()
    if len(words) > _MAX_HEADING_WORDS:
        return None
    letters = sum(c.isalpha() for c in stripped)
    digits = sum(c.isdigit() for c in stripped)
    if letters < 3 or digits > letters * 0.5:
        return None
    heading = _normalize_heading(stripped)
    if not heading:
        return None
    if _matches_known(heading):
        return heading
    if stripped.endswith((".", ",", ";")):
        return None
    if stripped.isupper() and len(words) <= 10 and letters >= 4:
        return heading.title() if heading.isupper() else heading
    numbered = _NUMBERED_HEADING.match(stripped)
    if numbered and len(words) <= 10 and numbered.group("rest")[0].isupper():
        return heading
    return None


def _split_long_line(line: str, limit: int) -> list[str]:
    """ESEF paragraphs arrive as one line; hard-wrap at sentence ends."""
    if len(line) <= limit:
        return [line]
    parts: list[str] = []
    rest = line
    while len(rest) > limit:
        cut = rest.rfind(". ", 0, limit)
        cut = cut + 1 if cut > limit // 3 else rest.rfind(" ", 0, limit)
        if cut <= 0:
            cut = limit
        parts.append(rest[:cut].strip())
        rest = rest[cut:].strip()
    if rest:
        parts.append(rest)
    return parts


def split_into_section_chunks(
    pages: list[tuple[int, str]], *, max_chars: int = SECTION_CHUNK_CHARS
) -> list[SectionChunk]:
    """``pages`` is ``(page_number, text)`` in page order."""
    chunks: list[SectionChunk] = []
    heading: str | None = None
    buffer: list[str] = []
    size = 0
    first_page: int | None = None
    last_page: int | None = None

    def flush() -> None:
        nonlocal buffer, size, first_page
        content = "\n".join(buffer).strip()
        if first_page is not None and len("".join(content.split())) >= _MIN_CHUNK_CONTENT_CHARS:
            chunks.append(
                SectionChunk(
                    page_start=first_page,
                    page_end=last_page if last_page is not None else first_page,
                    section=heading or UNTITLED_SECTION,
                    content=content,
                )
            )
        buffer, size, first_page = [], 0, None

    for page_number, text in pages:
        for raw_line in (text or "").split("\n"):
            line = raw_line.strip()
            if not line:
                continue
            found = detect_heading(line)
            if found is not None:
                flush()
                heading = found
                continue
            for piece in _split_long_line(line, max_chars):
                if size + len(piece) > max_chars and buffer:
                    flush()
                if first_page is None:
                    first_page = page_number
                last_page = page_number
                buffer.append(piece)
                size += len(piece) + 1
    flush()
    return chunks
