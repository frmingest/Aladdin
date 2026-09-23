"""Excel extraction — sheets from company IR downloads or a hand-built
spreadsheet. Every sheet is read as statement tables (see tabular.py for
exactly which rows/columns become FinancialLineItem candidates): known
line-item labels x annual period columns, with the scale and currency taken
from the sheet's unit line ("NOK million"). Anything not promoted to a fact
is still preserved as page text (one page per table section) — don't blur
"extracted" with "guessed".
"""
from __future__ import annotations

import io

from app.services.documents.extraction.base import ExtractionResult
from app.services.documents.extraction.tabular import extract_statement_tables


def extract_xlsx(content: bytes) -> ExtractionResult:
    import openpyxl

    workbook = openpyxl.load_workbook(io.BytesIO(content), data_only=True, read_only=True)
    try:
        sheets = [
            (sheet.title, [list(row) for row in sheet.iter_rows(values_only=True)])
            for sheet in workbook.worksheets
        ]
    finally:
        workbook.close()
    return extract_statement_tables(sheets)
