"""PDF extraction.

Scope: page text + page numbers + per-page quality flagging. Structured
financial facts out of PDFs need either careful per-issuer table parsing or
an LLM pass — neither belongs in this deterministic-only stage (CLAUDE.md
Rule 1). PDF pages are still fully captured as page text so nothing is
lost; they just don't yet feed financial_line_items the way XLSX does.
"""
from __future__ import annotations

from app.services.documents.extraction.base import (
    ExtractedPage,
    ExtractionResult,
    quality_for_text,
)


def extract_pdf(content: bytes) -> ExtractionResult:
    import pymupdf

    pages: list[ExtractedPage] = []
    doc = pymupdf.open(stream=content, filetype="pdf")
    try:
        for i in range(doc.page_count):
            text = doc.load_page(i).get_text("text") or ""
            pages.append(
                ExtractedPage(page_number=i + 1, text=text, quality=quality_for_text(text))
            )
    finally:
        doc.close()

    return ExtractionResult(pages=pages, facts=[], quality_flags=[])
