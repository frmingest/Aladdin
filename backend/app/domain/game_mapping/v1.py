"""v1 game mapping (2026-10-01) — how stored, deterministic values become
fortress properties in game mode (docs/game-mode-fortress-2026-10-01.md).

These are judgment calls, not fetched data, and they decide what Faiz sees
about his real holdings. CLAUDE.md Rule 3: never edit these numbers once
they have been shown for real — add v2.py and bump
`Settings.active_game_mapping_version` instead.

Why these values:
- Net debt / EBITDA 1x / 2.5x / 4x: under 1x is a business that could repay
  its debt from one year of operating earnings; 2.5x is a common comfort
  limit for stable cash generators; above 4x is where creditors, not
  owners, set the terms. Net cash is the only "basalt".
- Interest cover under 3x: a bad year of EBIT would not comfortably pay the
  interest bill, so the wall is one tier weaker than the leverage alone says.
- Financials use equity / total assets: 10% / 7% / 5%. The 5% floor matches
  `DEPLETED_EQUITY_SHARE_OF_ASSETS` in app/services/metrics.py.
- Footprint 15% / 7% / 3%: a 15%+ position is a great keep; Buffett-style
  concentration shows up as a few large towers, not many small ones.
- Freshness 90 / 180 days: 180 equals the portfolio overview's
  STALE_ANALYSIS_DAYS, so the game and the Dashboard agree on "stale".
- Shacks: positions under 2% of the portfolio. Two to four is a light
  shantytown, five or more a heavy one.
- Vault 20% / 10% / 3% of cash + portfolio.
- Sieges (added in G4, additive: no earlier value above changed): a stored
  stress scenario that costs the equity book 25% is storm clouds, 40% is a
  siege; for one holding 20% is "exposed" and 40% is "breach risk". 40% is
  also the depth at which a holding can no longer be called a temporary
  setback in Buffett's sense (a 2-for-1 recovery is needed). A stored
  snapshot older than 7 days is shown but labelled old.
- Land for sale is not a threshold at all: it reads the stored margin-of-
  safety zone (below the bear case, bear-to-base, base-to-bull, above bull).
"""
from __future__ import annotations

from decimal import Decimal

from app.domain.game_mapping.value_types import GameMapping

GAME_MAPPING_V1 = GameMapping(
    version="v1",
    granite_max_net_debt_to_ebitda=Decimal("1.0"),
    brick_max_net_debt_to_ebitda=Decimal("2.5"),
    timber_max_net_debt_to_ebitda=Decimal("4.0"),
    weak_interest_coverage=Decimal(3),
    financial_granite_min_equity_ratio=Decimal("0.10"),
    financial_brick_min_equity_ratio=Decimal("0.07"),
    financial_timber_min_equity_ratio=Decimal("0.05"),
    large_position_pct=Decimal(15),
    medium_position_pct=Decimal(7),
    small_position_pct=Decimal(3),
    fresh_max_days=90,
    weathered_max_days=180,
    tiny_position_pct=Decimal(2),
    light_shantytown_min_shacks=2,
    heavy_shantytown_min_shacks=5,
    deep_vault_min_pct=Decimal(20),
    stocked_vault_min_pct=Decimal(10),
    thin_vault_min_pct=Decimal(3),
    gathering_portfolio_shock=Decimal("-0.25"),
    besieged_portfolio_shock=Decimal("-0.40"),
    exposed_holding_shock=Decimal("-0.20"),
    breach_risk_holding_shock=Decimal("-0.40"),
    stored_snapshot_stale_days=7,
)
