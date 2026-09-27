"""Which country a holding's country-risk evidence is about (Epic F22).

Holdings carry no country or ISIN column, so for a **stock** the domicile
proxy is its listing exchange, read from the ticker suffix (Yahoo-style:
KOG.OL -> Norway, no suffix -> United States). That is the listing
country, which for these holdings is also the home country, but it is not
revenue exposure (ECON-F22-03: revenue-by-geography is backlog) — the
evidence text says so.

For a **fund/ETF/ETC** the listing or ISIN prefix says nothing about what
it owns (ECON-F22-08: an IE-domiciled UCITS ETF is not "Ireland
exposure"), so country weights come only from the fund's own stored
look-through (Fund facts -> country exposures). No look-through = a stated
gap, never a guess.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from decimal import Decimal

from sqlalchemy.orm import Session

from app.domain.instrument_types import STOCK
from app.models.holding import Holding

# Yahoo exchange suffix -> ISO 3166-1 alpha-3 of the listing country.
_SUFFIX_TO_ISO3: dict[str, str] = {
    "OL": "NOR", "ST": "SWE", "CO": "DNK", "HE": "FIN", "IC": "ISL",
    "DE": "DEU", "F": "DEU", "BE": "DEU", "MU": "DEU", "SG": "DEU", "HM": "DEU", "DU": "DEU",
    "PA": "FRA", "AS": "NLD", "BR": "BEL", "MI": "ITA", "MC": "ESP", "LS": "PRT", "VI": "AUT",
    "SW": "CHE", "L": "GBR", "IR": "IRL", "TO": "CAN", "V": "CAN", "AX": "AUS", "T": "JPN",
    "HK": "HKG", "SS": "CHN", "SZ": "CHN", "KS": "KOR", "NS": "IND", "BO": "IND", "WA": "POL",
}

COUNTRY_NAMES: dict[str, str] = {
    "NOR": "Norway", "SWE": "Sweden", "DNK": "Denmark", "FIN": "Finland", "ISL": "Iceland",
    "DEU": "Germany", "FRA": "France", "NLD": "Netherlands", "BEL": "Belgium", "ITA": "Italy",
    "ESP": "Spain", "PRT": "Portugal", "AUT": "Austria", "CHE": "Switzerland", "GBR": "United Kingdom",
    "IRL": "Ireland", "USA": "United States", "CAN": "Canada", "AUS": "Australia", "JPN": "Japan",
    "HKG": "Hong Kong", "CHN": "China", "KOR": "South Korea", "IND": "India", "POL": "Poland",
    "TWN": "Taiwan", "BRA": "Brazil", "MEX": "Mexico", "ZAF": "South Africa", "ISR": "Israel",
}
_NAME_TO_ISO3: dict[str, str] = {name.lower(): code for code, name in COUNTRY_NAMES.items()}
_NAME_TO_ISO3.update(
    {
        "us": "USA", "usa": "USA", "united states of america": "USA", "u.s.": "USA", "uk": "GBR",
        "great britain": "GBR", "korea": "KOR", "republic of korea": "KOR", "norge": "NOR",
        "sverige": "SWE", "danmark": "DNK", "tyskland": "DEU", "frankrike": "FRA", "sveits": "CHE",
        "storbritannia": "GBR", "nederland": "NLD", "finland": "FIN", "japan": "JPN", "kina": "CHN",
    }
)

# Currency of each country (euro members -> EUR).
_EURO = {"DEU", "FRA", "NLD", "BEL", "ITA", "ESP", "PRT", "AUT", "IRL", "FIN"}
COUNTRY_CURRENCY: dict[str, str] = {
    **{c: "EUR" for c in _EURO},
    "NOR": "NOK", "SWE": "SEK", "DNK": "DKK", "ISL": "ISK", "CHE": "CHF", "GBR": "GBP", "USA": "USD",
    "CAN": "CAD", "AUS": "AUD", "JPN": "JPY", "HKG": "HKD", "CHN": "CNY", "KOR": "KRW", "IND": "INR",
    "POL": "PLN", "TWN": "TWD", "BRA": "BRL", "MEX": "MXN", "ZAF": "ZAR", "ISR": "ILS",
}
# The IMF's SDR basket (2022 review): the five currencies the IMF itself
# treats as freely usable reserve currencies. A classification fact, not a
# data series — used only as a yes/no label in the evidence.
SDR_BASKET_CURRENCIES = ("USD", "EUR", "CNY", "JPY", "GBP")


def country_from_label(label: str) -> str | None:
    return _NAME_TO_ISO3.get(label.strip().lower())


def listing_country(ticker: str) -> str:
    if "." in ticker:
        suffix = ticker.rsplit(".", 1)[1].upper()
        return _SUFFIX_TO_ISO3.get(suffix, "")
    return "USA"


@dataclass
class CountryExposure:
    """Country weights for one holding, summing to <= 100."""

    weights: dict[str, Decimal] = field(default_factory=dict)  # iso3 -> % of the holding
    basis: str = ""  # how the weights were derived, shown in the evidence
    unmapped_pct: Decimal = Decimal(0)  # look-through weight whose label couldn't be mapped
    gap: str | None = None  # set when no weights could be derived


def country_exposure(db: Session, holding: Holding) -> CountryExposure:
    if holding.asset_class_raw == STOCK:
        iso3 = listing_country(holding.ticker)
        if not iso3:
            return CountryExposure(gap=f"unknown listing exchange for ticker {holding.ticker!r}")
        return CountryExposure(
            weights={iso3: Decimal(100)},
            basis="listing country from the ticker's exchange suffix (domicile proxy; not revenue by geography)",
        )
    from app.services.funds.facts import latest_exposures

    as_of, rows = latest_exposures(db, holding.id, "country")
    if not rows:
        return CountryExposure(
            gap="no country look-through on file for this fund/ETF/ETC (Fund facts); its domicile or "
            "ISIN prefix is not treated as exposure (ECON-F22-08)"
        )
    exposure = CountryExposure(basis=f"fund look-through country weights as of {as_of}")
    for row in rows:
        iso3 = country_from_label(row.label)
        if iso3 is None:
            exposure.unmapped_pct += row.weight_pct
            continue
        exposure.weights[iso3] = exposure.weights.get(iso3, Decimal(0)) + row.weight_pct
    return exposure
