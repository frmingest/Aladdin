"""Physical precious-metal coin catalogue (1oz gold/silver bullion coins).

Faiz asked to track physical 1oz gold and silver coins as part of his
investments (2026-09-26) — real bullion he holds, not a paper ETC (which
already has a code, COMMODITY_ETC, in app/domain/instrument_types.py for
the equity-only rebuild's CSV-import path; that's a brokerage-held security
with a ticker and a price feed, this is a manually-entered physical asset
with neither).

This is a plain reference catalogue, like app/domain/sectors.py — a fixed
list of real, currently-minted 1oz bullion coin series, not a judgment call
(CLAUDE.md Rule 3 versioning is for assumptions that shape a computed
number; this list shapes nothing, it's just what's selectable). Faiz can
ask for a series to be added any time; that's a one-line code change, no
migration needed, since `PreciousMetalHolding.coin_series` (see
app/models/precious_metal.py) stores this catalogue's `code` as a plain
string, validated against `is_valid_series()` at write time.

Every entry is a coin actually minted/sold in a 1oz (troy ounce) format —
`weight_oz` is always Decimal("1") today, but kept as a field (not a
constant) in case a fractional-weight series is ever added.
"""
from __future__ import annotations

from dataclasses import dataclass
from decimal import Decimal

GOLD = "gold"
SILVER = "silver"
METALS: tuple[str, ...] = (GOLD, SILVER)

# The metal's own spot-price ticker, as this app's own price cache keys it
# (app/models/risk.py's PriceHistoryObservation, reused for metals — see
# app/services/precious_metals/pricing.py). Not a vendor symbol; an
# internal identifier this app chose.
SPOT_TICKER: dict[str, str] = {GOLD: "XAUUSD", SILVER: "XAGUSD"}
METAL_LABEL: dict[str, str] = {GOLD: "Gold", SILVER: "Silver"}


@dataclass(frozen=True)
class CoinSeries:
    code: str
    name: str
    metal: str
    country: str
    weight_oz: Decimal = Decimal("1")


# 15 gold + 15 silver — real, currently-minted 1oz bullion coin series,
# ordered roughly by how commonly they're traded/held (most liquid first).
COIN_SERIES: tuple[CoinSeries, ...] = (
    # --- Gold ---
    CoinSeries("american_eagle_gold", "American Eagle", GOLD, "United States"),
    CoinSeries("canadian_maple_leaf_gold", "Canadian Maple Leaf", GOLD, "Canada"),
    CoinSeries("krugerrand_gold", "Krugerrand", GOLD, "South Africa"),
    CoinSeries("australian_kangaroo_gold", "Australian Kangaroo", GOLD, "Australia"),
    CoinSeries("britannia_gold", "Britannia", GOLD, "United Kingdom"),
    CoinSeries("vienna_philharmonic_gold", "Vienna Philharmonic", GOLD, "Austria"),
    CoinSeries("china_panda_gold", "China Panda", GOLD, "China"),
    CoinSeries("mexican_libertad_gold", "Mexican Libertad", GOLD, "Mexico"),
    CoinSeries("american_buffalo_gold", "American Buffalo", GOLD, "United States"),
    CoinSeries("australian_lunar_gold", "Australian Lunar Series", GOLD, "Australia"),
    CoinSeries("somalia_elephant_gold", "Somalia Elephant", GOLD, "Somalia"),
    CoinSeries("queens_beasts_gold", "Queen's Beasts", GOLD, "United Kingdom"),
    CoinSeries("wedge_tailed_eagle_gold", "Wedge-Tailed Eagle", GOLD, "Australia"),
    CoinSeries("big_five_gold", "Big Five", GOLD, "Rwanda"),
    CoinSeries("st_helena_sovereign_gold", "St Helena Sovereign", GOLD, "St Helena"),
    # --- Silver ---
    CoinSeries("american_eagle_silver", "American Eagle", SILVER, "United States"),
    CoinSeries("canadian_maple_leaf_silver", "Canadian Maple Leaf", SILVER, "Canada"),
    CoinSeries("krugerrand_silver", "Krugerrand", SILVER, "South Africa"),
    CoinSeries("australian_kookaburra_silver", "Australian Kookaburra", SILVER, "Australia"),
    CoinSeries("britannia_silver", "Britannia", SILVER, "United Kingdom"),
    CoinSeries("vienna_philharmonic_silver", "Vienna Philharmonic", SILVER, "Austria"),
    CoinSeries("china_panda_silver", "China Panda", SILVER, "China"),
    CoinSeries("mexican_libertad_silver", "Mexican Libertad", SILVER, "Mexico"),
    CoinSeries("australian_kangaroo_silver", "Australian Kangaroo", SILVER, "Australia"),
    CoinSeries("somalia_elephant_silver", "Somalia Elephant", SILVER, "Somalia"),
    CoinSeries("queens_beasts_silver", "Queen's Beasts", SILVER, "United Kingdom"),
    CoinSeries("armenian_noahs_ark_silver", "Noah's Ark", SILVER, "Armenia"),
    CoinSeries("wedge_tailed_eagle_silver", "Wedge-Tailed Eagle", SILVER, "Australia"),
    CoinSeries("big_five_silver", "Big Five", SILVER, "Rwanda"),
    CoinSeries("st_helena_sovereign_silver", "St Helena Sovereign", SILVER, "St Helena"),
)

_BY_CODE: dict[str, CoinSeries] = {c.code: c for c in COIN_SERIES}


def is_valid_series(code: str) -> bool:
    return code in _BY_CODE


def get_series(code: str) -> CoinSeries:
    try:
        return _BY_CODE[code]
    except KeyError as exc:
        raise ValueError(f"Unknown coin series: {code!r}") from exc


def series_for_metal(metal: str) -> list[CoinSeries]:
    return [c for c in COIN_SERIES if c.metal == metal]


def display_name(code: str) -> str:
    c = _BY_CODE.get(code)
    return f"{c.name} ({c.country})" if c else code
