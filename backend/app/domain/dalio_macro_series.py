"""Versioned catalogue of the extra FRED series Dalio mode cites (Epic F22,
story 22.3), ported as *catalogue entries* — not code — from the CWO
repo's fed_liquidity_fetcher.py and dedollarization_fetcher.py
(claude/analyst-modes-epic-f22-2026-09-27.md §4a #4-5). Aladdin already has
a FRED provider (app/providers/macro_data_providers.py), so nothing else
from those fetchers is needed (and none of their fallbacks come along).

Kept separate from app/domain/macro_series.py's `_V1` on purpose: that
catalogue feeds every Buffett/Munger evidence packet, and adding series to
it would change those packets (CLAUDE.md Rule 3). These series are fetched
into the same `macro_observations` table but only the Dalio packet reads
them. Selected by Settings.active_dalio_macro_series_version.

Units matter here (Fed net liquidity mixes a millions series with
billions ones) — every derived figure is computed in
app/services/dalio/macro.py with the unit conversion written out
(CLAUDE.md Rule 1).
"""
from __future__ import annotations

from app.domain.macro_series import MacroSeriesSpec

_DALIO_V1: tuple[MacroSeriesSpec, ...] = (
    # --- Liquidity: Fed net liquidity = WALCL - WTREGEN - RRPONTSYD ------------
    MacroSeriesSpec(
        key="us_fed_total_assets", label="Fed total assets (balance sheet)", source="fred",
        source_series_id="WALCL", region="US", unit="usd_mn", display_unit="USD mn", frequency="weekly",
        change_kind="pct", stale_after_days=14, group="liquidity",
        description="Federal Reserve total assets, Wednesday level, millions of US dollars.",
    ),
    MacroSeriesSpec(
        key="us_treasury_general_account", label="US Treasury General Account", source="fred",
        source_series_id="WTREGEN", region="US", unit="usd_bn", display_unit="USD bn", frequency="weekly",
        change_kind="pct", stale_after_days=14, group="liquidity",
        description="Treasury deposits at the Fed (TGA), weekly average, billions of US dollars. Rising TGA drains liquidity.",
    ),
    MacroSeriesSpec(
        key="us_reverse_repo", label="Fed overnight reverse repo (ON RRP)", source="fred",
        source_series_id="RRPONTSYD", region="US", unit="usd_bn", display_unit="USD bn", frequency="daily",
        change_kind="pct", stale_after_days=7, group="liquidity",
        description="Overnight reverse repurchase agreements with the Fed, billions of US dollars. Rising RRP drains liquidity.",
    ),
    # --- US long-term debt cycle ------------------------------------------------
    MacroSeriesSpec(
        key="us_federal_debt_gdp", label="US federal debt / GDP", source="fred",
        source_series_id="GFDEGDQ188S", region="US", unit="percent", display_unit="%", frequency="quarterly",
        stale_after_days=200, group="debt",
        description="Total public debt as a percent of GDP (quarterly, seasonally adjusted). Published with a lag of about a quarter.",
    ),
    MacroSeriesSpec(
        key="us_federal_interest_outlays", label="US federal interest payments", source="fred",
        source_series_id="A091RC1Q027SBEA", region="US", unit="usd_bn", display_unit="USD bn",
        frequency="quarterly", change_kind="pct", stale_after_days=200, group="debt",
        description="Federal government current expenditures: interest payments, billions of US dollars, seasonally adjusted annual rate.",
    ),
    MacroSeriesSpec(
        key="us_federal_receipts", label="US federal current receipts", source="fred",
        source_series_id="FGRECPT", region="US", unit="usd_bn", display_unit="USD bn", frequency="quarterly",
        change_kind="pct", stale_after_days=200, group="debt",
        description="Federal government current receipts, billions of US dollars, seasonally adjusted annual rate.",
    ),
    MacroSeriesSpec(
        key="us_foreign_treasury_holdings", label="US federal debt held by foreign investors", source="fred",
        source_series_id="FDHBFIN", region="US", unit="usd_bn", display_unit="USD bn", frequency="quarterly",
        change_kind="pct", stale_after_days=200, group="debt",
        description="Federal debt held by foreign and international investors, billions of US dollars.",
    ),
    # --- Currency ---------------------------------------------------------------
    MacroSeriesSpec(
        key="us_broad_dollar_index", label="Broad US dollar index (nominal)", source="fred",
        source_series_id="DTWEXBGS", region="US", unit="index", display_unit="index", frequency="daily",
        change_kind="pct", stale_after_days=10, group="fx",
        description="Nominal broad US dollar index against major trading partners (Jan 2006 = 100). Up = stronger dollar.",
    ),
)

DALIO_MACRO_SERIES_VERSIONS: dict[str, tuple[MacroSeriesSpec, ...]] = {"dalio_v1": _DALIO_V1}


def get_dalio_macro_series(version: str) -> tuple[MacroSeriesSpec, ...]:
    try:
        return DALIO_MACRO_SERIES_VERSIONS[version]
    except KeyError as exc:
        raise ValueError(f"Unknown Dalio macro series version: {version!r}") from exc
