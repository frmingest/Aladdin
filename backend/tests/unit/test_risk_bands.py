"""Unit tests for app.domain.risk_bands (ECON-007, 2026-11-15)."""
from decimal import Decimal

import pytest

from app.domain.risk_bands import get_risk_bands


def test_v1_never_gentler_than_baseline_and_crisis_is_widest():
    bands = get_risk_bands("v1")
    assert bands.version == "v1"
    assert bands.shock_multiplier["baseline"] == Decimal(1)
    for regime in ("baseline", "stagflation", "crisis"):
        assert bands.shock_multiplier[regime] >= Decimal(1)
    assert bands.shock_multiplier["crisis"] >= bands.shock_multiplier["stagflation"]
    assert bands.default_multiplier == Decimal(1)


def test_unknown_version_raises():
    with pytest.raises(ValueError, match="Unknown risk bands version"):
        get_risk_bands("v99")


def test_v1_covers_exactly_the_regimes_the_classifier_can_return():
    from app.services.risk.regime import (
        REGIME_BASELINE,
        REGIME_CRISIS,
        REGIME_STAGFLATION,
    )

    assert set(get_risk_bands("v1").shock_multiplier) == {REGIME_BASELINE, REGIME_STAGFLATION, REGIME_CRISIS}
