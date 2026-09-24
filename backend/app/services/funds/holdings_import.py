"""Deterministic parser for fund holdings files (Sprint 8, F9).

ETF providers (L&G, iShares, Xtrackers…) and many Nordic fund managers
publish the full holdings list as a CSV or Excel download. This reads one
into (name, weight %, ticker, ISIN, sector, country, currency) rows — in
code, never with an LLM (decision 23, CLAUDE.md Rule 1).

What the files look like in practice, and what is handled:
- a few title/disclaimer rows above the table ("Holdings as of 31/08/2026")
  — the header row is found by looking for a name column *and* a weight
  column in the first 40 rows; the as-of date is looked for above it
- weights as percent (4.85, "4,85 %") or as fractions (0.0485) — fractions
  are detected when every weight is ≤ 1 and they sum to at most ~1
- decimal commas, non-breaking spaces, "%" signs
- a trailing "Total" row, blank rows, derivative/cash lines with negative
  weights (skipped and reported)

Sector / country / currency splits are derived from the holdings rows
when the file has those columns (summed in Python).
"""
from __future__ import annotations

import io
import re
from dataclasses import dataclass, field
from datetime import date
from decimal import Decimal, InvalidOperation
from pathlib import PurePath

from app.services.documents.extraction.csv_statement import read_csv_rows

HEADER_SCAN_ROWS = 40
MAX_WEIGHT_SUM = Decimal("101")  # rounding in provider files; more means a bad parse
FRACTION_SUM_MAX = Decimal("1.05")

_COLUMN_ALIASES: dict[str, tuple[str, ...]] = {
    "name": (
        "name", "security name", "security", "security description", "holding", "holdings", "holding name",
        "company", "company name", "constituent", "constituent name", "issuer", "issuer name", "instrument",
        "instrument name", "description", "selskap", "navn", "verdipapir", "aksje",
    ),
    "weight": (
        "weight", "weight %", "% weight", "weighting", "weight of fund", "% of fund", "% of net assets",
        "% of nav", "% net assets", "net assets %", "portfolio weight", "portfolio %", "market value weight",
        "allocation", "allocation %", "% allocation", "vekt", "vekt %", "andel", "andel %", "% av fondet",
        "andel av fondet", "portefoljeandel", "porteføljeandel", "fund weight", "index weight",
    ),
    "ticker": ("ticker", "symbol", "code", "bloomberg ticker", "ticker symbol", "bloomberg code", "issuer ticker"),
    "isin": ("isin", "isin code"),
    "sector": ("sector", "gics sector", "industry", "bransje", "sektor"),
    "country": ("country", "location", "country of risk", "domicile", "land", "country of domicile"),
    "currency": ("currency", "market currency", "ccy", "valuta", "trading currency"),
}

_DATE_PATTERNS = (
    re.compile(r"\b(\d{4})-(\d{1,2})-(\d{1,2})\b"),  # 2026-08-31
    re.compile(r"\b(\d{1,2})[./](\d{1,2})[./](\d{4})\b"),  # 31/08/2026, 31.08.2026
)
_MONTHS = {
    m: i
    for i, names in enumerate(
        (
            ("jan", "january", "januar"), ("feb", "february", "februar"), ("mar", "march", "mars"),
            ("apr", "april"), ("may", "mai"), ("jun", "june", "juni"), ("jul", "july", "juli"),
            ("aug", "august"), ("sep", "sept", "september"), ("oct", "october", "okt", "oktober"),
            ("nov", "november"), ("dec", "december", "des", "desember"),
        ),
        start=1,
    )
    for m in names
}
_WORD_DATE = re.compile(r"\b(\d{1,2})\.?\s+([A-Za-zæøå]+)\.?\s+(\d{4})\b")


class HoldingsFileError(ValueError):
    """The file could not be read as a holdings list; the message says why."""


@dataclass(frozen=True)
class ParsedHoldingRow:
    name: str
    weight_pct: Decimal
    ticker: str | None = None
    isin: str | None = None
    sector: str | None = None
    country: str | None = None
    currency: str | None = None


@dataclass
class ParsedHoldings:
    rows: list[ParsedHoldingRow]
    as_of_date: date | None
    sheet: str
    header_row: int  # 1-based, as a spreadsheet shows it
    columns: dict[str, str]  # field -> the file's own header text
    weights_were_fractions: bool
    warnings: list[str] = field(default_factory=list)

    @property
    def weight_sum_pct(self) -> Decimal:
        return sum((r.weight_pct for r in self.rows), Decimal(0))

    def derived_exposures(self, dimension: str) -> list[tuple[str, Decimal]]:
        """(label, weight %) summed per sector/country/currency, largest
        first — empty when the file has no such column."""
        if dimension not in ("sector", "country", "currency"):
            raise ValueError(f"not a derivable dimension: {dimension}")
        totals: dict[str, Decimal] = {}
        for row in self.rows:
            label = getattr(row, dimension)
            if label:
                totals[label] = totals.get(label, Decimal(0)) + row.weight_pct
        return sorted(totals.items(), key=lambda kv: (-kv[1], kv[0]))


def _normalize_header(value: object) -> str:
    text = str(value or "").lower().replace(" ", " ").replace("\n", " ")
    text = re.sub(r"[()\[\]:*]", " ", text)
    return " ".join(text.split())


def _match_columns(row: list[object]) -> dict[str, int]:
    found: dict[str, int] = {}
    for idx, cell in enumerate(row):
        header = _normalize_header(cell)
        if not header:
            continue
        for field_name, aliases in _COLUMN_ALIASES.items():
            if field_name in found:
                continue
            if header in aliases:
                found[field_name] = idx
                break
            if field_name == "weight" and (
                header.startswith("weight") or header.startswith("% of") or header.startswith("vekt")
            ):
                found[field_name] = idx
                break
    return found


def parse_weight(raw: object) -> Decimal | None:
    """'4.85' -> 4.85, '4,85 %' -> 4.85, 0.0485 -> 0.0485 (scaled later),
    '' / '-' / 'n/a' -> None."""
    if raw is None or isinstance(raw, bool):
        return None
    if isinstance(raw, (int, float, Decimal)):
        try:
            return Decimal(str(raw))
        except InvalidOperation:
            return None
    text = str(raw).strip().replace(" ", "").replace(" ", "").replace("%", "").replace("−", "-")
    if not text or not re.fullmatch(r"-?[\d.,]+", text) or not re.search(r"\d", text):
        return None
    if "," in text and "." in text:
        decimal_sep = "," if text.rfind(",") > text.rfind(".") else "."
        text = text.replace("." if decimal_sep == "," else ",", "").replace(decimal_sep, ".")
    else:
        text = text.replace(",", ".")
        if text.count(".") > 1:
            return None
    try:
        return Decimal(text)
    except InvalidOperation:
        return None


def _parse_date_text(text: str) -> date | None:
    for pattern in _DATE_PATTERNS:
        match = pattern.search(text)
        if not match:
            continue
        a, b, c = (int(g) for g in match.groups())
        try:
            if pattern is _DATE_PATTERNS[0]:
                return date(a, b, c)
            # Day first (European), unless that is impossible.
            if b > 12 and a <= 12:
                return date(c, a, b)
            return date(c, b, a)
        except ValueError:
            continue
    match = _WORD_DATE.search(text)
    if match:
        month = _MONTHS.get(match.group(2).lower())
        if month:
            try:
                return date(int(match.group(3)), month, int(match.group(1)))
            except ValueError:
                return None
    return None


def _find_as_of(rows: list[list[object]], header_index: int) -> date | None:
    for row in rows[:header_index]:
        for cell in row:
            if isinstance(cell, date):
                return cell if type(cell) is date else cell.date()  # datetime -> date
            if cell is None:
                continue
            found = _parse_date_text(str(cell))
            if found:
                return found
    return None


def _clean(value: object) -> str | None:
    if value is None:
        return None
    text = " ".join(str(value).replace(" ", " ").split())
    return text or None


def _read_sheets(filename: str, content: bytes) -> list[tuple[str, list[list[object]]]]:
    ext = PurePath(filename).suffix.lower()
    if ext == ".csv":
        try:
            return [("", read_csv_rows(content))]
        except ValueError as exc:
            raise HoldingsFileError(str(exc)) from exc
    if ext == ".xlsx":
        import openpyxl

        try:
            workbook = openpyxl.load_workbook(io.BytesIO(content), data_only=True, read_only=True)
        except Exception as exc:  # noqa: BLE001 — any openpyxl failure is an unreadable file
            raise HoldingsFileError(f"could not open the Excel file: {exc}") from exc
        sheets = [(ws.title, [list(r) for r in ws.iter_rows(values_only=True)]) for ws in workbook.worksheets]
        workbook.close()
        return sheets
    raise HoldingsFileError(f"a holdings file must be .csv or .xlsx, not '{ext or filename}'")


def parse_holdings_file(filename: str, content: bytes) -> ParsedHoldings:
    for sheet_name, rows in _read_sheets(filename, content):
        for header_index, row in enumerate(rows[:HEADER_SCAN_ROWS]):
            columns = _match_columns(row)
            if "name" in columns and "weight" in columns:
                return _parse_table(sheet_name, rows, header_index, columns)
    raise HoldingsFileError(
        "no holdings table found: expected a header row with a name column (e.g. 'Name', 'Security', "
        "'Holding') and a weight column (e.g. 'Weight (%)', '% of net assets') within the first "
        f"{HEADER_SCAN_ROWS} rows"
    )


def _parse_table(
    sheet: str, rows: list[list[object]], header_index: int, columns: dict[str, int]
) -> ParsedHoldings:
    header = rows[header_index]
    raw: list[tuple[dict[str, str | None], Decimal]] = []
    warnings: list[str] = []
    blank_streak = 0
    for row in rows[header_index + 1 :]:
        def cell(field_name: str, row: list[object] = row) -> object:
            idx = columns.get(field_name)
            return row[idx] if idx is not None and idx < len(row) else None

        name = _clean(cell("name"))
        weight = parse_weight(cell("weight"))
        if name is None and weight is None:
            blank_streak += 1
            if blank_streak >= 3 and raw:
                break  # the table has ended; what follows is footnotes
            continue
        blank_streak = 0
        if name is None or weight is None:
            continue
        if name.lower().startswith("total"):
            continue
        if weight < 0:
            warnings.append(f"skipped '{name}': negative weight {weight} (a short, derivative or liability line)")
            continue
        fields = {
            key: _clean(cell(key)) for key in ("ticker", "isin", "sector", "country", "currency")
        }
        raw.append(({"name": name, **fields}, weight))

    if not raw:
        raise HoldingsFileError("the holdings table has a header but no rows with both a name and a weight")

    total = sum((w for _f, w in raw), Decimal(0))
    fractions = all(w <= 1 for _f, w in raw) and total <= FRACTION_SUM_MAX
    scale = Decimal(100) if fractions else Decimal(1)
    parsed = [
        ParsedHoldingRow(
            name=f["name"][:255],  # type: ignore[index]
            weight_pct=(w * scale).quantize(Decimal("0.0001")),
            ticker=(f["ticker"] or None) and f["ticker"][:64],  # type: ignore[index]
            isin=_valid_isin(f["isin"]),
            sector=(f["sector"] or None) and f["sector"][:255],  # type: ignore[index]
            country=(f["country"] or None) and f["country"][:255],  # type: ignore[index]
            currency=(f["currency"] or None) and f["currency"][:255],  # type: ignore[index]
        )
        for f, w in raw
    ]
    parsed.sort(key=lambda r: (-r.weight_pct, r.name))
    result = ParsedHoldings(
        rows=parsed,
        as_of_date=_find_as_of(rows, header_index),
        sheet=sheet,
        header_row=header_index + 1,
        columns={k: str(header[i]).strip() for k, i in columns.items() if i < len(header)},
        weights_were_fractions=fractions,
        warnings=warnings,
    )
    if result.weight_sum_pct > MAX_WEIGHT_SUM:
        raise HoldingsFileError(
            f"weights add up to {result.weight_sum_pct:.2f}% (more than 100%): the weight column was "
            f"probably misread ('{result.columns.get('weight')}')"
        )
    return result


def _valid_isin(value: str | None) -> str | None:
    if value and re.fullmatch(r"[A-Z]{2}[A-Z0-9]{9}\d", value.strip().upper()):
        return value.strip().upper()
    return None
