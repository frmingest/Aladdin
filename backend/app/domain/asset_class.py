"""
Canonical asset-class normalization (architecture §7).

The portfolio upload format is "schema-flexible but validate against a stable
canonical schema" — Faiz's own exports use Norwegian labels (Aksje/ETF/Fond/
Cash). We store one canonical value so downstream code (concentration,
scoring, risk) never has to branch on language or spelling, but we keep the
raw label the user supplied for traceability (§5.2 — provenance).
"""

from enum import Enum


class AssetClass(str, Enum):
    EQUITY = "EQUITY"
    ETF = "ETF"
    FUND = "FUND"
    CASH = "CASH"
    BOND = "BOND"
    # Phase 8 (ADR 0011) — physical precious metals (gold/silver coins) and
    # similar alternative assets with no brokerage ticker of their own. Plain
    # string columns throughout (Holding.asset_class is String(16), not a DB
    # enum), so adding these is additive: no migration, and every existing
    # consumer that groups by asset_class (concentration, risk) already
    # treats it as an open set of string keys rather than an exhaustive
    # switch (checked per ADR 0011's own Consequences note).
    COMMODITY = "COMMODITY"
    # Phase 8 (ADR 0011) — collectibles with no live pricing feed (e.g. a
    # whisky collection); carried at cost basis, see Holding.custody_type
    # for "where it physically sits" and PortfolioPosition.acquired_at for
    # per-lot purchase dates.
    COLLECTIBLE = "COLLECTIBLE"
    OTHER = "OTHER"


# Raw label (lowercased) -> canonical AssetClass. Extend as new export formats
# show up rather than making the parser reject unfamiliar-but-valid labels.
_ALIASES: dict[str, AssetClass] = {
    "aksje": AssetClass.EQUITY,
    "aksjer": AssetClass.EQUITY,
    "equity": AssetClass.EQUITY,
    "equities": AssetClass.EQUITY,
    "stock": AssetClass.EQUITY,
    "etf": AssetClass.ETF,
    "fond": AssetClass.FUND,
    "fund": AssetClass.FUND,
    "mutual fund": AssetClass.FUND,
    "cash": AssetClass.CASH,
    "kontanter": AssetClass.CASH,
    "bond": AssetClass.BOND,
    "obligasjon": AssetClass.BOND,
    # Phase 8 (ADR 0011) — precious metals / physical commodities.
    "commodity": AssetClass.COMMODITY,
    "commodities": AssetClass.COMMODITY,
    "gold": AssetClass.COMMODITY,
    "silver": AssetClass.COMMODITY,
    "precious metal": AssetClass.COMMODITY,
    "precious metals": AssetClass.COMMODITY,
    "edelmetall": AssetClass.COMMODITY,
    # Phase 8 (ADR 0011) — collectibles (e.g. a whisky collection).
    "collectible": AssetClass.COLLECTIBLE,
    "collectibles": AssetClass.COLLECTIBLE,
    "whisky": AssetClass.COLLECTIBLE,
    "whiskey": AssetClass.COLLECTIBLE,
}


def normalize_asset_class(raw: str) -> AssetClass:
    """Best-effort normalization. Unknown labels map to OTHER rather than
    raising — §21 favors explicit low-confidence flags over rejecting an
    otherwise-valid row outright; the raw string is retained by the caller."""
    if raw is None:
        return AssetClass.OTHER
    key = raw.strip().lower()
    return _ALIASES.get(key, AssetClass.OTHER)
