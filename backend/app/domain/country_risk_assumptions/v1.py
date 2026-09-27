"""v1 country-risk assumptions: the slim Sovereign Stress Index (SSI)
ported from the CWO repo's sovereign_stress_calculator.py (frmingest/CWO
at 4400fda) for Dalio mode's country-risk section (Epic F22, story 22.10;
claude/analyst-modes-epic-f22-2026-09-27.md §4a #1-3).

CLAUDE.md Rule 3: these weights and thresholds shape a real analysis's
evidence, so a change is a new version file, never an edit of v1 after a
real run has used it.

What was kept from CWO, unchanged: the six components and their weights
(which sum to 1 — tested), the stress thresholds of each component, the
partial-coverage reweighting (the SSI is the weighted mean of the
components that have data) and the data-quality flag by component count.

What was changed, and why (economist review, ECON-F22-07/11/12):

- **No crisis probabilities.** CWO maps SSI bands to 2/8/25/55% 12-month
  crisis probabilities through a hard-coded step function with no
  calibration evidence in its repo (ECON-F22-07). Aladdin reports the score
  and band only.
- **Fiscal balance sign fixed (ECON-F22-11).** CWO took `abs()` of the
  World Bank net lending/borrowing figure, so a *surplus* (Norway runs
  large ones) scored as the same stress as an equally large *deficit*.
  Here a surplus is treated as a zero deficit (lowest stress band).
- **Linear WGI mapping (ECON-F22-12).** CWO mapped the WGI estimate
  (-2.5..+2.5) to 1-10 with 6 + 1.6x, which puts 0 at 6 and never reaches
  1. v1 uses the straight linear map 5.5 + 1.8x (-2.5 -> 1, 0 -> 5.5,
  +2.5 -> 10), clamped to 1..10.
- **Growth is the latest actual, not a forecast.** CWO's "growth
  expectations" input came from a hard-coded, now ~2-year-stale IMF WEO
  table (§4b). v1 uses the World Bank's latest *actual* real GDP growth
  and says so in the evidence.
- **ECON-009 (from CWO's own notes):** political stability uses WGI PV.EST
  only — never GPI as well, which would double-count the same thing.

Indicators (World Bank API v2, keyless; WGI via source=3):
  GC.DOD.TOTL.GD.ZS  central government debt, % of GDP
  GC.NLD.TOTL.GD.ZS  net lending (+) / net borrowing (-), % of GDP
  BN.CAB.XOKA.GD.ZS  current account balance, % of GDP
  FI.RES.TOTL.MO     total reserves in months of imports
  DT.DOD.DECT.CD     external debt stocks, current US$ (low/middle-income
                     reporters only — missing for most developed countries)
  FI.RES.TOTL.CD     total reserves incl. gold, current US$
  NY.GDP.MKTP.KD.ZG  real GDP growth, annual %
  PV.EST             WGI political stability and absence of violence
"""
from __future__ import annotations

from dataclasses import dataclass
from decimal import Decimal


@dataclass(frozen=True)
class IndicatorSpec:
    code: str
    label: str
    source: str  # "world_bank" | "world_bank_wgi"
    wb_source_id: int | None = None  # the World Bank API `source=` parameter, when not the default


@dataclass(frozen=True)
class CountryRiskAssumptions:
    version: str
    weights: dict[str, Decimal]
    debt_gdp_bands: tuple[tuple[Decimal, int], ...]  # (upper bound exclusive, stress); last = everything above
    debt_gdp_above_top: int
    debt_trajectory_adjustments: tuple[tuple[Decimal, int], ...]  # (rise in pp over 3y avg, +stress)
    debt_falling_threshold: Decimal
    debt_falling_adjustment: int
    deficit_bands: tuple[tuple[Decimal, int], ...]
    deficit_above_top: int
    current_account_bands: tuple[tuple[Decimal, int], ...]  # (lower bound exclusive, stress), checked in order
    current_account_below_all: int
    reserve_months_bands: tuple[tuple[Decimal, int], ...]
    reserve_months_below_all: int
    external_debt_reserves_bands: tuple[tuple[Decimal, int], ...]
    external_debt_reserves_above_all: int
    growth_bands: tuple[tuple[Decimal, int], ...]
    growth_below_all: int
    stress_bands: tuple[tuple[Decimal, str], ...]
    indicators: tuple[IndicatorSpec, ...]
    history_years: int


COUNTRY_RISK_ASSUMPTIONS_V1 = CountryRiskAssumptions(
    version="v1",
    weights={
        "debt_trajectory": Decimal("0.30"),
        "fiscal_deficit": Decimal("0.20"),
        "current_account": Decimal("0.15"),
        "reserve_coverage": Decimal("0.15"),
        "political_stability": Decimal("0.10"),
        "growth": Decimal("0.10"),
    },
    # Debt/GDP: <40 -> 10, <60 -> 30, <90 -> 60, else 85.
    debt_gdp_bands=((Decimal(40), 10), (Decimal(60), 30), (Decimal(90), 60)),
    debt_gdp_above_top=85,
    # vs the 3-year average: > +10pp -> +15, > +5pp -> +8; < -5pp -> -10.
    debt_trajectory_adjustments=((Decimal(10), 15), (Decimal(5), 8)),
    debt_falling_threshold=Decimal(-5),
    debt_falling_adjustment=-10,
    # Deficit (% GDP, positive = deficit): <2 -> 10, <4 -> 35, <6 -> 65, else 90.
    deficit_bands=((Decimal(2), 10), (Decimal(4), 35), (Decimal(6), 65)),
    deficit_above_top=90,
    # Current account: >3 -> 5, >0 -> 15, >-3 -> 35, >-5 -> 60, else 85.
    current_account_bands=((Decimal(3), 5), (Decimal(0), 15), (Decimal(-3), 35), (Decimal(-5), 60)),
    current_account_below_all=85,
    # Reserves in months of imports: >6 -> 10, >4 -> 30, >2 -> 60, else 90.
    reserve_months_bands=((Decimal(6), 10), (Decimal(4), 30), (Decimal(2), 60)),
    reserve_months_below_all=90,
    # External debt / reserves (%): <50 -> 10, <100 -> 30, <200 -> 60, else 90.
    external_debt_reserves_bands=((Decimal(50), 10), (Decimal(100), 30), (Decimal(200), 60)),
    external_debt_reserves_above_all=90,
    # Real GDP growth (%): >4 -> 10, >2 -> 30, >0 -> 55, >-2 -> 75, else 95.
    growth_bands=((Decimal(4), 10), (Decimal(2), 30), (Decimal(0), 55), (Decimal(-2), 75)),
    growth_below_all=95,
    stress_bands=(
        (Decimal(25), "Low stress"),
        (Decimal(50), "Moderate stress"),
        (Decimal(75), "High stress"),
        (Decimal(101), "Critical stress"),
    ),
    indicators=(
        IndicatorSpec("GC.DOD.TOTL.GD.ZS", "Central government debt (% of GDP)", "world_bank"),
        IndicatorSpec("GC.NLD.TOTL.GD.ZS", "Government net lending/borrowing (% of GDP)", "world_bank"),
        IndicatorSpec("BN.CAB.XOKA.GD.ZS", "Current account balance (% of GDP)", "world_bank"),
        IndicatorSpec("FI.RES.TOTL.MO", "Total reserves (months of imports)", "world_bank"),
        IndicatorSpec("DT.DOD.DECT.CD", "External debt stocks (current US$)", "world_bank"),
        IndicatorSpec("FI.RES.TOTL.CD", "Total reserves incl. gold (current US$)", "world_bank"),
        IndicatorSpec("NY.GDP.MKTP.KD.ZG", "Real GDP growth (annual %)", "world_bank"),
        IndicatorSpec("PV.EST", "WGI political stability and absence of violence (estimate)", "world_bank_wgi", 3),
    ),
    history_years=6,
)


def wgi_to_score(estimate: Decimal) -> Decimal:
    """WGI estimate (-2.5..+2.5) -> 1..10, linear (ECON-F22-12)."""
    score = Decimal("5.5") + Decimal("1.8") * estimate
    return max(Decimal(1), min(Decimal(10), score))
