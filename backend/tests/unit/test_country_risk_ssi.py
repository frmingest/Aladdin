"""SSI port (Epic F22, story 22.10): CWO's weights/thresholds kept, its
known problems fixed (no crisis probabilities, fiscal-surplus sign, linear
WGI map), and no neutral placeholder for a missing input."""
from __future__ import annotations

from dataclasses import fields
from decimal import Decimal

from app.domain.country_risk_assumptions import (
    get_country_risk_assumptions,
    wgi_to_score,
)
from app.services.country_risk.ssi import (
    SSIInputs,
    SSIResult,
    compute_ssi,
    deficit_stress,
)

D = Decimal
A = get_country_risk_assumptions("v1")


def test_weights_sum_to_one():
    assert sum(A.weights.values()) == D(1)


def test_greece_2009_example_is_critical_like_cwo():
    # CWO's own test case (Greece 2009): political stability 6.0 on its 1-10 scale.
    result = compute_ssi(
        SSIInputs(
            debt_to_gdp=D(127), debt_to_gdp_3y_avg=D(105), fiscal_balance_gdp=D("-15.6"),
            fiscal_balance_change=D(-8), current_account_gdp=D(-11), reserves_months_imports=D("2.5"),
            external_debt_to_reserves_pct=D(350), political_stability_score=D(6), gdp_growth_latest=D(-2),
            gdp_growth_3y_avg=D("2.5"),
        ),
        A,
    )
    assert result.score is not None and result.score >= D(75)
    assert result.band == "Critical stress"
    assert result.data_quality == "high"


def test_fiscal_surplus_is_low_stress_not_mirrored_deficit():
    # ECON-F22-11: CWO's abs() made Norway's ~+10% surplus score like a 10% deficit (90).
    assert deficit_stress(A, D(10), None) == D(10)
    assert deficit_stress(A, D(-10), None) == D(90)


def test_missing_components_are_reweighted_not_filled():
    only_debt = compute_ssi(SSIInputs(debt_to_gdp=D(30)), A)
    assert only_debt.score == D("10.0")  # the one component's own stress, not blended with a placeholder
    assert "political_stability" in only_debt.missing
    assert only_debt.data_quality == "low"


def test_no_inputs_gives_no_score():
    result = compute_ssi(SSIInputs(), A)
    assert result.score is None and result.band is None
    assert result.data_quality == "insufficient"


def test_result_carries_no_crisis_probability():
    # ECON-F22-07: the uncalibrated probability table was left behind.
    names = {f.name for f in fields(SSIResult)}
    assert not any("prob" in n for n in names)


def test_wgi_linear_mapping():
    assert wgi_to_score(D("-2.5")) == D(1)
    assert wgi_to_score(D(0)) == D("5.5")
    assert wgi_to_score(D("2.5")) == D(10)
    assert wgi_to_score(D(4)) == D(10)  # clamped
