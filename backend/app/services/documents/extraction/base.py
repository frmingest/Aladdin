"""Shared extraction result types."""
from __future__ import annotations

from dataclasses import dataclass, field
from decimal import Decimal

# Below this many non-whitespace characters, a page/slide is flagged as
# low-text — usually means a scanned image or chart-only page.
LOW_TEXT_CHAR_THRESHOLD = 20


def quality_for_text(text: str) -> str:
    return "low_text" if len(text.strip()) < LOW_TEXT_CHAR_THRESHOLD else "ok"


@dataclass
class ExtractedPage:
    page_number: int
    text: str
    quality: str


@dataclass
class ExtractedFact:
    metric: str
    value: Decimal
    unit: str
    currency: str | None
    period: str
    source_page: int | None
    confidence: float


@dataclass
class ExtractionResult:
    pages: list[ExtractedPage] = field(default_factory=list)
    facts: list[ExtractedFact] = field(default_factory=list)
    # Document-level flags beyond per-page quality, e.g. "no_pages_extracted".
    quality_flags: list[str] = field(default_factory=list)
