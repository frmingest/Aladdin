"""Unit tests for app.domain.scoring (architecture §13.2, §26 Phase 3)."""

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
