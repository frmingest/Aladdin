"""Which typed-in figures each analysis path asks for (2026-10-07).

A bond fund, a money-market fund and a physical-metal ETC have no financial
statements and no company look-through, so their analysis rests on a short
list of figures from the fact sheet / KID / issuer page. Each figure is typed
in on the holding page and cites the uploaded document it came from (the
same rule as every fund figure, decision 23: no LLM reads a number out of a
PDF). This file is the registry of the allowed keys; the service
(app/services/instruments/facts.py) rejects anything else.

Adding a key never changes an old run: runs store their own evidence
packet. Removing or re-meaning a key is a new packet version.
"""
from __future__ import annotations

from dataclasses import dataclass
from decimal import Decimal

from app.domain.instrument_types import PATH_COMMODITY, PATH_INCOME


@dataclass(frozen=True)
class FactSpec:
    key: str
    label: str
    kind: str  # "number" | "text"
    unit: str = ""
    minimum: Decimal | None = None
    maximum: Decimal | None = None
    help: str = ""


def _n(key: str, label: str, unit: str, lo: int | str, hi: int | str, help: str = "") -> FactSpec:
    return FactSpec(key, label, "number", unit, Decimal(str(lo)), Decimal(str(hi)), help)


def _t(key: str, label: str, help: str = "") -> FactSpec:
    return FactSpec(key, label, "text", help=help)


INCOME_FACTS: tuple[FactSpec, ...] = (
    _n("yield_to_maturity_pct", "Yield to maturity", "% per year", 0, 60,
       "The fund's own stated yield to maturity (before the ongoing charge unless the document says otherwise)."),
    _n("distribution_yield_pct", "Distribution yield", "% per year", 0, 60,
       "Trailing 12-month distributions as a share of price, if the fund pays out."),
    _n("effective_duration_years", "Effective duration", "years", 0, 30,
       "How far the price moves for a 1 percentage point change in rates (about 1 % per year of duration)."),
    _n("average_maturity_years", "Average maturity", "years", 0, 60),
    _n("weighted_avg_maturity_days", "Weighted average maturity (money-market)", "days", 0, 800,
       "Money-market funds: average days to maturity of the holdings."),
    _t("average_credit_rating", "Average credit rating", "E.g. A-, BBB, BB+ — as the fund states it."),
    _n("high_yield_share_pct", "Below investment grade share", "% of fund", 0, 100),
    _n("largest_issuer_pct", "Largest single issuer", "% of fund", 0, 100),
    _t("currency_hedging", "Currency hedging", "E.g. hedged to NOK, unhedged, partly hedged."),
    _t("liquidity_note", "Liquidity / redemption terms",
       "E.g. daily dealing, swing pricing, notice period — copied from the document."),
)

COMMODITY_FACTS: tuple[FactSpec, ...] = (
    _t("metal", "Metal", "E.g. gold."),
    _t("backing", "What backs the certificate",
       "E.g. fully allocated physical bullion, unallocated bullion, futures, a debt claim on the issuer."),
    _t("custodian", "Custodian and vault location"),
    _t("redemption_right", "Right to physical delivery",
       "Whether and how a holder can take delivery of the metal, copied from the document."),
    _t("issuer_structure", "Issuer structure",
       "E.g. German bearer bond secured by the metal, UCITS fund, special-purpose vehicle."),
    _n("metal_per_unit_g", "Metal per unit", "grams", 0, 1_000_000,
       "Grams of metal each unit is entitled to (e.g. about 0.31 g per Xetra-Gold unit)."),
    _n("nav_per_unit", "Value of the metal per unit (NAV)", "trading currency", 0, 10_000_000,
       "What the metal behind one unit is worth on the same date as the market price below."),
    _n("market_price_per_unit", "Market price per unit", "trading currency", 0, 10_000_000,
       "The exchange price on the same date as the NAV above; the premium or discount is computed from both."),
    _n("total_metal_held_tonnes", "Total metal held for all holders", "tonnes", 0, 1_000_000),
)

FACTS_BY_PATH: dict[str, tuple[FactSpec, ...]] = {
    PATH_INCOME: INCOME_FACTS,
    PATH_COMMODITY: COMMODITY_FACTS,
}


def fact_specs_for(path: str | None) -> tuple[FactSpec, ...]:
    return FACTS_BY_PATH.get(path or "", ())


def fact_spec(path: str | None, key: str) -> FactSpec | None:
    return next((s for s in fact_specs_for(path) if s.key == key), None)
