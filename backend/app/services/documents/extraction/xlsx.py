"""
Excel extraction (§6.2) — the one Phase 1 format that gets real structured
fact extraction, since spreadsheets are already tabular (no OCR/layout
guessing needed). Convention assumed: row 1 of each sheet holds period labels
(e.g. "FY2024", "Q4 2025") in the columns after the first; column A holds a
line-item label. Rows whose label exactly matches a known metric (see
app.domain.financial_metrics) become FinancialLineItem candidates — anything
that doesn't match a known label is still preserved as page text, just not
promoted to a structured fact (§5.1: don't blur "extracted" with "guessed").
"""

import io
from decimal import Decimal, InvalidOperation

from app.domain.financial_metrics import match_metric
from app.services.documents.extraction.base import (
    ExtractedFact,
    ExtractedPage,
    ExtractionResult,
    quality_for_text,
)


def _cell_to_text(value: object) -> str:
    return "" if value is None else str(value)


def _cell_to_decimal(value: object) -> Decimal | None:
    if value is None or isinstance(value, str) and not value.strip():
        return None
    try:
        return Decimal(str(value))
    except (InvalidOperation, ValueError):
        return None


def extract_xlsx(content: bytes) -> ExtractionResult:
    import openpyxl

    workbook = openpyxl.load_workbook(io.BytesIO(content), data_only=True, read_only=True)
    pages: list[ExtractedPage] = []
    facts: list[ExtractedFact] = []

    for sheet_index, sheet in enumerate(workbook.worksheets, start=1):
        rows = list(sheet.iter_rows(values_only=True))
        text_dump = "\n".join("\t".join(_cell_to_text(c) for c in row) for row in rows)
        pages.append(
            ExtractedPage(page_number=sheet_index, text=text_dump, quality=quality_for_text(text_dump))
        )

        if not rows:
            continue

        header = rows[0]
        periods = [_cell_to_text(c).strip() for c in header]

        for row in rows[1:]:
            if not row:
                continue
            label = _cell_to_text(row[0]).strip()
            metric = match_metric(label)
            if metric is None:
                continue
            for col_idx in range(1, len(row)):
                period = periods[col_idx] if col_idx < len(periods) else ""
                if not period:
                    continue
                value = _cell_to_decimal(row[col_idx])
                if value is None:
                    continue
                facts.append(
                    ExtractedFact(
                        metric=metric,
                        value=value,
                        unit="unit",  # scale (thousands/millions) is unknown from raw cells
                        currency=None,
                        period=period,
                        source_page=sheet_index,
                        confidence=1.0,
                    )
                )

    workbook.close()
    return ExtractionResult(pages=pages, facts=facts, quality_flags=[])
