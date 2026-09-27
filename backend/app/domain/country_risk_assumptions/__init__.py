"""Versioned country-risk (SSI) assumptions — see v1.py and CLAUDE.md Rule 3."""
from __future__ import annotations

from app.domain.country_risk_assumptions.v1 import (
    COUNTRY_RISK_ASSUMPTIONS_V1,
    CountryRiskAssumptions,
    IndicatorSpec,
    wgi_to_score,
)

_VERSIONS: dict[str, CountryRiskAssumptions] = {"v1": COUNTRY_RISK_ASSUMPTIONS_V1}


def get_country_risk_assumptions(version: str) -> CountryRiskAssumptions:
    try:
        return _VERSIONS[version]
    except KeyError as exc:
        raise ValueError(f"Unknown country-risk assumptions version: {version!r}") from exc


__all__ = ["CountryRiskAssumptions", "IndicatorSpec", "get_country_risk_assumptions", "wgi_to_score"]
