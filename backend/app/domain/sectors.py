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
