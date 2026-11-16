"""Versioned regime-aware risk bands (ECON-007, 2026-11-15). Same
lookup-by-version shape as app/domain/regime_adjustments/__init__.py."""
from __future__ import annotations

from app.domain.risk_bands.v1 import RISK_BANDS_V1
from app.domain.risk_bands.value_types import RiskBands

_VERSIONS: dict[str, RiskBands] = {"v1": RISK_BANDS_V1}


def get_risk_bands(version: str) -> RiskBands:
    try:
        return _VERSIONS[version]
    except KeyError as exc:
        raise ValueError(f"Unknown risk bands version: {version!r}") from exc
