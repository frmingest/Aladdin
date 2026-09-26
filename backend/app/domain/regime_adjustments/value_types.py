"""The shape every regime-adjustment version conforms to (Sprint 14,
2026-09-26) — mirrors app/domain/valuation_assumptions/value_types.py's
pattern of a frozen dataclass, versioned by a sibling vN.py module, kept
separate from any one version so a future v2 imports the same shape
rather than redefining it."""
from __future__ import annotations

from dataclasses import dataclass, field
from decimal import Decimal


@dataclass(frozen=True)
class RegimeAdjustments:
    version: str

    # Added to the CAPM discount rate (a FRACTION, e.g. Decimal("0.015") =
    # 150bps) for each regime app/services/risk/regime.py can return
    # ("baseline" | "stagflation" | "crisis" — kept as plain strings here,
    # not imported from that module, so this domain layer doesn't reach
    # into services; the two must be kept in sync by hand).
    discount_rate_addon: dict[str, Decimal] = field(default_factory=dict)
    # Used for a regime string with no entry above (shouldn't happen in
    # practice — classify_regime only returns the three known regimes —
    # but never raises just because a future regime value isn't mapped
    # yet; CLAUDE.md: fail visibly elsewhere, never crash the DCF here).
    default_addon: Decimal = Decimal(0)
