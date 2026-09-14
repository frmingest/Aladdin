"""Unit tests for app.domain.scoring (architecture §13.1/§13.2, §26 Phase 3)."""

from decimal import Decimal

import pytest

from app.domain import scoring


def test_compute_overall_score_weighted_average():
    scores = {"business_quality": 8, "financial_strength": 6, "valuation": 5}
    result = scoring.compute_overall_score(scores, "v1")
    # 8*0.40 + 6*0.30 + 5*0.30 = 3.2 + 1.8 + 1.5 = 6.5
    assert result is not None
    assert str(result) == "6.50"


def test_compute_overall_score_missing_factor_returns_none():
    scores = {"business_quality": 8, "financial_strength": 6}  # missing valuation
    assert scoring.compute_overall_score(scores, "v1") is None


def test_compute_overall_score_unknown_version_raises():
    with pytest.raises(scoring.UnknownScoringVersionError):
        scoring.compute_overall_score({"business_quality": 8}, "does-not-exist")


def test_aggregate_confidence_takes_minimum():
    assert scoring.aggregate_confidence(["high", "medium", "low"], "v1") == "low"
    assert scoring.aggregate_confidence(["high", "high"], "v1") == "high"
    assert scoring.aggregate_confidence(["medium", "high"], "v1") == "medium"


def test_aggregate_confidence_empty_input_defaults_low():
    assert scoring.aggregate_confidence([], "v1") == "low"


def test_load_scoring_config_v1_weights_sum_to_one():
    config = scoring.load_scoring_config("v1")
    assert sum(config.factor_weights.values()) == 1
    assert config.confidence_aggregation == "minimum"


# --- ECON-002 fix: regime-conditional weights (v2, docs/decisions/0014) ----


def test_v1_has_no_regime_classification_and_always_reports_baseline():
    config = scoring.load_scoring_config("v1")
    assert config.regime_classification == {}
    assert scoring.classify_macro_regime({}, "v1") == "baseline"
    assert scoring.classify_macro_regime({"us_real_yield_10y": Decimal("-5")}, "v1") == "baseline"


def test_v2_baseline_profile_matches_v1_weights_exactly():
    v1 = scoring.load_scoring_config("v1")
    v2 = scoring.load_scoring_config("v2")
    assert v2.factor_weight_profiles["baseline"] == v1.factor_weights


def test_v2_compute_overall_score_baseline_matches_v1():
    scores = {"business_quality": 8, "financial_strength": 6, "valuation": 5}
    assert scoring.compute_overall_score(scores, "v2") == scoring.compute_overall_score(scores, "v1")


def test_v2_compute_overall_score_stagflation_weights_differently():
    scores = {"business_quality": 8, "financial_strength": 6, "valuation": 5}
    baseline = scoring.compute_overall_score(scores, "v2", regime="stagflation")
    # 8*0.30 + 6*0.30 + 5*0.40 = 2.4 + 1.8 + 2.0 = 6.2
    assert str(baseline) == "6.20"


def test_v2_compute_overall_score_unknown_regime_falls_back_to_baseline():
    scores = {"business_quality": 8, "financial_strength": 6, "valuation": 5}
    assert scoring.compute_overall_score(scores, "v2", regime="not-a-real-regime") == scoring.compute_overall_score(
        scores, "v2"
    )


def test_classify_macro_regime_baseline_when_no_threshold_matches():
    values = {"us_real_yield_10y": Decimal("2.0"), "us_headline_cpi_yoy": Decimal("2.5")}
    assert scoring.classify_macro_regime(values, "v2") == "baseline"


def test_classify_macro_regime_stagflation_high_inflation_low_real_yield():
    values = {"us_real_yield_10y": Decimal("0.5"), "us_headline_cpi_yoy": Decimal("5.0")}
    assert scoring.classify_macro_regime(values, "v2") == "stagflation"


def test_classify_macro_regime_crisis_takes_priority_over_stagflation():
    # Materially negative real yield AND high inflation qualifies for both —
    # v2.yaml lists crisis first, so the more severe classification wins.
    values = {"us_real_yield_10y": Decimal("-2.0"), "us_headline_cpi_yoy": Decimal("6.0")}
    assert scoring.classify_macro_regime(values, "v2") == "crisis"


def test_classify_macro_regime_missing_series_falls_back_to_baseline():
    assert scoring.classify_macro_regime({}, "v2") == "baseline"


def test_weights_for_regime_falls_back_to_baseline_for_unknown_regime():
    config = scoring.load_scoring_config("v2")
    assert config.weights_for_regime("not-a-real-regime") == config.weights_for_regime("baseline")
