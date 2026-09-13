"""Unit tests for app.domain.valuation (architecture §17, §26 Phase 5)."""

from decimal import Decimal

from app.domain.valuation import ValuationAssumptions, compute_dcf_value


def _base_assumptions(**overrides) -> ValuationAssumptions:
    defaults = dict(
        revenue_growth_pct=Decimal("8"),
        margin_pct=Decimal("20"),
        capex_pct_of_revenue=Decimal("5"),
        tax_rate_pct=Decimal("22"),
        discount_rate_pct=Decimal("9"),
        terminal_growth_pct=Decimal("2"),
        shares_outstanding=Decimal("1000000"),
    )
    defaults.update(overrides)
    return ValuationAssumptions(**defaults)


def test_compute_dcf_value_produces_positive_per_share_value():
    result = compute_dcf_value(Decimal("100000000"), _base_assumptions())
    assert result.value_per_share is not None
    assert result.value_per_share > 0
    assert result.note is None
    assert len(result.projected_fcf) == 5
    assert result.confidence in {"low", "medium", "high"}


def test_compute_dcf_value_none_base_revenue_returns_none_with_note():
    result = compute_dcf_value(None, _base_assumptions())
    assert result.value_per_share is None
    assert "base revenue" in result.note


def test_compute_dcf_value_zero_or_negative_revenue_returns_none():
    result = compute_dcf_value(Decimal("0"), _base_assumptions())
    assert result.value_per_share is None


def test_compute_dcf_value_non_positive_shares_returns_none():
    result = compute_dcf_value(Decimal("100000000"), _base_assumptions(shares_outstanding=Decimal("0")))
    assert result.value_per_share is None
    assert "shares_outstanding" in result.note


def test_compute_dcf_value_discount_not_exceeding_terminal_growth_is_undefined():
    result = compute_dcf_value(
        Decimal("100000000"),
        _base_assumptions(discount_rate_pct=Decimal("3"), terminal_growth_pct=Decimal("3")),
    )
    assert result.value_per_share is None
    assert "discount_rate" in result.note


def test_compute_dcf_value_applies_fx_and_net_debt():
    no_fx = compute_dcf_value(Decimal("100000000"), _base_assumptions())
    with_fx = compute_dcf_value(
        Decimal("100000000"), _base_assumptions(fx_rate_to_reporting=Decimal("10"))
    )
    assert with_fx.value_per_share == no_fx.value_per_share * Decimal("10")

    with_debt = compute_dcf_value(
        Decimal("100000000"), _base_assumptions(net_debt=Decimal("10000000"))
    )
    assert with_debt.value_per_share < no_fx.value_per_share


def test_compute_dcf_value_commodity_multiplier_scales_base_revenue():
    baseline = compute_dcf_value(Decimal("100000000"), _base_assumptions())
    boosted = compute_dcf_value(
        Decimal("100000000"), _base_assumptions(commodity_price_multiplier=Decimal("1.20"))
    )
    assert boosted.value_per_share > baseline.value_per_share


def test_compute_dcf_value_confidence_low_when_margin_non_positive():
    result = compute_dcf_value(Decimal("100000000"), _base_assumptions(margin_pct=Decimal("0")))
    assert result.confidence == "low"


def test_compute_dcf_value_confidence_high_with_comfortable_spread():
    result = compute_dcf_value(
        Decimal("100000000"),
        _base_assumptions(discount_rate_pct=Decimal("10"), terminal_growth_pct=Decimal("2")),
    )
    assert result.confidence == "high"
