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
    # G5: a cash figure Faiz typed in more than this many days ago is shown but
    # labelled old (cash moves; the vault would otherwise look surer than it is).
    stale_cash_days: int

    # --- Temperament meter (G6), journal-driven -------------------------
    # Only decisions and snapshot comparisons inside this rolling window count.
    temperament_window_days: int
    # Churn: this many buy/add/trim/sell actions on one holding inside
    # `churn_window_days` is one "churn" drain.
    churn_window_days: int
    churn_min_actions: int
    # "Held through a drop": a position kept (quantity not reduced) between two
    # snapshots of one account while its price fell by at least this fraction.
    held_drop_min_fraction: Decimal
    # Fewer logged decisions than this in the window = low-confidence reading.
    temperament_min_decisions: int
    # Needle (restoring events as a share of all judged events, percent) at or
    # above these = composed / steady / restless; below the last = rash.
    composed_min_pct: Decimal
    steady_min_pct: Decimal
    restless_min_pct: Decimal
