"""The shape every risk-band version conforms to (ECON-007, 2026-11-15).
Mirrors app/domain/regime_adjustments/value_types.py: a frozen dataclass,
versioned by a sibling vN.py module."""
from __future__ import annotations

from dataclasses import dataclass, field
from decimal import Decimal


@dataclass(frozen=True)
class RiskBands:
    version: str

    # Multiplies the stress shock's standard-deviation count (settings
    # `risk_stress_shock_std_devs`, default 2) for each regime
    # app/services/risk/regime.py can return. Regime names are plain strings
    # here, not imported from services, so the domain layer stays pure; keep
    # them in sync by hand.
    shock_multiplier: dict[str, Decimal] = field(default_factory=dict)
    # Used for a regime string with no entry above; 1 = no change.
    default_multiplier: Decimal = Decimal(1)
