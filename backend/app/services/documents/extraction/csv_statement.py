"""CSV extraction for statement tables downloaded from company IR pages.

Handles what those exports actually look like: semicolon (Norwegian/
European Excel) or comma/tab delimiters, UTF-8 with or without BOM or
Windows-1252, quoted header cells with embedded line breaks ("Q1\\n2025"),
hundreds of trailing empty rows/columns, and Excel error cells (#REF!).
Parsing into facts is shared with XLSX — see tabular.py.
"""
from __future__ import annotations

import csv
import io

from app.services.documents.extraction.base import ExtractionResult
from app.services.documents.extraction.tabular import extract_statement_tables

_DELIMITERS = (";", ",", "\t", "|")


def decode_csv_bytes(content: bytes) -> str:
    """UTF-8 (with/without BOM) first; Windows-1252 as the fallback Excel
    uses for "CSV" saves on Norwegian Windows. Raises ValueError on binary."""
    if b"\x00" in content[:4096]:
        raise ValueError("file contains NUL bytes — not a text CSV (an .xls/.xlsx renamed to .csv?)")
    try:
        return content.decode("utf-8-sig")
    except UnicodeDecodeError:
        return content.decode("cp1252")


def _pick_delimiter(text: str) -> str:
    sample = text[:20_000]
    try:
        return csv.Sniffer().sniff(sample, delimiters="".join(_DELIMITERS)).delimiter
    except csv.Error:
        # Most common delimiter per line, ignoring quoted text roughly.
        counts = {d: sample.count(d) for d in _DELIMITERS}
        return max(counts, key=counts.get)


def read_csv_rows(content: bytes) -> list[list[object]]:
    text = decode_csv_bytes(content)
    reader = csv.reader(io.StringIO(text, newline=""), delimiter=_pick_delimiter(text))
    return [list(row) for row in reader]


def extract_csv(content: bytes, sheet_name: str = "") -> ExtractionResult:
    return extract_statement_tables([(sheet_name, read_csv_rows(content))])
