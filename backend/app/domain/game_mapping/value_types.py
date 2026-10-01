"""The shape every game-mapping version conforms to (kept apart from a
specific version so a future v2 reuses the dataclass)."""
from __future__ import annotations

from dataclasses import dataclass
from decimal import Decimal


@dataclass(frozen=True)
class GameMapping:
    version: str

    # --- Walls & keep (non-financial stocks), net debt / EBITDA ---------
    # A holding with net cash (net debt <= 0) is "basalt". Otherwise the
    # first tier whose limit the ratio does not exceed wins; above the last
    # limit, or when EBITDA is not positive while there is net debt, the
    # wall is "rotted".
    granite_max_net_debt_to_ebitda: Decimal
    brick_max_net_debt_to_ebitda: Decimal
    timber_max_net_debt_to_ebitda: Decimal
    # Interest cover (EBIT / interest) below this drops the wall one tier.
    weak_interest_coverage: Decimal

    # --- Walls & keep (banks / insurers), equity / total assets ---------
    # Banks are structurally levered, so debt rules would paint every bank
    # as timber. There is no basalt tier for them.
    financial_granite_min_equity_ratio: Decimal
    financial_brick_min_equity_ratio: Decimal
    financial_timber_min_equity_ratio: Decimal

    # --- Tower footprint, share of the portfolio (percent, 0-100) --------
    large_position_pct: Decimal
    medium_position_pct: Decimal
    small_position_pct: Decimal

    # --- Analysis freshness (days since the latest usable run) -----------
    fresh_max_days: int
    weathered_max_days: int

    # --- Diworsification -> shantytown -----------------------------------
    tiny_position_pct: Decimal
    """A position below this share counts as a "shack"."""
    light_shantytown_min_shacks: int
    heavy_shantytown_min_shacks: int

    # --- Vault, cash as a share of cash + portfolio (percent) -----------
    deep_vault_min_pct: Decimal
    stocked_vault_min_pct: Decimal
    thin_vault_min_pct: Decimal

    # --- Sieges (G4): stored portfolio-stress and macro regime ------------
    # All shocks are fractions, negative = a loss (-0.25 is a 25% fall), the
    # same unit the stored stress result uses.
    # Portfolio-wide scenario loss at or below this: the realm is "gathering"
    # (storm clouds) / "besieged".
    gathering_portfolio_shock: Decimal
    besieged_portfolio_shock: Decimal
    # One holding's scenario loss at or below this: the tower is "exposed" /
    # "breach_risk" in the siege picture.
    exposed_holding_shock: Decimal
    breach_risk_holding_shock: Decimal
    # A stored risk or margin-of-safety snapshot older than this is shown, but
    # labelled as old (prices and macro data move).
    stored_snapshot_stale_days: int
