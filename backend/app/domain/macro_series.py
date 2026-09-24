"""Versioned catalogue of the numeric macro series Aladdin captures
(2026-09-24, "numeric macro data" — deferred twice out of Sprint 2).

Each entry names one official series at its publisher: Norges Bank's
open data API (SDMX), the St. Louis Fed's FRED API, or Statistics Norway
(SSB). Norway's CPI comes from SSB because the OECD copy on FRED
(NORCPIALLMINMEI) stopped updating in 2025, and Norges Bank does not
publish CPI itself.

CLAUDE.md Rule 3: the set of series feeds the analysis evidence packet, so
a change that could alter a real analysis is a *new* version (`_V2`, ...),
selected by Settings.active_macro_series_version — never an in-place edit
of `_V1` once it has been used in a real run.

CLAUDE.md Rule 1: `transform` says how the stored raw values become the
figure shown and cited. "yoy_pct" (a price index -> 12-month % change) is
computed in app/services/macro/indicators.py, never by the LLM.
"""
from __future__ import annotations

from dataclasses import dataclass
from typing import Literal

Source = Literal["norges_bank", "fred", "ssb"]
Transform = Literal["level", "yoy_pct"]
# How a change over time is expressed: percentage points for rates and
# spreads, percent for levels like an exchange rate.
ChangeKind = Literal["pp", "pct"]


@dataclass(frozen=True)
class MacroSeriesSpec:
    key: str  # stable app-level key, stored as macro_observations.series_key
    label: str
    source: Source
    source_series_id: str  # publisher's own id, e.g. "IR/B.KPRA.SD.R", "DGS10", "14710/KpiIndMnd"
    region: str  # "NO" | "US"
    unit: str  # unit of the *stored* raw value: "percent" | "index" | "NOK"
    display_unit: str  # unit of the figure after `transform`: "%" | "NOK"
    frequency: Literal["daily", "monthly"]
    transform: Transform = "level"
    change_kind: ChangeKind = "pp"
    # An observation older than this is flagged stale (publication lag
    # included: US CPI for August is published mid-September).
    stale_after_days: int = 7
    group: str = "rates"  # "rates" | "inflation" | "fx" | "labour" | "credit" — UI grouping
    description: str = ""

    @property
    def source_name(self) -> str:
        return {"norges_bank": "Norges Bank", "fred": "FRED (Federal Reserve Bank of St. Louis)", "ssb": "Statistics Norway (SSB)"}[
            self.source
        ]

    @property
    def source_url(self) -> str:
        if self.source == "norges_bank":
            flow, key = self.source_series_id.split("/", 1)
            return f"https://data.norges-bank.no/api/data/{flow}/{key}?format=sdmx-json&lastNObservations=1&locale=en"
        if self.source == "fred":
            return f"https://fred.stlouisfed.org/series/{self.source_series_id}"
        table = self.source_series_id.split("/", 1)[0]
        return f"https://www.ssb.no/en/statbank/table/{table}"


@dataclass(frozen=True)
class DerivedIndicatorSpec:
    """A figure computed from two catalogue series: `left - right`, both
    after their own transform (e.g. real policy rate = policy rate - CPI y/y)."""

    key: str
    label: str
    left: str
    right: str
    region: str
    description: str


_V1: tuple[MacroSeriesSpec, ...] = (
    # --- Norway: Norges Bank -------------------------------------------------
    MacroSeriesSpec(
        key="no_policy_rate", label="Norges Bank policy rate", source="norges_bank",
        source_series_id="IR/B.KPRA.SD.R", region="NO", unit="percent", display_unit="%",
        frequency="daily", description="Sight deposit rate on banks' reserves up to their quota.",
    ),
    MacroSeriesSpec(
        key="no_nowa", label="NOWA overnight rate", source="norges_bank",
        source_series_id="SHORT_RATES/B.NOWA.ON.R", region="NO", unit="percent", display_unit="%",
        frequency="daily", description="Norwegian Overnight Weighted Average, the NOK risk-free reference rate.",
    ),
    MacroSeriesSpec(
        key="no_3m_bill", label="Norway 3-month T-bill yield", source="norges_bank",
        source_series_id="GOVT_GENERIC_RATES/B.3M.TBIL", region="NO", unit="percent", display_unit="%",
        frequency="daily", description="Generic 3-month Norwegian treasury bill yield.",
    ),
    MacroSeriesSpec(
        key="no_10y", label="Norway 10-year government bond yield", source="norges_bank",
        source_series_id="GOVT_GENERIC_RATES/B.10Y.GBON", region="NO", unit="percent", display_unit="%",
        frequency="daily", description="Generic 10-year Norwegian government bond yield.",
    ),
    MacroSeriesSpec(
        key="usd_nok", label="USD/NOK", source="norges_bank", source_series_id="EXR/B.USD.NOK.SP",
        region="NO", unit="NOK", display_unit="NOK", frequency="daily", change_kind="pct", group="fx",
        description="NOK per US dollar, Norges Bank daily reference rate. Up = weaker krone.",
    ),
    MacroSeriesSpec(
        key="eur_nok", label="EUR/NOK", source="norges_bank", source_series_id="EXR/B.EUR.NOK.SP",
        region="NO", unit="NOK", display_unit="NOK", frequency="daily", change_kind="pct", group="fx",
        description="NOK per euro, Norges Bank daily reference rate. Up = weaker krone.",
    ),
    # --- Norway: SSB ---------------------------------------------------------
    MacroSeriesSpec(
        key="no_cpi_yoy", label="Norway CPI inflation (12-month)", source="ssb",
        source_series_id="14710/KpiIndMnd", region="NO", unit="index", display_unit="%",
        frequency="monthly", transform="yoy_pct", stale_after_days=75, group="inflation",
        description="12-month change in the consumer price index (2025=100), computed from the index.",
    ),
    # --- United States: FRED -------------------------------------------------
    MacroSeriesSpec(
        key="us_fed_funds_upper", label="Fed funds target rate (upper bound)", source="fred",
        source_series_id="DFEDTARU", region="US", unit="percent", display_unit="%", frequency="daily",
        description="Upper limit of the FOMC's federal funds target range.",
    ),
    MacroSeriesSpec(
        key="us_10y", label="US 10-year Treasury yield", source="fred", source_series_id="DGS10",
        region="US", unit="percent", display_unit="%", frequency="daily",
        description="10-year Treasury constant-maturity yield.",
    ),
    MacroSeriesSpec(
        key="us_10y_2y", label="US yield curve (10y minus 2y)", source="fred", source_series_id="T10Y2Y",
        region="US", unit="percent", display_unit="%", frequency="daily",
        description="Negative = inverted curve, historically a recession warning.",
    ),
    MacroSeriesSpec(
        key="us_cpi_yoy", label="US CPI inflation (12-month)", source="fred", source_series_id="CPIAUCSL",
        region="US", unit="index", display_unit="%", frequency="monthly", transform="yoy_pct",
        stale_after_days=75, group="inflation",
        description="12-month change in CPI for all urban consumers (seasonally adjusted), computed from the index.",
    ),
    MacroSeriesSpec(
        key="us_unemployment", label="US unemployment rate", source="fred", source_series_id="UNRATE",
        region="US", unit="percent", display_unit="%", frequency="monthly", stale_after_days=60,
        group="labour", description="Civilian unemployment rate, seasonally adjusted.",
    ),
    MacroSeriesSpec(
        key="us_hy_spread", label="US high-yield credit spread", source="fred",
        source_series_id="BAMLH0A0HYM2", region="US", unit="percent", display_unit="%",
        frequency="daily", group="credit",
        description="ICE BofA US High Yield option-adjusted spread over Treasuries. Wider = more credit stress.",
    ),
)

_DERIVED_V1: tuple[DerivedIndicatorSpec, ...] = (
    DerivedIndicatorSpec(
        key="no_real_policy_rate", label="Norway real policy rate", left="no_policy_rate",
        right="no_cpi_yoy", region="NO",
        description="Policy rate minus 12-month CPI inflation. Positive = monetary policy is restrictive in real terms.",
    ),
    DerivedIndicatorSpec(
        key="us_real_policy_rate", label="US real policy rate", left="us_fed_funds_upper",
        right="us_cpi_yoy", region="US",
        description="Fed funds upper bound minus 12-month CPI inflation.",
    ),
    DerivedIndicatorSpec(
        key="no_us_10y_spread", label="Norway minus US 10-year yield", left="no_10y", right="us_10y",
        region="NO",
        description="Positive = Norwegian long rates above US ones.",
    ),
)

MACRO_SERIES_VERSIONS: dict[str, tuple[MacroSeriesSpec, ...]] = {"v1": _V1}
DERIVED_INDICATOR_VERSIONS: dict[str, tuple[DerivedIndicatorSpec, ...]] = {"v1": _DERIVED_V1}


def get_macro_series(version: str) -> tuple[MacroSeriesSpec, ...]:
    try:
        return MACRO_SERIES_VERSIONS[version]
    except KeyError as exc:
        raise ValueError(f"Unknown macro series version: {version!r}") from exc


def get_derived_indicators(version: str) -> tuple[DerivedIndicatorSpec, ...]:
    try:
        return DERIVED_INDICATOR_VERSIONS[version]
    except KeyError as exc:
        raise ValueError(f"Unknown macro series version: {version!r}") from exc
