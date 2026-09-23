"""Deterministic parsing of numbers and period labels as printed in
company financial-statement tables (IR "factsheet" CSV/XLSX downloads).

CLAUDE.md Rule 1: every value that becomes a FinancialLineItem is parsed
here, in code — never by the LLM. Anything ambiguous parses to None and is
simply not promoted to a fact (it stays in the page text).
"""
from __future__ import annotations

import re
from dataclasses import dataclass
from decimal import Decimal, InvalidOperation

# Characters statement tables use as thousands separators besides , and .
_SPACES = re.compile(r"[\s    ']")
_DASHES_ONLY = re.compile(r"^[-–—−]+$")


def parse_statement_number(raw: object) -> Decimal | None:
    """'2 657 ' -> 2657, '(1 359)' -> -1359, '-14 762' -> -14762,
    '1,234.5' -> 1234.5, '1.234,5' -> 1234.5, '- ' -> 0 (a dash is how
    statements print a nil line), '#REF!'/'n/a'/'' -> None.

    A single separator followed by exactly three digits is a thousands
    separator ('1,234' -> 1234), matching how statement tables print; a
    number like '1,5' is a decimal comma.
    """
    if raw is None:
        return None
    if isinstance(raw, bool):
        return None
    if isinstance(raw, (int, float, Decimal)):
        try:
            return Decimal(str(raw))
        except InvalidOperation:
            return None
    text = str(raw).strip()
    if not text:
        return None
    if _DASHES_ONLY.match(text):
        return Decimal(0)
    text = text.replace("−", "-").replace("–", "-")
    negative = False
    if text.startswith("(") and text.endswith(")"):
        negative = True
        text = text[1:-1].strip()
    if text.startswith("-"):
        negative = not negative
        text = text[1:].strip()
    if text.endswith("%"):  # a ratio, not an amount
        return None
    text = _SPACES.sub("", text)
    if not text or not re.fullmatch(r"[\d.,]+", text) or not re.search(r"\d", text):
        return None
    if "," in text and "." in text:
        decimal_sep = "," if text.rfind(",") > text.rfind(".") else "."
        thousands_sep = "." if decimal_sep == "," else ","
        text = text.replace(thousands_sep, "").replace(decimal_sep, ".")
    elif "," in text or "." in text:
        sep = "," if "," in text else "."
        parts = text.split(sep)
        if len(parts) > 2 or (len(parts) == 2 and len(parts[1]) == 3 and parts[0] != "0"):
            text = text.replace(sep, "")
        else:
            text = text.replace(sep, ".")
    try:
        value = Decimal(text)
    except InvalidOperation:
        return None
    return -value if negative else value


# --- period labels ----------------------------------------------------------

PERIOD_ANNUAL = "annual"
PERIOD_QUARTER = "quarter"
PERIOD_PARTIAL = "partial"  # H1, 9M, YTD before Q4, a non-year-end date
PERIOD_EXCLUDED = "excluded"  # estimates, LTM — never imported


@dataclass(frozen=True)
class PeriodLabel:
    kind: str
    year: int
    raw: str

    @property
    def canonical(self) -> str:
        """The FinancialLineItem.period string — only annual periods are
        stored, as 'FY2025' (the convention SEC EDGAR imports use too)."""
        return f"FY{self.year}"


def _year(token: str) -> int | None:
    if len(token) == 4:
        year = int(token)
    elif len(token) == 2:
        year = 2000 + int(token)
    else:
        return None
    return year if 1980 <= year <= 2100 else None


_Y = r"(\d{4}|\d{2})"
_PATTERNS: tuple[tuple[re.Pattern[str], str], ...] = (
    (re.compile(rf"^(?:fy|full[- ]?year|year)\s*{_Y}$"), PERIOD_ANNUAL),
    (re.compile(rf"^{_Y}\s*fy$"), PERIOD_ANNUAL),
    (re.compile(r"^(\d{4})\s*a?$"), PERIOD_ANNUAL),  # "2025", "2025A" (actual)
    (re.compile(rf"^(?:ytd\s*q4|q4\s*ytd|12\s*m|fy\s*ytd|ytd\s*fy)\s*{_Y}$"), PERIOD_ANNUAL),
    (re.compile(r"^(?:31[./ -]12[./ -]|31\s*dec(?:ember)?\.?\s*|dec(?:ember)?\.?\s*31,?\s*)(\d{4})$"),
     PERIOD_ANNUAL),
    (re.compile(rf"^q[1-4]\s*[-/']?\s*{_Y}$"), PERIOD_QUARTER),
    (re.compile(rf"^[1-4]q\s*[-/']?\s*{_Y}$"), PERIOD_QUARTER),
    (re.compile(rf"^{_Y}\s*q[1-4]$"), PERIOD_QUARTER),
    (re.compile(rf"^(?:ytd\s*q[1-3]|q[1-3]\s*ytd|ytd|h[12]|[369]\s*m|[1-3]h)\s*{_Y}$"), PERIOD_PARTIAL),
    (re.compile(r"^\d{1,2}[./ -]\d{1,2}[./ -](\d{4})$"), PERIOD_PARTIAL),
    (re.compile(r"^(\d{4})\s*(?:e|f|est\.?|estimate|budget|guidance)$"), PERIOD_EXCLUDED),
    (re.compile(rf"^(?:ltm|ttm)\s*{_Y}?$"), PERIOD_EXCLUDED),
)


def classify_period(raw: object) -> PeriodLabel | None:
    """'FY 2025' / 'YTD Q4\\n2025' / '2025' / '31.12.2025' -> annual 2025;
    'Q1 2026' / 'Q1\\n2026' -> quarter; 'YTD 2026' / 'H1 2025' -> partial;
    '2026E' -> excluded; anything else -> None (not a period column)."""
    if raw is None or isinstance(raw, bool):
        return None
    if isinstance(raw, (int, float)):
        if float(raw).is_integer() and 1980 <= int(raw) <= 2100:
            return PeriodLabel(PERIOD_ANNUAL, int(raw), str(int(raw)))
        return None
    text = " ".join(str(raw).lower().split())
    if not text or len(text) > 30:
        return None
    for pattern, kind in _PATTERNS:
        match = pattern.match(text)
        if match:
            year_token = next((g for g in match.groups() if g), None)
            year = _year(year_token) if year_token else None
            if year is None:
                return None
            if kind == PERIOD_PARTIAL and re.match(r"^31[./ -]12[./ -]", text):
                kind = PERIOD_ANNUAL
            return PeriodLabel(kind, year, str(raw).strip())
    return None


# --- scale and currency -----------------------------------------------------

_SCALE_PATTERNS: tuple[tuple[re.Pattern[str], Decimal], ...] = (
    (re.compile(r"\b(?:billions?|bn|mrd|milliarder)\b|\b(?:nok|usd|eur|sek|dkk)\s?bn\b"), Decimal(1_000_000_000)),
    (re.compile(r"\b(?:millions?|mill?\.?|mln|mn)\b|\bm(?:nok|usd|eur|sek|dkk)\b|\b(?:nok|usd|eur|sek|dkk)\s?m\b"),
     Decimal(1_000_000)),
    (re.compile(r"\b(?:thousands?|tusen)\b|\bt(?:nok|usd|eur|sek|dkk)\b|\bk(?:nok|usd|eur)\b|\b1[ .,]?000\b|'000"),
     Decimal(1_000)),
)
_CURRENCIES = ("NOK", "USD", "EUR", "SEK", "DKK", "GBP", "CHF", "JPY", "CAD", "AUD")
# "NOK", "MNOK", "TNOK", "USDm", "NOK bn" — but not the "NOK" inside "NOKIA".
_CURRENCY_PATTERN = re.compile(r"(?<![A-Z])[MTK]?(" + "|".join(_CURRENCIES) + r")(?:M|BN)?(?![A-Z])")


def detect_scale(text: str) -> Decimal | None:
    lowered = " ".join(text.lower().split())
    for pattern, scale in _SCALE_PATTERNS:
        if pattern.search(lowered):
            return scale
    return None


def detect_currency(text: str) -> str | None:
    found = {m.group(1) for m in _CURRENCY_PATTERN.finditer(text.upper())}
    return found.pop() if len(found) == 1 else None
