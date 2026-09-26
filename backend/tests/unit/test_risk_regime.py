"""Unit tests for app/services/risk/regime.py: the baseline/stagflation/
crisis classification and its hysteresis (3-month rolling average) rule,
built from fake IndicatorSnapshot/MacroIndicators objects — no DB, no
network."""
from datetime import date
from decimal import Decimal

from app.services.macro.indicators import (
    HistoryPoint,
    IndicatorSnapshot,
    MacroIndicators,
)
from app.services.risk.regime import (
    REGIME_BASELINE,
    REGIME_CRISIS,
    REGIME_STAGFLATION,
    classify_regime,
)

D = Decimal


def _snap(key: str, label: str, region: str, *, value: Decimal, history_values: list[Decimal]) -> IndicatorSnapshot:
    history = [HistoryPoint(observed_on=date(2026, m, 1), value=v) for m, v in zip((6, 7, 8), history_values)]
    return IndicatorSnapshot(
        key=key, label=label, region=region, group="x", display_unit="%", frequency="monthly",
        change_kind="pp", description="", source_name="test", source_series_id="x", source_url="",
        value=value, history=history,
    )


def _indicators(*, hy_spread, curve, us_cpi, no_cpi) -> MacroIndicators:
    snaps = [
        _snap("us_hy_spread", "US HY spread", "US", value=hy_spread[-1], history_values=hy_spread),
        _snap("us_10y_2y", "US curve", "US", value=curve[-1], history_values=curve),
        _snap("us_cpi_yoy", "US CPI", "US", value=us_cpi[-1], history_values=us_cpi),
        _snap("no_cpi_yoy", "Norway CPI", "NO", value=no_cpi[-1], history_values=no_cpi),
    ]
    return MacroIndicators(series_version="v1", indicators=snaps, derived=[])


def _calm() -> dict:
    return {
        "hy_spread": [D("3.0"), D("3.1"), D("3.0")],
        "curve": [D("0.5"), D("0.6"), D("0.5")],
        "us_cpi": [D("2.5"), D("2.4"), D("2.5")],
        "no_cpi": [D("2.0"), D("2.1"), D("2.0")],
    }


def test_baseline_when_nothing_crosses_a_threshold():
    result = classify_regime(None, indicators=_indicators(**_calm()))
    assert result.regime == REGIME_BASELINE
    assert result.data_complete


def test_crisis_when_credit_spread_persistently_elevated():
    values = _calm()
    values["hy_spread"] = [D("6.5"), D("6.8"), D("7.0")]
    result = classify_regime(None, indicators=_indicators(**values))
    assert result.regime == REGIME_CRISIS


def test_single_noisy_print_does_not_flip_to_crisis():
    # Only the latest month spikes; the 3-month average stays well under
    # the crisis threshold, so the regime must NOT flip on this alone.
    values = _calm()
    values["hy_spread"] = [D("3.0"), D("3.1"), D("9.0")]
    result = classify_regime(None, indicators=_indicators(**values))
    assert result.regime != REGIME_CRISIS
    # Confirm the smoothing actually happened (average of the 3, not the
    # raw latest print of 15.0).
    hy_input = next(i for i in result.inputs if i.key == "us_hy_spread")
    assert hy_input.latest_value == D("9.0")
    assert hy_input.smoothed_value < D("6.0")


def test_stagflation_when_curve_flat_and_inflation_high():
    values = _calm()
    values["curve"] = [D("-0.2"), D("-0.3"), D("-0.1")]
    values["us_cpi"] = [D("4.5"), D("4.6"), D("4.4")]
    result = classify_regime(None, indicators=_indicators(**values))
    assert result.regime == REGIME_STAGFLATION


def test_stagflation_can_be_triggered_by_norway_cpi_alone():
    values = _calm()
    values["curve"] = [D("-0.2"), D("-0.3"), D("-0.1")]
    values["no_cpi"] = [D("5.0"), D("5.2"), D("4.9")]
    result = classify_regime(None, indicators=_indicators(**values))
    assert result.regime == REGIME_STAGFLATION
    assert result.home_market_series_included


def test_missing_series_defaults_to_baseline_and_flags_incomplete():
    snaps = [
        IndicatorSnapshot(
            key="us_hy_spread", label="US HY spread", region="US", group="x", display_unit="%",
            frequency="monthly", change_kind="pp", description="", source_name="t", source_series_id="x",
            source_url="", value=None,
        )
    ]
    indicators = MacroIndicators(series_version="v1", indicators=snaps, derived=[])
    result = classify_regime(None, indicators=indicators)
    assert result.regime == REGIME_BASELINE
    assert not result.data_complete
    assert "us_hy_spread" in result.missing
