"""Picks the uploaded-document passages that go into the evidence packet
(Sprint 6 — before this, uploaded document *text* never reached the
analysis; only the figures extracted from it did).

Deterministic and explainable, no embeddings or LLM (decision 22,
2026-09-23): each section-aware chunk (app/services/documents/sectioning.py)
is scored against five Buffett/Munger topics by weighted keyword hits, with
a bonus when the section heading itself names the topic. Boilerplate
(auditor's report, accounting policies, forward-looking-statement
disclaimers, tables of contents) and number-heavy table text are skipped —
figures reach the model through the deterministic financial-history items,
never as raw table rows (CLAUDE.md Rule 1).

Selection is round-robin across topics (best remaining passage per topic
in turn) inside a fixed token budget (``evidence_document_token_budget``,
default ~4,000 tokens — sized for the local qwen3:14b 16k window), so one
long risk section can't crowd out moat or capital-allocation evidence.
Newer documents score higher; with 2+ documents none may take more than
60% of the budget.

CLAUDE.md Rule 5: excerpt text is issuer-written, untrusted input. It is
passed as quoted data, with anything that looks like an evidence ID
("EV-001") neutralised so a document can't impersonate another item, and
the prompts (v2) tell the model to treat it as claims to weigh, not
instructions.
"""
from __future__ import annotations

import math
import re
from collections.abc import Callable
from dataclasses import dataclass, field, replace
from datetime import datetime, timezone
from pathlib import PurePath

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.domain.document_types import (
    DOCUMENT_STATUS_PROCESSED,
    SYSTEM_IMPORT_DOCUMENT_TYPES,
)
from app.domain.period_dates import extract_year
from app.models.document import Document, DocumentChunk, DocumentPage
from app.models.holding import Holding
from app.services.documents.sectioning import (
    TAGGED_FACTS_SECTION,
    UNTITLED_SECTION,
    split_into_section_chunks,
)

# Rough, deliberately conservative: English prose averages ~4 characters
# per token for both Gemini and Qwen tokenizers; Norwegian a little less.
CHARS_PER_TOKEN = 3.6
ITEM_OVERHEAD_TOKENS = 40  # evidence ID, label and citation lines
MIN_PASSAGE_CHARS = 250
MIN_SCORE = 4.0
MAX_PER_TOPIC = 3
MAX_DOCUMENT_SHARE = 0.6
RECENCY_WEIGHTS = (1.0, 0.8, 0.65, 0.5)

_TEXT_EXTENSIONS = {".pdf", ".pptx", ".xhtml", ".html", ".htm"}
_EXCLUDED_TYPES = {*SYSTEM_IMPORT_DOCUMENT_TYPES, "portfolio_export"}

TOPIC_LABELS: dict[str, str] = {
    "moat": "Moat & competitive position",
    "capital_allocation": "Capital allocation & balance sheet",
    "risk": "Risks",
    "outlook": "Strategy & outlook",
    "management": "Management & governance",
}

# (phrase, weight). Matched on lower-cased text as substrings, so stems
# ("uncertaint", "refinanc") catch their inflections.
TOPIC_KEYWORDS: dict[str, tuple[tuple[str, float], ...]] = {
    "moat": (
        ("competitive advantage", 3), ("moat", 3), ("market share", 2.5), ("market position", 2),
        ("switching cost", 3), ("pricing power", 3), ("barrier", 2), ("lowest cost", 3),
        ("cost position", 2.5), ("low-cost", 2), ("unit cost", 2), ("breakeven", 1.5),
        ("brand", 1.5), ("patent", 2), ("licen", 1), ("competitor", 2), ("competition", 1.5),
        ("customer", 1), ("scale", 1), ("network effect", 3), ("differentiat", 1.5), ("premium", 1),
    ),
    "capital_allocation": (
        ("capital allocation", 3), ("dividend", 2), ("share buyback", 3), ("buyback", 2.5),
        ("share repurchase", 3), ("return on capital", 3), ("return on equity", 2), ("roace", 2),
        ("acquisition", 1.5), ("capital expenditure", 1.5), ("capex", 1.5), ("investment decision", 2),
        ("net debt", 1.5), ("leverage", 1.5), ("refinanc", 2), ("credit rating", 2), ("liquidity", 1),
        ("hybrid", 1.5), ("bond", 1), ("equity issue", 2), ("rights issue", 2), ("dilution", 2),
        ("utbytte", 2),
    ),
    "risk": (
        ("risk factor", 3), ("principal risk", 3), ("key risk", 3), ("uncertaint", 2),
        ("risk", 0.8), ("sensitivity", 2), ("downside", 2), ("litigation", 2), ("going concern", 3),
        ("covenant", 2.5), ("impairment", 1.5), ("exposure", 1), ("volatil", 1.5), ("disease", 1.5),
        ("mortality", 1.5), ("regulator", 1), ("tax", 0.5), ("sanction", 1.5), ("cyber", 1.5),
        ("risiko", 1),
    ),
    "outlook": (
        ("outlook", 3), ("guidance", 3), ("strategy", 2), ("strategic", 1.5), ("target", 1),
        ("we expect", 2), ("expected to", 1), ("pipeline", 2), ("backlog", 2), ("order intake", 2),
        ("growth", 1), ("demand", 1), ("production", 0.8), ("ramp-up", 2), ("start-up", 1.5),
        ("first oil", 2), ("harvest", 1), ("capacity", 1), ("utsikter", 3), ("strategi", 2),
    ),
    "management": (
        ("chief executive", 2), ("ceo", 1.5), ("letter", 1), ("remuneration", 2.5),
        ("incentive", 2), ("bonus", 1.5), ("share-based", 2), ("board of directors", 1),
        ("shareholder", 1), ("insider", 2), ("ownership", 1.5), ("related part", 2.5),
        ("governance", 1.5), ("culture", 1.5), ("succession", 2),
    ),
}

# Section headings (lower-cased, substring) whose passages are never used.
BOILERPLATE_SECTIONS: tuple[str, ...] = (
    "auditor", "accounting polic", "basis of preparation", "forward-looking", "table of contents",
    "contents", "glossary", "definitions", "alternative performance measure", "responsibility statement",
    "statement of compliance", "consolidated income statement", "consolidated statement",
    "consolidated balance sheet", "statement of financial position", "statement of cash flows",
    "cash flow statement", "income statement", "balance sheet", TAGGED_FACTS_SECTION.lower(),
)
# Passage text that marks a disclaimer rather than substance.
BOILERPLATE_TEXT: tuple[str, ...] = (
    "forward-looking statements", "in our opinion, the financial statements",
    "true and fair view", "key audit matter",
)
MAX_DIGIT_SHARE = 0.12  # above this a passage is mostly a table of figures

_EVIDENCE_ID = re.compile(r"\bEV-(\d)", re.IGNORECASE)


@dataclass(frozen=True)
class Passage:
    document_id: str
    filename: str
    reporting_period: str | None
    page_start: int
    page_end: int
    section: str
    text: str


@dataclass(frozen=True)
class ScoredPassage:
    passage: Passage
    topic: str
    score: float


@dataclass
class ExcerptSelection:
    excerpts: list[ScoredPassage] = field(default_factory=list)
    documents_considered: list[str] = field(default_factory=list)
    tokens_used: int = 0
    reason: str | None = None  # set when nothing could be selected


def estimate_tokens(text: str) -> int:
    return math.ceil(len(text) / CHARS_PER_TOKEN)


def _document_year(document: Document) -> int | None:
    for candidate in (document.reporting_period, document.original_filename):
        if candidate:
            year = extract_year(candidate)
            if year is not None:
                return year
    return None


def _recency_key(document: Document) -> tuple[int, datetime]:
    uploaded = document.uploaded_at or datetime.min.replace(tzinfo=timezone.utc)
    if uploaded.tzinfo is None:
        uploaded = uploaded.replace(tzinfo=timezone.utc)
    return (_document_year(document) or 0, uploaded)


def _narrative_documents(db: Session, holding: Holding) -> list[Document]:
    documents = [
        d
        for d in db.scalars(
            select(Document).where(
                Document.holding_id == holding.id, Document.status == DOCUMENT_STATUS_PROCESSED
            )
        )
        if d.type not in _EXCLUDED_TYPES
        and PurePath(d.original_filename or "").suffix.lower() in _TEXT_EXTENSIONS
    ]
    documents.sort(key=_recency_key, reverse=True)
    return documents


def _passages_for(db: Session, document: Document) -> list[Passage]:
    chunks = list(
        db.scalars(
            select(DocumentChunk)
            .where(DocumentChunk.document_id == document.id)
            .order_by(DocumentChunk.page_start)
        )
    )
    base = {
        "document_id": str(document.id),
        "filename": document.original_filename,
        "reporting_period": document.reporting_period,
    }
    if chunks and any(c.section is not None for c in chunks):
        return [
            Passage(page_start=c.page_start, page_end=c.page_end, section=c.section or UNTITLED_SECTION, text=c.content, **base)
            for c in chunks
        ]
    # Uploaded before Sprint 6 (1 page = 1 chunk, no section): re-section
    # from the stored page text in memory. Nothing is written back.
    pages = list(
        db.scalars(
            select(DocumentPage)
            .where(DocumentPage.document_id == document.id)
            .order_by(DocumentPage.page_number)
        )
    )
    return [
        Passage(page_start=c.page_start, page_end=c.page_end, section=c.section, text=c.content, **base)
        for c in split_into_section_chunks([(p.page_number, p.extracted_text) for p in pages])
    ]


def _is_boilerplate(passage: Passage, extra_text_markers: tuple[str, ...] = ()) -> bool:
    section = passage.section.lower()
    if any(marker in section for marker in BOILERPLATE_SECTIONS):
        return True
    lowered = passage.text.lower()
    return any(marker in lowered for marker in (*BOILERPLATE_TEXT, *extra_text_markers))


def _mentions_any(passage: Passage, terms: tuple[str, ...]) -> bool:
    haystack = f"{passage.section}\n{passage.text}".lower()
    return any(term in haystack for term in terms)


def _digit_share(text: str) -> float:
    visible = [c for c in text if not c.isspace()]
    if not visible:
        return 1.0
    return sum(c.isdigit() for c in visible) / len(visible)


def score_passage(
    passage: Passage, keywords: dict[str, tuple[tuple[str, float], ...]] | None = None
) -> dict[str, float]:
    """Topic -> score. Keyword hits (capped at 3 per phrase) are scaled by
    passage length so a long passage doesn't win on length alone; a topic
    phrase in the section heading adds a fixed bonus."""
    text = passage.text.lower()
    heading = passage.section.lower()
    length_factor = math.sqrt(max(len(text), 400) / 1000)
    scores: dict[str, float] = {}
    for topic, topic_keywords in (keywords or TOPIC_KEYWORDS).items():
        raw = sum(weight * min(text.count(phrase), 3) for phrase, weight in topic_keywords)
        heading_bonus = sum(weight * 2 for phrase, weight in topic_keywords if phrase in heading)
        scores[topic] = raw / length_factor + heading_bonus
    return scores


def sanitize_excerpt(text: str) -> str:
    """Whitespace-collapsed, with evidence-ID look-alikes neutralised."""
    return _EVIDENCE_ID.sub(r"EV_\1", " ".join(text.split()))


def _truncate(text: str, limit: int) -> str:
    if len(text) <= limit:
        return text
    cut = text.rfind(". ", 0, limit)
    if cut < limit // 2:
        cut = text.rfind(" ", 0, limit)
    return text[: cut + 1].rstrip() + " …"


def select_document_excerpts(
    db: Session,
    holding: Holding,
    *,
    token_budget: int,
    max_excerpt_chars: int,
    max_documents: int,
    topic_labels: dict[str, str] | None = None,
    topic_keywords: dict[str, tuple[tuple[str, float], ...]] | None = None,
    required_terms: tuple[str, ...] = (),
    extra_boilerplate_text: tuple[str, ...] = (),
) -> ExcerptSelection:
    """Defaults = the single-company topics. The fund path (Sprint 8,
    app/services/funds/evidence.py) passes its own topics, fund disclaimers
    as extra boilerplate, and `required_terms`: only passages whose heading
    or text mentions one of them are used — how one sub-fund is picked out
    of an umbrella report covering dozens."""
    labels = topic_labels or TOPIC_LABELS
    keywords = topic_keywords or TOPIC_KEYWORDS
    terms = tuple(t.lower() for t in required_terms if t.strip())
    selection = ExcerptSelection()
    documents = _narrative_documents(db, holding)[:max_documents]
    if not documents:
        selection.reason = (
            "no uploaded narrative documents (annual report PDF/ESEF .xhtml, presentation) for this holding"
        )
        return selection
    selection.documents_considered = [d.original_filename for d in documents]

    candidates: list[ScoredPassage] = []
    for rank, document in enumerate(documents):
        recency = RECENCY_WEIGHTS[min(rank, len(RECENCY_WEIGHTS) - 1)]
        for passage in _passages_for(db, document):
            if len(passage.text) < MIN_PASSAGE_CHARS or _is_boilerplate(passage, extra_boilerplate_text):
                continue
            if terms and not _mentions_any(passage, terms):
                continue
            if _digit_share(passage.text) > MAX_DIGIT_SHARE:
                continue
            scores = score_passage(passage, keywords)
            topic = max(scores, key=lambda t: scores[t])
            score = scores[topic] * recency
            if score >= MIN_SCORE:
                candidates.append(ScoredPassage(passage=passage, topic=topic, score=score))

    if not candidates:
        topics = ", ".join(label.lower() for label in labels.values())
        scope = f" mentioning {' / '.join(repr(t) for t in terms)}" if terms else ""
        selection.reason = f"the uploaded documents had no passages{scope} on {topics}"
        return selection

    by_topic: dict[str, list[ScoredPassage]] = {topic: [] for topic in labels}
    for candidate in sorted(candidates, key=lambda c: c.score, reverse=True):
        by_topic[candidate.topic].append(candidate)

    per_document_cap = token_budget * MAX_DOCUMENT_SHARE if len(documents) > 1 else token_budget
    used_by_document: dict[str, int] = {}
    taken_per_topic: dict[str, int] = {topic: 0 for topic in labels}
    seen_text: set[str] = set()
    progress = True
    while progress:
        progress = False
        for topic in labels:
            queue = by_topic[topic]
            while queue and taken_per_topic[topic] < MAX_PER_TOPIC:
                candidate = queue.pop(0)
                text = _truncate(sanitize_excerpt(candidate.passage.text), max_excerpt_chars)
                cost = estimate_tokens(text) + ITEM_OVERHEAD_TOKENS
                doc_id = candidate.passage.document_id
                if text in seen_text:
                    continue
                if selection.tokens_used + cost > token_budget:
                    continue
                if used_by_document.get(doc_id, 0) + cost > per_document_cap:
                    continue
                seen_text.add(text)
                selection.excerpts.append(
                    ScoredPassage(passage=replace(candidate.passage, text=text), topic=topic, score=candidate.score)
                )
                selection.tokens_used += cost
                used_by_document[doc_id] = used_by_document.get(doc_id, 0) + cost
                taken_per_topic[topic] += 1
                progress = True
                break
    return selection


def _pages(passage: Passage) -> str:
    if passage.page_start == passage.page_end:
        return f"p. {passage.page_start}"
    return f"pp. {passage.page_start}–{passage.page_end}"


ISSUER_TEXT_PREFIX = "Issuer-written text, quoted as data (management's own claims, not verified facts): "


def add_document_excerpt_evidence(
    selection: ExcerptSelection,
    add: Callable,
    *,
    topic_labels: dict[str, str] | None = None,
    prefix: str = ISSUER_TEXT_PREFIX,
) -> None:
    labels = topic_labels or TOPIC_LABELS
    for excerpt in selection.excerpts:
        passage = excerpt.passage
        period = f", {passage.reporting_period}" if passage.reporting_period else ""
        add(
            "document_excerpt",
            f"{labels[excerpt.topic]}: '{passage.section}' ({passage.filename}, {_pages(passage)})",
            f"{prefix}«{passage.text}»",
            citation=f"Uploaded document '{passage.filename}'{period}, {_pages(passage)}",
        )
