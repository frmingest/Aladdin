"""Instrument-type tagging for Holding.asset_class_raw.

`holdings.asset_class` is a legacy NOT NULL discriminator (see
app/models/holding.py) that this equity-only rebuild always hardcodes to
"equity" and never branches on, per CLAUDE.md ("the DB is not being
reset... don't alter legacy tables/columns without an explicit ask").

`asset_class_raw` is a different, always-writable column on the same
table, originally meant to carry the source's own reported category. Faiz
explicitly asked (2026-09-21, portfolio-CSV-import feature) that broker
exports mixing real equities with bond funds, money-market funds, equity
ETFs and a physical gold ETC all get imported — with their real instrument
type tagged — rather than skipping the non-equity rows or mislabeling them
as equity. This module is that tagging, using the existing column: no
migration, no change to `asset_class` itself, and nothing here makes the
analysis engine branch on it either — Sprint 4 (the Buffett/Munger engine)
was expected to only ever run against EQUITY_ANALYZABLE_TYPES. That changed:
Sprint 8 added the fund path and 2026-10-07 the income and commodity paths
(see ANALYZABLE_TYPES below); the equity-only roll-ups still use
EQUITY_ANALYZABLE_TYPES.
"""
from __future__ import annotations

import re

STOCK = "stock"
EQUITY_ETF = "equity_etf"
EQUITY_FUND = "equity_fund"
BOND_FUND = "bond_fund"
MONEY_MARKET_FUND = "money_market_fund"
COMMODITY_ETC = "commodity_etc"

INSTRUMENT_TYPES: tuple[str, ...] = (
    STOCK,
    EQUITY_ETF,
    EQUITY_FUND,
    BOND_FUND,
    MONEY_MARKET_FUND,
    COMMODITY_ETC,
)

# Sprint 8 (F9): the analysis engine has two paths.
# - STOCK_ANALYSIS_TYPES: the single-company path (financial statements,
#   DCF, moat of one business).
# - FUND_ANALYSIS_TYPES: the fund path (look-through to the businesses the
#   fund owns, plus cost, track record and construction of the wrapper) —
#   app/services/funds/. An equity ETF went through the single-company
#   path before Sprint 8, where it could never get financials or a DCF.
# A bond fund, money-market fund or physical-gold ETC has no businesses
# underneath to assess: they take their own paths, defined below.
STOCK_ANALYSIS_TYPES = frozenset({STOCK})
FUND_ANALYSIS_TYPES = frozenset({EQUITY_ETF, EQUITY_FUND})
EQUITY_ANALYZABLE_TYPES = STOCK_ANALYSIS_TYPES | FUND_ANALYSIS_TYPES

# Two more paths (2026-10-07, "analysis for every instrument type"):
# - INCOME_ANALYSIS_TYPES: bond and money-market funds. What matters is
#   yield, duration, credit quality and cost, not a business or a moat.
# - COMMODITY_ANALYSIS_TYPES: a physical-metal ETC. One asset, no cash
#   flow: cost, carry (what the metal gives up against a risk-free rate),
#   backing and premium/discount.
# EQUITY_ANALYZABLE_TYPES stays exactly as it was: the equity-only
# roll-ups (margin-of-safety board, portfolio risk and performance) must
# not start counting a bond fund as an equity. Only the analysis gates
# (readiness, queue, pipeline) use ANALYZABLE_TYPES.
INCOME_ANALYSIS_TYPES = frozenset({BOND_FUND, MONEY_MARKET_FUND})
COMMODITY_ANALYSIS_TYPES = frozenset({COMMODITY_ETC})
ANALYZABLE_TYPES = EQUITY_ANALYZABLE_TYPES | INCOME_ANALYSIS_TYPES | COMMODITY_ANALYSIS_TYPES
# Everything that is a wrapper (has Fund facts: profile, returns, holdings
# lists) rather than a single company.
WRAPPER_TYPES = ANALYZABLE_TYPES - STOCK_ANALYSIS_TYPES

PATH_STOCK = "stock"
PATH_FUND = "fund"
PATH_INCOME = "income"
PATH_COMMODITY = "commodity"


def is_fund_type(instrument_type: str) -> bool:
    return instrument_type in FUND_ANALYSIS_TYPES


def is_income_type(instrument_type: str) -> bool:
    return instrument_type in INCOME_ANALYSIS_TYPES


def is_commodity_type(instrument_type: str) -> bool:
    return instrument_type in COMMODITY_ANALYSIS_TYPES


def is_wrapper_type(instrument_type: str) -> bool:
    return instrument_type in WRAPPER_TYPES


def analysis_path(instrument_type: str) -> str | None:
    """Which analysis path a holding of this type takes (None = not analyzable)."""
    if instrument_type in STOCK_ANALYSIS_TYPES:
        return PATH_STOCK
    if instrument_type in FUND_ANALYSIS_TYPES:
        return PATH_FUND
    if instrument_type in INCOME_ANALYSIS_TYPES:
        return PATH_INCOME
    if instrument_type in COMMODITY_ANALYSIS_TYPES:
        return PATH_COMMODITY
    return None

_LABELS: dict[str, str] = {
    STOCK: "Stock",
    EQUITY_ETF: "Equity ETF",
    EQUITY_FUND: "Equity fund",
    BOND_FUND: "Bond fund",
    MONEY_MARKET_FUND: "Money-market fund",
    COMMODITY_ETC: "Commodity ETC",
}


def display_label(instrument_type: str) -> str:
    return _LABELS.get(instrument_type, instrument_type)


# Heuristic name-based classification: these broker exports carry no
# explicit instrument-type column (see
# app/services/portfolio_import/csv_parser.py), only a free-text security
# name. Ordered most-specific-first; falls through to STOCK, which is the
# right default for a bare company name like "Salmon Evolution" or
# "Vår Energi".
_MONEY_MARKET_PATTERN = re.compile(r"h[øo]yrente", re.IGNORECASE)
_BOND_PATTERN = re.compile(r"\b(high yield|obligasjon|bond|rente)\b", re.IGNORECASE)
_ETC_PATTERN = re.compile(r"\b(etc|xetra-gold|physical gold)\b", re.IGNORECASE)
_ETF_PATTERN = re.compile(r"\betf\b", re.IGNORECASE)
# Mutual funds (UCITS verdipapirfond). Many Norwegian fund names carry no
# marker at all ("Heimdal Utbytte A") — those fall through to STOCK and are
# re-tagged by hand on the Holdings page.
_FUND_PATTERN = re.compile(r"\b(fund|fond|aksjefond|indeksfond|indeks|index)\b", re.IGNORECASE)


# Norwegian/Nordic fund managers whose product names often carry no marker
# at all ("Heimdal Utbytte N", "Skagen Vekst A"). Checked after every
# specific pattern above, so "Heimdal Høyrente Pluss B" is still a
# money-market fund and "Alfred Berg Nordic High Yield" a bond fund; a bare
# manager-name product is an equity fund. Deliberately a short list: a name
# like "DNB" or "Storebrand" is also a listed company.
_FUND_MANAGER_PATTERN = re.compile(r"^(heimdal|alfred berg|skagen|holberg|delphi)\b", re.IGNORECASE)


def classify_instrument(name: str) -> str:
    """Best-effort instrument-type guess from a security's display name.

    Never raises — an unrecognized name is treated as a plain stock, which
    is the safest default (it just means it's included in equity analysis
    eligibility rather than silently excluded).
    """
    if _MONEY_MARKET_PATTERN.search(name):
        return MONEY_MARKET_FUND
    if _ETC_PATTERN.search(name):
        return COMMODITY_ETC
    if _BOND_PATTERN.search(name):
        return BOND_FUND
    if _ETF_PATTERN.search(name):
        return EQUITY_ETF
    if _FUND_PATTERN.search(name) or _FUND_MANAGER_PATTERN.search(name):
        return EQUITY_FUND
    return STOCK
