"""Rules for the Norwegian ticker catalogue behind Sal's shop (2026-11-11).

Two deterministic mappings, both versioned by `CATALOGUE_RULES_VERSION` (CLAUDE.md Rule 1: no
LLM, no guessing):

* Yahoo's own sector names -> the app's sector list (`app/domain/sectors.py`), so a company picked
  from the shop arrives on the watchlist with the sector the Map and the sector pages already use.
  A Yahoo sector the table does not know stays unmapped (None): "not yet classified" is an honest
  state, never a guess.
* market value in NOK -> a size band. Only a NOK value gets a band; a value in another currency, or
  none at all, is "unknown" (fog), not a rounded guess.
"""
from __future__ import annotations

from decimal import Decimal

from app.domain.sectors import SECTORS

CATALOGUE_RULES_VERSION = "catalogue-v1"

EXCHANGE_OSLO = "OSL"
"""Yahoo's exchange code for Oslo Børs and Euronext Growth/Expand Oslo (all quoted as `.OL`)."""
OSLO_SUFFIX = ".OL"
OSLO_CURRENCY = "NOK"

YAHOO_SECTORS: tuple[str, ...] = (
    "Basic Materials",
    "Communication Services",
    "Consumer Cyclical",
    "Consumer Defensive",
    "Energy",
    "Financial Services",
    "Healthcare",
    "Industrials",
    "Real Estate",
    "Technology",
    "Utilities",
)
"""The eleven sector names Yahoo's screener accepts (yfinance `EquityQuery`, field `sector`)."""

_YAHOO_TO_APP_SECTOR: dict[str, str] = {
    "Basic Materials": "Materials",
    "Communication Services": "Communication Services",
    "Consumer Cyclical": "Consumer Discretionary",
    "Consumer Defensive": "Consumer Staples",
    "Energy": "Energy",
    "Financial Services": "Financials",
    "Healthcare": "Health Care",
    "Industrials": "Industrials",
    "Real Estate": "Real Estate",
    "Technology": "Information Technology",
    "Utilities": "Utilities",
}

assert all(v in SECTORS for v in _YAHOO_TO_APP_SECTOR.values())  # the two lists cannot drift apart


def app_sector(yahoo_sector: str | None) -> str | None:
    """The app's sector for a Yahoo sector name, or None when Yahoo gave none or one we do not know."""
    if not yahoo_sector:
        return None
    return _YAHOO_TO_APP_SECTOR.get(yahoo_sector.strip())


# Size bands by market value in NOK. Lower bounds are inclusive.
GIANT_FROM = Decimal(50000000000)  # 50 bn
BIG_FROM = Decimal(10000000000)  # 10 bn
SMALL_FROM = Decimal(1000000000)  # 1 bn

SIZE_GIANT, SIZE_BIG, SIZE_SMALL, SIZE_TINY, SIZE_UNKNOWN = "giant", "big", "small", "tiny", "unknown"
SIZE_BANDS: tuple[str, ...] = (SIZE_GIANT, SIZE_BIG, SIZE_SMALL, SIZE_TINY, SIZE_UNKNOWN)


def size_band(market_cap: Decimal | float | None, currency: str | None) -> str:
    """giant (>= 50 bn NOK), big (>= 10 bn), small (>= 1 bn), tiny (below), or unknown.

    Unknown when there is no value, the value is not positive, or it is not in NOK: converting would
    need an FX rate this module deliberately does not fetch.
    """
    if market_cap is None or (currency or "").upper() != OSLO_CURRENCY:
        return SIZE_UNKNOWN
    value = Decimal(str(market_cap))
    if value <= 0:
        return SIZE_UNKNOWN
    if value >= GIANT_FROM:
        return SIZE_GIANT
    if value >= BIG_FROM:
        return SIZE_BIG
    if value >= SMALL_FROM:
        return SIZE_SMALL
    return SIZE_TINY


def is_oslo_symbol(symbol: str | None) -> bool:
    """A Yahoo symbol on Oslo (`EQNR.OL`): a non-empty root and the `.OL` suffix, upper case."""
    if not symbol:
        return False
    s = symbol.strip().upper()
    return s.endswith(OSLO_SUFFIX) and len(s) > len(OSLO_SUFFIX)
