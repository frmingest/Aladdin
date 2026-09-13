"""PDF extraction (§6.2).

Phase 1 scope: page text + page numbers + per-page quality flagging. Table
extraction and chart-page rendering (also listed in §6.2) are deferred —
structured financial facts out of PDFs need either careful per-issuer table
parsing or an LLM pass, neither of which belongs in a "no AI dependency"
phase (§26). PDF pages are still fully captured as page text so nothing is
lost; they just don't yet feed financial_line_items the way XLSX does.
"""

from app.services.documents.extraction.base import ExtractedPage, ExtractionResult, quality_for_text


def extract_pdf(content: bytes) -> ExtractionResult:
    import fitz

    pages: list[ExtractedPage] = []
    doc = fitz.open(stream=content, filetype="pdf")
    try:
        for i in range(doc.page_count):
            text = doc.load_page(i).get_text("text") or ""
            pages.append(ExtractedPage(page_number=i + 1, text=text, quality=quality_for_text(text)))
    finally:
        doc.close()

    return ExtractionResult(pages=pages, facts=[], quality_flags=[])
