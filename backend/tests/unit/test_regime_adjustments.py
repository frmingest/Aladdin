"""Unit tests for app.domain.regime_adjustments (Sprint 14, 2026-09-26)."""
from decimal import Decimal

import pytest

from app.domain.regime_adjustments import get_regime_adjustments


def test_v1_has_a_non_negative_addon_for_every_known_regime():
    adjustments = get_regime_adjustments("v1")
    assert adjustments.version == "v1"
    for regime in ("baseline", "stagflation", "crisis"):
        assert adjustments.discount_rate_addon[regime] >= Decimal(0)
    # Ordering matches regime.py's own severity framing: crisis is the
    # more severe signal, so it should never widen less than stagflation.
    assert adjustments.discount_rate_addon["crisis"] >= adjustments.discount_rate_addon["stagflation"]
    assert adjustments.discount_rate_addon["baseline"] == Decimal(0)


def test_unknown_version_raises():
    with pytest.raises(ValueError, match="Unknown regime adjustments version"):
        get_regime_adjustments("v99")
