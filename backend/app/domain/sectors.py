"""Canonical sector list for Holding.sector.

Faiz asked (2026-09-21, CSV-import ticker/duplicate-holdings fix session)
for sector to be a dropdown, not free text, in the frontend's manual-edit
UI — this module is the single source of truth both sides validate
against (app/api/holdings.py's `GET /holdings/field-options` serves this
list to the frontend; `HoldingCreate`/`HoldingUpdate` in
app/schemas/holding.py reject anything not in it), so the two can't drift
the way `asset_class_raw`'s free-text heuristic classification already has
(see app/domain/instrument_types.py).

Standard GICS-11 sectors. `sector` stays nullable — "not yet classified"
is still a valid, honest state; it's a free-text drift into ten spellings
of "Energy" that this closes off.
"""
from __future__ import annotations

SECTORS: tuple[str, ...] = (
    "Energy",
    "Materials",
    "Industrials",
    "Consumer Discretionary",
    "Consumer Staples",
    "Health Care",
    "Financials",
    "Information Technology",
    "Communication Services",
    "Utilities",
    "Real Estate",
)

_SECTOR_SET = frozenset(SECTORS)


def is_valid_sector(sector: str) -> bool:
    return sector in _SECTOR_SET


# Banks and insurers (2026-09-29). Owner earnings, net debt, interest cover
# and ROIC do not mean for them what they mean for an industrial company:
# interest is their cost of goods, and their profit is not free to distribute
# because regulators require capital to be retained. Matched case-insensitively
# against Holding.sector (which the GICS list above spells "Financials").
FINANCIAL_SECTOR_KEYWORDS: tuple[str, ...] = ("financ", "bank", "insur")


def is_financial_sector(sector: str | None) -> bool:
    lowered = (sector or "").lower()
    return bool(lowered) and any(keyword in lowered for keyword in FINANCIAL_SECTOR_KEYWORDS)
