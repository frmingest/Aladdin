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
}


def normalize_asset_class(raw: str) -> AssetClass:
    """Best-effort normalization. Unknown labels map to OTHER rather than
    raising — §21 favors explicit low-confidence flags over rejecting an
    otherwise-valid row outright; the raw string is retained by the caller."""
    if raw is None:
        return AssetClass.OTHER
    key = raw.strip().lower()
    return _ALIASES.get(key, AssetClass.OTHER)
