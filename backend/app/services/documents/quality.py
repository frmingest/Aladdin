"""Document-level extraction quality evaluation (§6.4)."""

from app.services.documents.extraction.base import ExtractedPage

LOW_TEXT_PAGE_FRACTION_THRESHOLD = 0.3


def evaluate_quality(pages: list[ExtractedPage]) -> list[str]:
    """Returns document-level quality flags. Per-page detail stays on each
    DocumentPage.extraction_quality; this rolls it up to a document verdict."""
    if not pages:
        return ["no_pages_extracted"]

    flags: list[str] = []
    low_text_count = sum(1 for p in pages if p.quality == "low_text")
    if low_text_count / len(pages) > LOW_TEXT_PAGE_FRACTION_THRESHOLD:
        flags.append("low_text_extraction")
    return flags
