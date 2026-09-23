"""Statement-table extraction shared by the CSV and XLSX extractors.

Built for the files companies publish on their investor-relations pages
("factsheet", "quarterly and accounting figures" downloads): one or more
statements stacked in a sheet, a header row of period labels (which may be
repeated per statement or only printed once), a unit line such as
"USD million" / "Amounts in NOK million", and line-item labels in the
first text column.

What becomes a structured fact (FinancialLineItem) — deterministic only,
CLAUDE.md Rule 1:

* the row label exactly matches a known label (app.domain.financial_metrics);
* the column is an **annual** period ("FY 2025", "2025", "YTD Q4 2025",
  "31.12.2025"). Quarter, half-year and YTD-before-Q4 columns are kept as
  page text only, so quarter figures never mix into the annual history the
  metrics, valuation and readiness check read by year;
* when the sheet has sections titled like a primary statement (income
  statement / balance sheet / cash flow), only those sections are used —
  a segment table's "Operating revenues" never competes with the group
  figure;
* the scale ("million") and currency come from the section's header/unit
  line; the value is stored in full units (e.g. USD, not USD million).

Two labels for the same metric and year with different values are a
conflict: neither is imported, and the conflict is reported. Everything —
every row, every quarter — is still kept as page text (one page per table
section) for the evidence packet.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from decimal import Decimal

from app.domain.financial_metrics import (
    POSITIVE_MAGNITUDE_METRICS,
    label_priority,
    match_metric,
)
from app.services.documents.extraction.base import (
    ExtractedFact,
    ExtractedPage,
    ExtractionResult,
    quality_for_text,
)
from app.services.documents.extraction.numbers import (
    PERIOD_ANNUAL,
    PeriodLabel,
    classify_period,
    detect_currency,
    detect_scale,
    parse_statement_number,
)

CONFIDENCE_SCALE_STATED = 1.0
CONFIDENCE_SCALE_NOT_STATED = 0.7

_PRIMARY_STATEMENT_KEYWORDS: dict[str, tuple[str, ...]] = {
    "income": (
        "income statement",
        "statement of income",
        "profit or loss",
        "profit and loss",
        "comprehensive income",
        "resultatregnskap",
    ),
    "balance": ("balance sheet", "financial position", "balanse"),
    "cash": ("cash flow", "kontantstrøm"),
}
_MAX_CONFLICTS_REPORTED = 20


def _cell_text(value: object) -> str:
    if value is None:
        return ""
    if isinstance(value, float) and value.is_integer():
        return str(int(value))
    return " ".join(str(value).split())


def _statement_kind(text: str) -> str | None:
    lowered = text.lower()
    for kind, keywords in _PRIMARY_STATEMENT_KEYWORDS.items():
        if any(keyword in lowered for keyword in keywords):
            return kind
    return None


def _is_primary_title(text: str) -> bool:
    return _statement_kind(text) is not None


@dataclass
class _Section:
    title: str
    is_primary: bool
    kind: str | None = None
    header: dict[int, PeriodLabel] = field(default_factory=dict)
    scale: Decimal | None = None
    currency: str | None = None
    lines: list[str] = field(default_factory=list)
    data_rows: list[tuple[str, list[object]]] = field(default_factory=list)
    page_number: int = 0


@dataclass
class _Candidate:
    priority: int
    value: Decimal
    label: str
    page: int
    confidence: float
    unit: str
    currency: str | None


def _header_periods(row: list[object]) -> dict[int, PeriodLabel] | None:
    periods: dict[int, PeriodLabel] = {}
    other_numbers = 0
    for idx, cell in enumerate(row):
        if cell is None or _cell_text(cell) == "":
            continue
        label = classify_period(cell if not isinstance(cell, str) else cell.strip())
        if label is not None:
            periods[idx] = label
        elif parse_statement_number(cell) is not None:
            other_numbers += 1
    # A data row whose values happen to be years (e.g. 2021, 2024) must not
    # read as a header: a real header row carries no other numbers, and a
    # single-column header needs an explicit label ("FY2024", "Q4 2025"),
    # not a bare number that could be a value.
    if other_numbers or not periods:
        return None
    # "Revenue | 2021 | 2024" is a data row whose values look like years.
    if any(match_metric(_cell_text(c)) for c in row if isinstance(c, str)):
        return None
    if len(periods) >= 2:
        return periods
    only = next(iter(periods.values()))
    if isinstance(row[next(iter(periods))], str) and not only.raw.strip().isdigit():
        return periods
    return None


def _row_label(row: list[object], first_value_col: int) -> str:
    for cell in row[:first_value_col]:
        text = _cell_text(cell)
        if text and parse_statement_number(cell) is None:
            return text
    return ""


def _text_cells(row: list[object]) -> list[str]:
    return [
        _cell_text(c)
        for c in row
        if _cell_text(c) and parse_statement_number(c) is None and classify_period(c) is None
    ]


def _sections_for_sheet(sheet_name: str, rows: list[list[object]]) -> list[_Section]:
    cleaned: list[list[object]] = []
    for row in rows:
        cells = list(row)
        while cells and _cell_text(cells[-1]) == "":
            cells.pop()
        if cells:
            cleaned.append(cells)

    sections: list[_Section] = [
        _Section(title=sheet_name, is_primary=_is_primary_title(sheet_name), kind=_statement_kind(sheet_name))
    ]
    header_rows = [_header_periods(r) for r in cleaned]

    for i, row in enumerate(cleaned):
        current = sections[-1]
        periods = header_rows[i]
        non_empty = [c for c in row if _cell_text(c)]
        line = "\t".join(_cell_text(c) for c in row)

        if periods is not None:
            if current.header and current.data_rows:
                # A new header after data without a title row: new table.
                current = _Section(title=current.title, is_primary=current.is_primary, kind=current.kind)
                sections.append(current)
            current.header = periods
            unit_text = " ".join(_text_cells(row))
            current.scale = detect_scale(unit_text) or current.scale
            current.currency = detect_currency(unit_text) or current.currency
            current.lines.append(line)
            continue

        if len(non_empty) == 1 and parse_statement_number(non_empty[0]) is None:
            text = _cell_text(non_empty[0])
            next_is_header = i + 1 < len(cleaned) and header_rows[i + 1] is not None
            kind = _statement_kind(text)
            # "Cash flows from investing activities" inside a cash-flow
            # statement is a sub-heading, not a new statement.
            new_statement = kind is not None and not (current.is_primary and current.kind == kind)
            if new_statement or next_is_header:
                carried_header = current.header if not next_is_header else {}
                section = _Section(
                    title=text,
                    is_primary=kind is not None,
                    kind=kind,
                    header=dict(carried_header),
                    scale=current.scale if carried_header else None,
                    currency=current.currency if carried_header else None,
                )
                section.scale = detect_scale(text) or section.scale
                section.currency = detect_currency(text) or section.currency
                sections.append(section)
                section.lines.append(text)
                continue
            # A sub-heading ("ASSETS", "Current assets") stays in its section;
            # a stand-alone unit line ("NOK million") sets the section scale.
            current.scale = current.scale or detect_scale(text)
            current.currency = current.currency or detect_currency(text)
            current.lines.append(line)
            continue

        current.lines.append(line)
        if current.header:
            first_value_col = min(current.header)
            label = _row_label(row, first_value_col)
            if label:
                current.data_rows.append((label, row))

    return [s for s in sections if s.lines]


def extract_statement_tables(sheets: list[tuple[str, list[list[object]]]]) -> ExtractionResult:
    """`sheets` is [(sheet name, rows)], rows as lists of raw cell values."""
    pages: list[ExtractedPage] = []
    flags: list[str] = []
    candidates: dict[tuple[str, str], list[_Candidate]] = {}
    page_number = 0

    for sheet_name, rows in sheets:
        sections = _sections_for_sheet(sheet_name, rows)
        if not sections:
            page_number += 1
            pages.append(ExtractedPage(page_number=page_number, text="", quality=quality_for_text("")))
            continue

        # Sheet-wide fallback when a section has no unit line of its own:
        # used only if every unit line in the sheet agrees.
        stated_scales = {s.scale for s in sections} - {None}
        stated_currencies = {s.currency for s in sections} - {None}
        sheet_scale = stated_scales.pop() if len(stated_scales) == 1 else None
        sheet_currency = stated_currencies.pop() if len(stated_currencies) == 1 else None
        use_only_primary = any(s.is_primary and s.data_rows for s in sections)

        for section in sections:
            page_number += 1
            section.page_number = page_number
            text = "\n".join(section.lines)
            pages.append(ExtractedPage(page_number=page_number, text=text, quality=quality_for_text(text)))

            if use_only_primary and not section.is_primary:
                continue
            scale = section.scale or sheet_scale
            currency = section.currency or sheet_currency
            for label, row in section.data_rows:
                metric = match_metric(label)
                if metric is None:
                    continue
                for col, period in section.header.items():
                    if period.kind != PERIOD_ANNUAL or col >= len(row):
                        continue
                    printed = parse_statement_number(row[col])
                    if printed is None:
                        continue
                    if metric == "shares_outstanding":
                        value, unit, confidence = printed, "shares", CONFIDENCE_SCALE_NOT_STATED
                    else:
                        value = printed * (scale or Decimal(1))
                        unit = currency or "unit"
                        confidence = CONFIDENCE_SCALE_STATED if scale else CONFIDENCE_SCALE_NOT_STATED
                    if metric in POSITIVE_MAGNITUDE_METRICS:
                        value = abs(value)
                    candidates.setdefault((metric, period.canonical), []).append(
                        _Candidate(
                            priority=label_priority(label),
                            value=value,
                            label=label,
                            page=section.page_number,
                            confidence=confidence,
                            unit=unit,
                            currency=currency,
                        )
                    )

    facts: list[ExtractedFact] = []
    conflicts: list[str] = []
    for (metric, period), found in candidates.items():
        best = min(c.priority for c in found)
        top = [c for c in found if c.priority == best]
        values = {c.value for c in top}
        if len(values) > 1:
            shown = "; ".join(f"'{c.label}' p{c.page} = {c.value.normalize():f}" for c in top[:4])
            conflicts.append(f"{period} {metric}: {shown}")
            continue
        chosen = top[0]
        if chosen.confidence < CONFIDENCE_SCALE_STATED and "scale_not_stated" not in flags:
            flags.append("scale_not_stated")
        facts.append(
            ExtractedFact(
                metric=metric,
                value=chosen.value,
                unit=chosen.unit,
                currency=chosen.currency,
                period=period,
                source_page=chosen.page,
                confidence=chosen.confidence,
            )
        )

    details: dict[str, object] = {}
    if conflicts:
        flags.append("fact_conflicts")
        details["fact_conflicts"] = conflicts[:_MAX_CONFLICTS_REPORTED]
    if not pages or not any(p.text.strip() for p in pages):
        flags.append("no_pages_extracted")
    return ExtractionResult(pages=pages, facts=facts, quality_flags=flags, details=details)
