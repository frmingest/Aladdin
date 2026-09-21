"""Document-level extraction quality evaluation.

Returns a flags dict (matching Document.quality_flags' JSON column, see
app/models/document.py) rather than a list — {"low_text_extraction": True}
is what gets merged into the persisted Document row.
"""
from __future__ import annotations

from app.services.documents.extraction.base import ExtractedPage

LOW_TEXT_PAGE_FRACTION_THRESHOLD = 0.3


def evaluate_quality(pages: list[ExtractedPage]) -> dict[str, bool]:
    """Per-page detail stays on each DocumentPage.extraction_quality; this
    rolls it up to a document-level verdict."""
    if not pages:
        return {"no_pages_extracted": True}

    flags: dict[str, bool] = {}
    low_text_count = sum(1 for p in pages if p.quality == "low_text")
    if low_text_count / len(pages) > LOW_TEXT_PAGE_FRACTION_THRESHOLD:
        flags["low_text_extraction"] = True
    return flags
