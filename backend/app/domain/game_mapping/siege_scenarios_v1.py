"""v1 siege-simulator settings (game mode G13, 2026-10-03).

The Siege Simulator is a what-if, never a forecast. The only number the user
chooses is the size of a market fall; everything else is stored data (each
holding's stored beta and value) or an existing game threshold (the
gathering / besieged lines in `game_mapping/v1.py`). Nothing here is a
prediction and no scenario percentage is invented: the slider range is a
convenience for the reader, not a claim about likelihood.

CLAUDE.md Rule 3: once these numbers have been shown for real, a change is a
new `siege_scenarios_v2.py`, not an edit of this file.

Why these values:
- Slider 5% to 60% in 5-point steps, starting at 20%: wide enough to include
  an ordinary correction (about 10%) and a 2008- or 2020-sized fall, narrow
  enough that every step is a different picture.
- Beta coverage of at least 50% of the equity value: with less than half the
  book carrying a stored beta, a portfolio total would describe the covered
  half only, so the result is "cannot judge" instead of a number.
- Reverse search (the fall that reaches a line) is scanned in 0.1-point steps.
"""
from __future__ import annotations

from dataclasses import dataclass, replace
from decimal import Decimal


@dataclass(frozen=True)
class SiegeScenarios:
    version: str
    drop_min: Decimal
    drop_max: Decimal
    drop_step: Decimal
    drop_default: Decimal
    min_beta_coverage: Decimal
    reverse_search_step: Decimal
    # --- added with v2 (2026-10-07); v1 keeps these defaults and so behaves exactly as before ---
    # Where each holding's sensitivity comes from. v1: the stored vendor beta only.
    # v2: the holding's own stored price history against `benchmark_ticker`.
    sensitivity_method: str = "vendor_beta"
    benchmark_ticker: str = ""
    history_lookback_days: int = 0
    min_observations: int = 0
    min_down_days: int = 0
    weak_fit_r_squared: Decimal = Decimal(0)
    flat_share_warning: Decimal = Decimal(1)
    # --- added with v3 (2026-10-13); v1 and v2 keep the default and so behave exactly as before ---
    # v3: the share of the book that could not be modelled is stated in the result itself.
    name_unmodelled_in_headline: bool = False
    # --- added with v4 (2026-10-14); earlier versions keep these defaults and so behave exactly as before ---
    # v4: the reader may choose the yardstick. "local" is `local_benchmark_ticker` (OSEBX); "global" is
    # `global_benchmark_ticker` (a stand-in fund for a world index, listed in `global_benchmark_currency`
    # and converted to NOK like every holding). `benchmark_key` says which one is active in this copy.
    benchmark_label: str = ""
    benchmark_key: str = "local"
    local_benchmark_ticker: str = ""
    local_benchmark_label: str = ""
    global_benchmark_ticker: str = ""
    global_benchmark_label: str = ""
    global_benchmark_currency: str = ""

    def with_benchmark(self, key: str) -> SiegeScenarios:
        """This scenarios file with the chosen yardstick active. Raises ValueError for an
        unknown key, or for "global" when this version has no global yardstick."""
        if key == "local":
            if not self.local_benchmark_ticker:
                return self  # v2 and v3: OSEBX is the only yardstick and is already active
            return replace(
                self,
                benchmark_key="local",
                benchmark_ticker=self.local_benchmark_ticker,
                benchmark_label=self.local_benchmark_label,
            )
        if key == "global":
            if not self.global_benchmark_ticker:
                raise ValueError("this siege scenarios version has no global benchmark")
            return replace(
                self,
                benchmark_key="global",
                benchmark_ticker=self.global_benchmark_ticker,
                benchmark_label=self.global_benchmark_label,
            )
        raise ValueError(f"unknown benchmark {key!r}; expected 'local' or 'global'")


SIEGE_SCENARIOS_V1 = SiegeScenarios(
    version="v1",
    drop_min=Decimal("0.05"),
    drop_max=Decimal("0.60"),
    drop_step=Decimal("0.05"),
    drop_default=Decimal("0.20"),
    min_beta_coverage=Decimal("0.50"),
    reverse_search_step=Decimal("0.001"),
)

def get_siege_scenarios(version: str) -> SiegeScenarios:
    # Imported here: v2, v3 and v4 build on the SiegeScenarios class above.
    from app.domain.game_mapping.siege_scenarios_v2 import SIEGE_SCENARIOS_V2
    from app.domain.game_mapping.siege_scenarios_v3 import SIEGE_SCENARIOS_V3
    from app.domain.game_mapping.siege_scenarios_v4 import SIEGE_SCENARIOS_V4

    versions: dict[str, SiegeScenarios] = {
        "v1": SIEGE_SCENARIOS_V1,
        "v2": SIEGE_SCENARIOS_V2,
        "v3": SIEGE_SCENARIOS_V3,
        "v4": SIEGE_SCENARIOS_V4,
    }
    try:
        return versions[version]
    except KeyError as exc:
        raise ValueError(f"Unknown siege scenarios version: {version!r}") from exc
