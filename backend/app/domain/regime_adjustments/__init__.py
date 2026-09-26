"""Versioned regime-to-discount-rate adjustments (Sprint 14, 2026-09-26).
Mirrors app/domain/valuation_assumptions/__init__.py's lookup-by-version
shape exactly."""
from __future__ import annotations

from app.domain.regime_adjustments.v1 import REGIME_ADJUSTMENTS_V1
from app.domain.regime_adjustments.value_types import RegimeAdjustments

_VERSIONS: dict[str, RegimeAdjustments] = {"v1": REGIME_ADJUSTMENTS_V1}


def get_regime_adjustments(version: str) -> RegimeAdjustments:
    try:
        return _VERSIONS[version]
    except KeyError as exc:
        raise ValueError(f"Unknown regime adjustments version: {version!r}") from exc
