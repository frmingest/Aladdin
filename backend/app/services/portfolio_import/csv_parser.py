"""Parses a Nordnet-style "Beholdningstabell" broker-export CSV.

Observed format (5 real exports, 2026-09-21): UTF-16LE with a BOM,
tab-delimited, Norwegian decimal comma, one row per security. Column
order observed: Handel, Valuta, Antall, GAV, % i dag, siste kurs,
Belåningsverdi, Verdi NOK, Avkast., Avkast. NOK. Columns are looked up by
header name (case/whitespace-insensitive), not position, so a reordered or
slightly different export from the same broker still parses.

The account number isn't a column in the file at all — it's only in the
filename ("...kontono._73898074_...", or "...kontono. 73898074 ..." with
spaces instead of underscores) — see extract_account_number_from_filename.

CLAUDE.md Rule 1: every number here is a raw broker-reported figure, never
a derived/computed one — this module only parses and classifies, it does
no financial arithmetic itself (weight_pct is computed later in
ingestion.py from these raw values, deterministically).
"""
from __future__ import annotations

import csv
import io
import re
from dataclasses import dataclass
from decimal import Decimal, InvalidOperation

from app.domain.errors import IngestionError


class CsvParseError(IngestionError):
    def __init__(self, filename: str, reason: str):
        self.filename = filename
        self.reason = reason
        super().__init__(f"could not parse '{filename}' as a broker export: {reason}")


@dataclass(frozen=True)
class ParsedPosition:
    name: str
    currency: str
    quantity: Decimal
    avg_cost: Decimal
    value_nok: Decimal
    last_price: Decimal | None


# Header name -> canonical field. Matched case-insensitively after
# collapsing internal whitespace, so "Belåningsverdi", "belåningsverdi ",
# etc. all resolve the same way.
_HEADER_MAP = {
    "handel": "name",
    "valuta": "currency",
    "antall": "quantity",
    "gav": "avg_cost",
    "siste kurs": "last_price",
    "verdi nok": "value_nok",
}
REQUIRED_FIELDS = {"name", "currency", "quantity", "avg_cost", "value_nok"}

_ACCOUNT_NUMBER_PATTERN = re.compile(r"kontono\.?[\s_]*(\d+)", re.IGNORECASE)


def extract_account_number_from_filename(filename: str) -> str | None:
    match = _ACCOUNT_NUMBER_PATTERN.search(filename)
    return match.group(1) if match else None


def _normalize_header(raw: str) -> str:
    return re.sub(r"\s+", " ", raw.strip()).lower()


def _decode(content: bytes, filename: str) -> str:
    # Every real export observed so far (2026-09-21) is UTF-16 with a BOM.
    # Decide by BOM, not by trial-and-error decoding: a UTF-8 file
    # trial-decoded as UTF-16 rarely raises (any even-length byte string is
    # "valid" UTF-16, it just comes out as garbage), so BOM-sniffing first
    # is what actually tells the two apart.
    if content[:2] in (b"\xff\xfe", b"\xfe\xff"):
        try:
            return content.decode("utf-16")
        except UnicodeDecodeError as exc:
            raise CsvParseError(filename, f"invalid UTF-16 content: {exc}") from exc
    try:
        return content.decode("utf-8-sig")
    except UnicodeDecodeError as exc:
        raise CsvParseError(
            filename, f"unrecognized text encoding (expected UTF-16 or UTF-8): {exc}"
        ) from exc


def _parse_decimal(raw: str, *, field: str, filename: str) -> Decimal:
    cleaned = raw.strip().replace("\xa0", "").replace(" ", "").replace(",", ".")
    if cleaned in ("", "-"):
        return Decimal(0)
    try:
        return Decimal(cleaned)
    except InvalidOperation as exc:
        raise CsvParseError(filename, f"field '{field}' has an unparseable value {raw!r}") from exc


def parse_broker_csv(content: bytes, filename: str) -> list[ParsedPosition]:
    text = _decode(content, filename)
    reader = csv.reader(io.StringIO(text), delimiter="\t")
    rows = [row for row in reader if any(cell.strip() for cell in row)]
    if not rows:
        raise CsvParseError(filename, "file is empty")

    header = [_normalize_header(cell) for cell in rows[0]]
    column_index: dict[str, int] = {}
    for idx, cell in enumerate(header):
        field = _HEADER_MAP.get(cell)
        if field:
            column_index[field] = idx

    missing = REQUIRED_FIELDS - column_index.keys()
    if missing:
        raise CsvParseError(
            filename,
            f"missing expected column(s): {', '.join(sorted(missing))} "
            f"(found header: {rows[0]!r})",
        )

    positions: list[ParsedPosition] = []
    for row in rows[1:]:
        if len(row) <= max(column_index.values()):
            continue  # short/blank trailing row
        name = row[column_index["name"]].strip()
        if not name:
            continue
        currency = row[column_index["currency"]].strip().upper()
        quantity = _parse_decimal(row[column_index["quantity"]], field="Antall", filename=filename)
        avg_cost = _parse_decimal(row[column_index["avg_cost"]], field="GAV", filename=filename)
        value_nok = _parse_decimal(
            row[column_index["value_nok"]], field="Verdi NOK", filename=filename
        )
        last_price = (
            _parse_decimal(row[column_index["last_price"]], field="siste kurs", filename=filename)
            if "last_price" in column_index
            else None
        )
        positions.append(
            ParsedPosition(
                name=name,
                currency=currency,
                quantity=quantity,
                avg_cost=avg_cost,
                value_nok=value_nok,
                last_price=last_price,
            )
        )

    if not positions:
        raise CsvParseError(filename, "no data rows found after the header")
    return positions
