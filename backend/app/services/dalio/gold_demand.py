"""Central-bank gold demand — a static, curated dataset (Epic F22, story
22.10), ported from the CWO repo's cb_demand_fetcher.py (its ADR DATA-006:
the World Gold Council publishes this quarterly, with no open API, so a
dated dataset in code is the honest data model).

Source: World Gold Council, Gold Demand Trends
(https://www.gold.org/goldhub/research/gold-demand-trends), net tonnes
bought (+) or sold (-) by central banks. Values exactly as in CWO at
4400fda; CWO's own "Dalio annotation" prose and top-buyer list were not
ported (commentary, not data).

MANUAL REFRESH NEEDED: add each new quarter after WGC publishes it
(~6 weeks after quarter end) and move DATA_AS_OF. The evidence item says
how many quarters behind the dataset is, so a stale copy is never passed
off as current.
"""
from __future__ import annotations

from dataclasses import dataclass
from datetime import date
from decimal import Decimal

DATA_AS_OF = (2025, 1)  # (year, quarter) of the newest entry
SOURCE = "World Gold Council, Gold Demand Trends — https://www.gold.org/goldhub/research/gold-demand-trends"

# (year, quarter, net tonnes), oldest first.
QUARTERLY_NET_TONNES: tuple[tuple[int, int, Decimal], ...] = (
    (2020, 1, Decimal(93)), (2020, 2, Decimal(90)), (2020, 3, Decimal(44)), (2020, 4, Decimal(28)),
    (2021, 1, Decimal(91)), (2021, 2, Decimal(100)), (2021, 3, Decimal(107)), (2021, 4, Decimal(152)),
    (2022, 1, Decimal(82)), (2022, 2, Decimal(124)), (2022, 3, Decimal(459)), (2022, 4, Decimal(417)),
    (2023, 1, Decimal(228)), (2023, 2, Decimal(175)), (2023, 3, Decimal(337)), (2023, 4, Decimal(297)),
    (2024, 1, Decimal(290)), (2024, 2, Decimal(183)), (2024, 3, Decimal(186)), (2024, 4, Decimal(333)),
    (2025, 1, Decimal(244)),
)
# WGC full-year totals (as reported in each year's full-year report).
ANNUAL_NET_TONNES: dict[int, Decimal] = {
    2015: Decimal(588), 2016: Decimal(384), 2017: Decimal(375), 2018: Decimal(656), 2019: Decimal(650),
    2020: Decimal(255), 2021: Decimal(450), 2022: Decimal(1082), 2023: Decimal(1037), 2024: Decimal(1045),
}


@dataclass(frozen=True)
class GoldDemandSummary:
    as_of: str
    quarters_behind: int
    last_four_quarters: list[tuple[str, Decimal]]
    last_four_total: Decimal
    avg_2015_2021: Decimal
    avg_2022_2024: Decimal


def latest_publishable_quarter(today: date) -> tuple[int, int]:
    """The newest quarter WGC would have published by `today` (quarter end
    + ~6 weeks)."""
    year, quarter = today.year, (today.month - 1) // 3 + 1
    # The current quarter is never published yet; the previous one is once
    # ~6 weeks of this quarter have passed.
    year, quarter = (year - 1, 4) if quarter == 1 else (year, quarter - 1)
    first_month = (today.month - 1) // 3 * 3 + 1
    if (today - date(today.year, first_month, 1)).days < 45:
        year, quarter = (year - 1, 4) if quarter == 1 else (year, quarter - 1)
    return year, quarter


def summarize(today: date) -> GoldDemandSummary:
    latest_year, latest_q = latest_publishable_quarter(today)
    behind = (latest_year * 4 + latest_q) - (DATA_AS_OF[0] * 4 + DATA_AS_OF[1])
    last_four = QUARTERLY_NET_TONNES[-4:]
    early = [ANNUAL_NET_TONNES[y] for y in range(2015, 2022)]
    late = [ANNUAL_NET_TONNES[y] for y in range(2022, 2025)]
    return GoldDemandSummary(
        as_of=f"Q{DATA_AS_OF[1]} {DATA_AS_OF[0]}",
        quarters_behind=max(0, behind),
        last_four_quarters=[(f"Q{q} {y}", t) for y, q, t in last_four],
        last_four_total=sum(t for _y, _q, t in last_four),
        avg_2015_2021=(sum(early) / len(early)).quantize(Decimal(1)),
        avg_2022_2024=(sum(late) / len(late)).quantize(Decimal(1)),
    )


def describe(summary: GoldDemandSummary) -> str:
    quarters = ", ".join(f"{p}: {t:.0f} t" for p, t in summary.last_four_quarters)
    text = (
        f"Central-bank net gold purchases, last four quarters in the dataset: {quarters} "
        f"(total {summary.last_four_total:.0f} t). Annual average 2015-2021: {summary.avg_2015_2021} t; "
        f"2022-2024: {summary.avg_2022_2024} t (computed from WGC full-year totals)."
    )
    if summary.quarters_behind > 0:
        text += (
            f" STALE: dataset ends {summary.as_of}, {summary.quarters_behind} published quarter(s) behind — "
            "a static dataset that needs a manual refresh."
        )
    return text
