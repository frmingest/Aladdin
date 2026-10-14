"""v4 siege-simulator settings (game mode, 2026-10-14): a second yardstick.

What changed from v3: nothing about how a holding is measured, the slider,
the coverage floor, the window or the sample-size floors. v4 only adds a
*choice* of what "the market" means.

Why: v2 and v3 measure every holding against OSEBX, the Oslo index. That is
right for Norwegian stocks and wrong for a world fund such as XDEF, whose
fall on a global sell-off OSEBX understates (noted in
docs/game/siege-instrument-sensitivity-2026-10-07.md). Faiz decided on
2026-10-14: add a global option, keep OSEBX for Norwegian stocks.

The global yardstick is ACWI, the iShares MSCI ACWI ETF (about 2,500 stocks in
developed and emerging markets). It is a *stand-in* for a world index, not the
index itself, and the page says so. It is listed in USD, so its closes are
converted to NOK with the same stored USD/NOK history that converts the
holdings' own prices; that way both sides of the comparison are what a
Norwegian saver actually experiences, currency moves included.

OSEBX stays the default: opening the page changes nothing until the reader
picks "World". Nothing is averaged or blended across the two yardsticks.

CLAUDE.md Rule 3: once these numbers have been shown for real, a change is a
new `siege_scenarios_v5.py`, not an edit of this file.
"""
from __future__ import annotations

from dataclasses import replace

from app.domain.game_mapping.siege_scenarios_v3 import SIEGE_SCENARIOS_V3

SIEGE_SCENARIOS_V4 = replace(
    SIEGE_SCENARIOS_V3,
    version="v4",
    benchmark_label="Oslo Børs Benchmark Index (OSEBX)",
    local_benchmark_ticker="OSEBX.OL",
    local_benchmark_label="Oslo Børs Benchmark Index (OSEBX)",
    global_benchmark_ticker="ACWI",
    global_benchmark_label="World stocks (ACWI fund, standing in for a world index)",
    global_benchmark_currency="USD",
)
