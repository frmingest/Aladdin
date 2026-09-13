"""
Portfolio CSV/XLSX parsing and validation against the canonical schema
(architecture §7). Schema-flexible on input (header aliases, comma-or-dot
decimals) but every row that survives is fully validated — partial/garbage
rows are collected as errors and the whole upload is rejected rather than
silently dropping rows (§21: fail visibly).

Two input shapes are recognized:

1. The canonical schema from §7 (Ticker/Name/Asset class/Quantity/Weight %/
   Cost basis/Currency/Sector/Notes), comma-delimited UTF-8.
2. A real Nordnet "Beholdningstabell" export (Handel/Valuta/Antall/GAV/
   Verdi NOK/...), tab-delimited UTF-16 with Norwegian headers and no
   exchange ticker or weight column at all. This is Faiz's actual data
   source, so it's a first-class supported shape, not a workaround — see
   docs/decisions/0003-nordnet-export-support.md.
"""

import csv
import io
from dataclasses import dataclass, field
from decimal import Decimal, InvalidOperation

import pandas as pd

from app.domain.asset_class import AssetClass, normalize_asset_class
from app.domain.errors import UnreadableFileError

# Raw header (lowercased, whitespace-collapsed) -> canonical field name.
_HEADER_ALIASES: dict[str, str] = {
    "ticker": "ticker",
    "name": "name",
    "asset class": "asset_class",
    "asset_class": "asset_class",
    "quantity": "quantity",
    "qty": "quantity",
    "weight %": "weight_pct",
    "weight": "weight_pct",
    "weight_pct": "weight_pct",
    "cost basis": "cost_basis",
    "cost_basis": "cost_basis",
    "currency": "currency",
    "sector/theme": "sector",
    "sector": "sector",
    "theme": "sector",
    "notes": "notes",
}

# Nordnet "Beholdningstabell eksport" headers (Norwegian) -> internal field.
# Deliberately not the full column set: "% i dag", "siste kurs",
# "Belåningsverdi" and both "Avkast." columns are live market data / returns,
# not portfolio composition — that's Phase 2's job (market data layer), not
# something to bolt onto a position row here.
_NORDNET_ALIASES: dict[str, str] = {
    "handel": "instrument_name",
    "valuta": "currency",
    "antall": "quantity",
    "gav": "avg_cost",
    "verdi nok": "value_nok",
}
_NORDNET_SIGNATURE = {"handel", "verdi nok"}

_REQUIRED_FIELDS = ("ticker", "name", "asset_class", "currency")

# Row-level tolerance for the "weights sum to ~100%" sanity check — cash
# sleeves, rounding, and multi-currency exports mean this is a warning, not a
# hard validation failure.
_WEIGHT_SUM_TOLERANCE_PCT = Decimal("1.0")


@dataclass
class ParsedPosition:
    row_number: int  # 1-based, counting the first data row (header excluded) as 1
    ticker: str
    name: str
    asset_class: AssetClass
    asset_class_raw: str
    currency: str
    quantity: Decimal | None
    weight_pct: Decimal | None
    cost_basis: Decimal | None
    sector: str | None
    notes: str | None
    # Phase 2 (§26) market-data symbol — see Holding.market_ticker. Present
    # for canonical-schema uploads (same value as `ticker`), None for a
    # Nordnet export (no ticker column to derive it from).
    market_ticker: str | None


@dataclass
class PortfolioParseResult:
    positions: list[ParsedPosition] = field(default_factory=list)
    row_errors: list[dict] = field(default_factory=list)
    warnings: list[str] = field(default_factory=list)

    @property
    def is_valid(self) -> bool:
        return not self.row_errors


def _normalize_header_text(raw: str) -> str:
    return " ".join(str(raw).strip().lower().split())


def _parse_decimal(raw: str | None) -> Decimal | None:
    if raw is None:
        return None
    text = str(raw).strip().replace("%", "").replace(" ", "")
    if text == "":
        return None
    if "," in text and "." not in text:
        text = text.replace(",", ".")
    else:
        text = text.replace(",", "")
    return Decimal(text)  # may raise InvalidOperation — caller catches


def _decode_csv_text(filename: str, content: bytes) -> str:
    # Canonical exports are UTF-8; the real Nordnet export is UTF-16 (with
    # BOM) — try both rather than assuming one.
    for encoding in ("utf-8-sig", "utf-16"):
        try:
            return content.decode(encoding)
        except UnicodeDecodeError:
            continue
    raise UnreadableFileError(filename, "could not decode as UTF-8 or UTF-16 text")


def _read_csv_headers_and_rows(filename: str, content: bytes) -> tuple[list[str], list[list[str]]]:
    text = _decode_csv_text(filename, content)
    lines = text.splitlines()
    if not lines:
        return [], []
    # Canonical exports are comma-delimited; the Nordnet export is tab-delimited.
    delimiter = "\t" if lines[0].count("\t") >= lines[0].count(",") else ","
    all_rows = [r for r in csv.reader(io.StringIO(text), delimiter=delimiter) if any(c.strip() for c in r)]
    if not all_rows:
        return [], []
    return all_rows[0], all_rows[1:]


def _read_xlsx_headers_and_rows(filename: str, content: bytes) -> tuple[list[str], list[list[str]]]:
    try:
        df = pd.read_excel(io.BytesIO(content), dtype=str, engine="openpyxl", keep_default_na=False)
    except Exception as exc:  # noqa: BLE001
        raise UnreadableFileError(filename, str(exc)) from exc
    headers = [str(c) for c in df.columns]
    rows = [[("" if v is None else str(v)) for v in row] for row in df.itertuples(index=False, name=None)]
    return headers, rows


def _is_nordnet_format(normalized_headers: list[str]) -> bool:
    return _NORDNET_SIGNATURE.issubset(set(normalized_headers))


def _rows_from_canonical(
    normalized_headers: list[str], data_rows: list[list[str]]
) -> list[dict[str, str]]:
    header_map = {i: _HEADER_ALIASES[h] for i, h in enumerate(normalized_headers) if h in _HEADER_ALIASES}
    rows: list[dict[str, str]] = []
    for raw_row in data_rows:
        row = {canonical: (raw_row[i].strip() if i < len(raw_row) else "") for i, canonical in header_map.items()}
        # §7's canonical schema already requires an exchange-qualified
        # ticker (e.g. "VAR.OL"), so it doubles as the Phase 2 market-data
        # symbol with no extra column needed — unlike the Nordnet shape
        # below, which has no ticker at all (see Holding.market_ticker).
        row["market_ticker"] = row.get("ticker", "")
        rows.append(row)
    return rows


def _rows_from_nordnet(
    normalized_headers: list[str], data_rows: list[list[str]]
) -> list[dict[str, str]]:
    """Converts a Nordnet Beholdningstabell export into canonical-shaped rows.

    Two things this export simply doesn't have, and how we derive them:
    - No exchange ticker: the instrument name ("Handel") is used as the
      unique holding key instead. Re-uploads with the same name update the
      same holding; a later, ticker-bearing export would need reconciling
      by hand (documented, not silently guessed at).
    - No weight column: weight_pct is derived from each row's share of
      total "Verdi NOK" across the upload.
    Asset class isn't in this export either — "ETF" in the name maps to
    ETF, everything else defaults to Aksje/EQUITY, since this report is a
    brokerage stock/ETF holdings table, not a mixed fund platform export.
    """
    col = {i: _NORDNET_ALIASES[h] for i, h in enumerate(normalized_headers) if h in _NORDNET_ALIASES}
    idx_of = {v: k for k, v in col.items()}

    def cell(raw_row: list[str], field_name: str) -> str:
        i = idx_of.get(field_name)
        return raw_row[i].strip() if i is not None and i < len(raw_row) else ""

    intermediate: list[dict[str, str]] = []
    raw_values: list[Decimal] = []
    for raw_row in data_rows:
        name = cell(raw_row, "instrument_name")
        if not name:
            continue
        intermediate.append(
            {
                "ticker": name,
                "name": name,
                "asset_class": "ETF" if "etf" in name.lower() else "Aksje",
                "currency": cell(raw_row, "currency"),
                "quantity": cell(raw_row, "quantity"),
                "cost_basis": cell(raw_row, "avg_cost"),
                "sector": "",
                "notes": "",
                # No ticker in this export — Holding.market_ticker stays
                # NULL until set explicitly (PATCH /portfolio/holdings/{id}),
                # rather than guessing a Yahoo symbol from the instrument
                # name (§21).
                "market_ticker": "",
            }
        )
        try:
            raw_values.append(_parse_decimal(cell(raw_row, "value_nok")) or Decimal("0"))
        except InvalidOperation:
            raw_values.append(Decimal("0"))

    total = sum(raw_values) if raw_values else Decimal("0")
    for row, value in zip(intermediate, raw_values):
        row["weight_pct"] = str((value / total * 100).quantize(Decimal("0.01"))) if total > 0 else ""

    return intermediate


def load_rows(*, filename: str, content: bytes) -> tuple[list[dict[str, str]], list[str]]:
    """Reads a portfolio CSV/XLSX into a list of {canonical_field: raw_value}
    dicts, auto-detecting the canonical schema vs. a Nordnet export. Returns
    (rows, format_notes) — format_notes surfaces things like "weights were
    derived, not read directly" back to the caller as upload warnings."""
    ext = filename.lower().rsplit(".", 1)[-1]
    if ext == "csv":
        headers, data_rows = _read_csv_headers_and_rows(filename, content)
    elif ext == "xlsx":
        headers, data_rows = _read_xlsx_headers_and_rows(filename, content)
    else:
        raise UnreadableFileError(filename, f"unsupported extension '.{ext}'")

    normalized_headers = [_normalize_header_text(h) for h in headers]

    if _is_nordnet_format(normalized_headers):
        notes = [
            "detected a Nordnet Beholdningstabell export — position weights were "
            "derived from each holding's share of Verdi NOK, and instrument names "
            "are used as holding keys since this export has no exchange ticker"
        ]
        return _rows_from_nordnet(normalized_headers, data_rows), notes

    return _rows_from_canonical(normalized_headers, data_rows), []


def parse_and_validate(*, filename: str, content: bytes) -> PortfolioParseResult:
    rows, format_notes = load_rows(filename=filename, content=content)
    result = PortfolioParseResult(warnings=list(format_notes))
    seen_tickers: set[str] = set()

    for idx, row in enumerate(rows, start=1):
        errors_for_row: list[str] = []

        ticker = (row.get("ticker") or "").strip()
        name = (row.get("name") or "").strip()
        asset_class_raw = (row.get("asset_class") or "").strip()
        currency = (row.get("currency") or "").strip().upper()
        sector = (row.get("sector") or "").strip() or None
        notes = (row.get("notes") or "").strip() or None

        for field_name, value in (("ticker", ticker), ("name", name), ("asset_class", asset_class_raw)):
            if not value:
                errors_for_row.append(f"{field_name} is required")

        if not currency:
            errors_for_row.append("currency is required")
        elif len(currency) != 3 or not currency.isalpha():
            errors_for_row.append(f"currency '{currency}' is not a 3-letter ISO code")

        if ticker and ticker in seen_tickers:
            errors_for_row.append(f"duplicate ticker '{ticker}' in this upload")
        elif ticker:
            seen_tickers.add(ticker)

        quantity: Decimal | None = None
        try:
            quantity = _parse_decimal(row.get("quantity"))
            if quantity is not None and quantity < 0:
                errors_for_row.append("quantity cannot be negative")
        except InvalidOperation:
            errors_for_row.append(f"quantity '{row.get('quantity')}' is not a valid number")

        weight_pct: Decimal | None = None
        try:
            weight_pct = _parse_decimal(row.get("weight_pct"))
            if weight_pct is not None and not (Decimal("0") <= weight_pct <= Decimal("100")):
                errors_for_row.append("weight_pct must be between 0 and 100")
        except InvalidOperation:
            errors_for_row.append(f"weight_pct '{row.get('weight_pct')}' is not a valid number")

        if quantity is None and weight_pct is None:
            errors_for_row.append("either quantity or weight_pct must be provided")

        cost_basis: Decimal | None = None
        try:
            cost_basis = _parse_decimal(row.get("cost_basis"))
        except InvalidOperation:
            errors_for_row.append(f"cost_basis '{row.get('cost_basis')}' is not a valid number")

        if errors_for_row:
            for message in errors_for_row:
                result.row_errors.append({"row": idx, "message": message})
            continue

        market_ticker = (row.get("market_ticker") or "").strip() or None

        result.positions.append(
            ParsedPosition(
                row_number=idx,
                ticker=ticker,
                name=name,
                asset_class=normalize_asset_class(asset_class_raw),
                asset_class_raw=asset_class_raw,
                currency=currency,
                quantity=quantity,
                weight_pct=weight_pct,
                cost_basis=cost_basis,
                sector=sector,
                notes=notes,
                market_ticker=market_ticker,
            )
        )

    if result.is_valid and result.positions:
        weights = [p.weight_pct for p in result.positions if p.weight_pct is not None]
        if len(weights) == len(result.positions):  # every row reports a weight
            total = sum(weights)
            if abs(total - Decimal("100")) > _WEIGHT_SUM_TOLERANCE_PCT:
                result.warnings.append(
                    f"position weights sum to {total}%, expected ~100% (tolerance ±{_WEIGHT_SUM_TOLERANCE_PCT}%)"
                )

    return result
