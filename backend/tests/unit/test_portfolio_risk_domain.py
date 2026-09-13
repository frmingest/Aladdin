"""Unit tests for app.domain.portfolio_risk (architecture §15, §15.1, §26 Phase 5)."""

from datetime import date
from decimal import Decimal

import pytest

from app.domain import portfolio_risk as risk


# --- correlation ---------------------------------------------------------


def test_pearson_correlation_perfect_positive():
    xs = [Decimal("1"), Decimal("2"), Decimal("3"), Decimal("4")]
    ys = [Decimal("2"), Decimal("4"), Decimal("6"), Decimal("8")]
    r = risk.pearson_correlation(xs, ys)
    assert r == Decimal("1.0")


def test_pearson_correlation_perfect_negative():
    xs = [Decimal("1"), Decimal("2"), Decimal("3"), Decimal("4")]
    ys = [Decimal("8"), Decimal("6"), Decimal("4"), Decimal("2")]
    r = risk.pearson_correlation(xs, ys)
    assert r == Decimal("-1.0")


def test_pearson_correlation_too_few_points_returns_none():
    assert risk.pearson_correlation([Decimal("1"), Decimal("2")], [Decimal("1"), Decimal("2")]) is None


def test_pearson_correlation_zero_variance_returns_none():
    xs = [Decimal("5"), Decimal("5"), Decimal("5")]
    ys = [Decimal("1"), Decimal("2"), Decimal("3")]
    assert risk.pearson_correlation(xs, ys) is None


def test_build_correlation_matrix_insufficient_overlap():
    prices = {
        "A": {date(2026, 1, 1): Decimal("10"), date(2026, 1, 2): Decimal("11")},
        "B": {date(2026, 1, 1): Decimal("20"), date(2026, 1, 2): Decimal("21")},
    }
    result = risk.build_correlation_matrix(prices, min_overlap=5)
    assert result.pairs == {}
    assert "A|B" in result.insufficient_data_pairs
    assert result.average_pairwise_correlation is None


def test_build_correlation_matrix_computes_pair_with_enough_overlap():
    dates = [date(2026, 1, d) for d in range(1, 7)]
    a_prices = [Decimal(str(10 + d)) for d in range(6)]
    b_prices = [Decimal(str(20 + 2 * d)) for d in range(6)]
    prices = {
        "A": dict(zip(dates, a_prices)),
        "B": dict(zip(dates, b_prices)),
    }
    result = risk.build_correlation_matrix(prices, min_overlap=5)
    assert result.pairs["A|B"] == Decimal("1.0")
    assert result.average_pairwise_correlation == Decimal("1.0")
    assert result.insufficient_data_pairs == []


# --- systemic / state risk -----------------------------------------------


def test_compute_deposit_concentration_groups_by_institution_and_flags_excess():
    positions = [("DNB", Decimal("1500000")), ("DNB", Decimal("1000000")), ("Nordnet", Decimal("500000"))]
    exposures, pct_over = risk.compute_deposit_concentration(positions, Decimal("2000000"))

    by_institution = {e.institution: e for e in exposures}
    assert by_institution["DNB"].value_reporting_ccy == Decimal("2500000.00")
    assert by_institution["DNB"].excess_over_guarantee == Decimal("500000.00")
    assert by_institution["Nordnet"].excess_over_guarantee == Decimal("0.00")
    # total = 3,000,000; over-guarantee = 500,000 -> 16.6667%
    assert pct_over == Decimal("16.6667")


def test_compute_deposit_concentration_no_positions_returns_none_pct():
    exposures, pct_over = risk.compute_deposit_concentration([], Decimal("2000000"))
    assert exposures == []
    assert pct_over is None


def test_compute_deposit_concentration_unset_institution_is_its_own_bucket():
    exposures, _ = risk.compute_deposit_concentration([(None, Decimal("100"))], Decimal("2000000"))
    assert exposures[0].institution == "Unknown institution"


def test_estimate_norwegian_wealth_tax_applies_bunnfradrag_and_share_discount():
    estimate = risk.estimate_norwegian_wealth_tax(
        net_portfolio_value_nok=Decimal("3000000"),
        listed_share_value_nok=Decimal("2000000"),
        bunnfradrag_nok=Decimal("1700000"),
        rate_pct=Decimal("1.1"),
        share_discount_pct=Decimal("20"),
    )
    # discounted shares = 2,000,000 * 0.8 = 1,600,000
    # other value = 3,000,000 - 2,000,000 = 1,000,000
    # taxable base = 1,600,000 + 1,000,000 - 1,700,000 = 900,000
    assert estimate.taxable_base == Decimal("900000.00")
    assert estimate.estimated_tax == Decimal("9900.00")  # 900,000 * 1.1%


def test_estimate_norwegian_wealth_tax_floors_at_zero_below_bunnfradrag():
    estimate = risk.estimate_norwegian_wealth_tax(
        net_portfolio_value_nok=Decimal("500000"),
        listed_share_value_nok=Decimal("0"),
        bunnfradrag_nok=Decimal("1700000"),
        rate_pct=Decimal("1.1"),
        share_discount_pct=Decimal("20"),
    )
    assert estimate.taxable_base == Decimal("0.00")
    assert estimate.estimated_tax == Decimal("0.00")


# --- risk band / composite score ------------------------------------------


def test_load_risk_scoring_config_risk_v1():
    config = risk.load_risk_scoring_config("risk_v1")
    assert config.version == "risk_v1"
    assert sum(config.dimension_weights.values()) == Decimal("1.00")
    assert "single_name_concentration" in config.dimension_thresholds


def test_load_risk_scoring_config_unknown_version_raises():
    with pytest.raises(risk.UnknownRiskScoringVersionError):
        risk.load_risk_scoring_config("does-not-exist")


def test_score_dimension_bands_and_none_passthrough():
    config = risk.load_risk_scoring_config("risk_v1")
    assert risk.score_dimension(None, config, "single_name_concentration") is None

    low = risk.score_dimension(Decimal("1000"), config, "single_name_concentration")
    assert low.band == "LOW"

    high = risk.score_dimension(Decimal("5000"), config, "single_name_concentration")
    assert high.band == "HIGH"
    assert high.severity == Decimal("100")


def test_compute_composite_score_renormalizes_over_available_dimensions():
    config = risk.load_risk_scoring_config("risk_v1")
    scores = {
        "single_name_concentration": risk.DimensionScore(band="HIGH", severity=Decimal("100")),
        "currency_exposure": risk.DimensionScore(band="LOW", severity=Decimal("0")),
    }
    composite = risk.compute_composite_score(scores, config)
    weight_a = config.dimension_weights["single_name_concentration"]
    weight_b = config.dimension_weights["currency_exposure"]
    expected = (Decimal("100") * weight_a) / (weight_a + weight_b)
    assert composite == expected.quantize(Decimal("0.01"))


def test_compute_composite_score_empty_returns_none():
    config = risk.load_risk_scoring_config("risk_v1")
    assert risk.compute_composite_score({}, config) is None


def test_worst_band_picks_most_severe():
    assert risk.worst_band(["LOW", "MODERATE-HIGH", "MODERATE"]) == "MODERATE-HIGH"
    assert risk.worst_band([]) == "INSUFFICIENT DATA"


def test_derive_risk_band_from_composite_score():
    config = risk.load_risk_scoring_config("risk_v1")
    assert risk.derive_risk_band(None, config) == "INSUFFICIENT DATA"
    assert risk.derive_risk_band(Decimal("80"), config) == "HIGH"
    assert risk.derive_risk_band(Decimal("10"), config) == "LOW"
