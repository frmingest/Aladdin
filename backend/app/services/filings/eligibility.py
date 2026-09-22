"""Which primary sources apply to a holding, and the name-match guard.

Routing is by ticker: an Oslo ticker (``.OL`` suffix) or a NOK-traded
holding gets Newsweb; any ticker SEC's map knows gets EDGAR. A Norwegian
dual-listed SEC filer (e.g. Equinor, EQNR.OL -> EQNR, files a 20-F) gets
both. Because a bare Oslo sign can collide with an unrelated US symbol,
an EDGAR match is only accepted when SEC's registered name agrees with the
holding's name — see ``names_match``.
"""
from __future__ import annotations

import re
import unicodedata

from app.models.holding import Holding

_NOISE = {
    "asa", "as", "ab", "abp", "plc", "inc", "incorporated", "corp", "corporation",
    "co", "company", "ltd", "limited", "sa", "nv", "se", "ag", "group", "holding",
    "holdings", "the", "class", "cl", "a", "b", "adr", "ord", "shs", "de", "llc",
}
_TRANSLIT = str.maketrans({"æ": "ae", "ø": "o", "å": "a", "Æ": "ae", "Ø": "o", "Å": "a"})


def _tokens(name: str) -> list[str]:
    text = name.translate(_TRANSLIT)
    text = unicodedata.normalize("NFKD", text).encode("ascii", "ignore").decode().lower()
    return [t for t in re.split(r"[^a-z0-9]+", text) if t and t not in _NOISE]


def names_match(holding_name: str, registered_name: str) -> bool:
    """True when the first significant word of both names agrees
    ("Equinor ASA" ~ "EQUINOR ASA", "Apple Inc." ~ "Apple Inc")."""
    a, b = _tokens(holding_name), _tokens(registered_name)
    return bool(a and b and a[0] == b[0])


def has_foreign_suffix(ticker: str) -> bool:
    return "." in ticker.strip()


def newsweb_applies(holding: Holding) -> bool:
    ticker = holding.ticker.strip().upper()
    return ticker.endswith(".OL") or (holding.trading_currency or "").upper() == "NOK"
