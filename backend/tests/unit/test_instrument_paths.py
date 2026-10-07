"""Pure arithmetic and routing for the income / commodity analysis paths
(2026-10-07)."""
from __future__ import annotations

from decimal import Decimal

import pytest

from app.domain.analysis_schema import (
    get_blind_pass_schema,
    get_reconciliation_schema,
    is_fund_schema,
)
from app.domain.instrument_facts import fact_spec, fact_specs_for
from app.domain.instrument_types import (
    ANALYZABLE_TYPES,
    EQUITY_ANALYZABLE_TYPES,
    INSTRUMENT_TYPES,
    PATH_COMMODITY,
    PATH_FUND,
    PATH_INCOME,
    PATH_STOCK,
    analysis_path,
    is_wrapper_type,
)
from app.services.instruments.metrics import (
    breakeven_rate_rise_pp,
    carry_hurdle_pct,
    premium_discount_pct,
    rate_shock_effect_pct,
    reference_yield,
)

D = Decimal


def test_every_instrument_type_has_a_path_and_equity_roll_ups_are_unchanged():
    assert {analysis_path(t) for t in INSTRUMENT_TYPES} == {PATH_STOCK, PATH_FUND, PATH_INCOME, PATH_COMMODITY}
    assert set(INSTRUMENT_TYPES) == set(ANALYZABLE_TYPES)
    assert EQUITY_ANALYZABLE_TYPES == {"stock", "equity_etf", "equity_fund"}  # bond funds never count as equity
    assert analysis_path("collectible") is None
    assert is_wrapper_type("bond_fund") and is_wrapper_type("commodity_etc") and not is_wrapper_type("stock")


def test_paths():
    assert analysis_path("bond_fund") == analysis_path("money_market_fund") == PATH_INCOME
    assert analysis_path("commodity_etc") == PATH_COMMODITY
    assert analysis_path("equity_etf") == PATH_FUND


def test_schema_registry_knows_the_new_schemas():
    for version in ("income_v1", "commodity_v1"):
        assert get_blind_pass_schema(version).__name__.endswith("BlindPassOutputV1")
        assert get_reconciliation_schema(version).__name__ == "ReconciliationOutputV1"
        assert is_fund_schema(version)
    assert not is_fund_schema("v1")


def test_fact_registry_is_per_path_and_keys_are_unique():
    income = {s.key for s in fact_specs_for(PATH_INCOME)}
    commodity = {s.key for s in fact_specs_for(PATH_COMMODITY)}
    assert len(income) == len(fact_specs_for(PATH_INCOME)) and not income & commodity
    assert fact_spec(PATH_INCOME, "effective_duration_years").kind == "number"
    assert fact_spec(PATH_COMMODITY, "backing").kind == "text"
    assert fact_spec(PATH_INCOME, "backing") is None
    assert fact_specs_for(PATH_FUND) == ()


def test_reference_yield_prefers_yield_to_maturity():
    assert reference_yield(D("7.5"), D("6")) == (D("7.5"), "yield to maturity")
    assert reference_yield(None, D("6")) == (D("6"), "distribution yield")
    assert reference_yield(None, None) == (None, None)


def test_rate_shock_and_breakeven():
    assert rate_shock_effect_pct(D("2.5"), D(1)) == D("-2.50")
    assert rate_shock_effect_pct(D("2.5"), D(-1)) == D("2.50")
    assert breakeven_rate_rise_pp(D("7.5"), D("2.5")) == D("3.00")
    assert breakeven_rate_rise_pp(D("4"), D(0)) is None


@pytest.mark.parametrize(
    ("bill", "fee", "years", "expected"),
    [
        (D("4"), D("0.36"), 5, D("23.88")),
        (D("4"), D("0.36"), 10, D("53.46")),
        (D("0"), D("0"), 10, D("0.00")),
        (D("0"), D("1"), 1, D("1.01")),
    ],
)
def test_carry_hurdle(bill, fee, years, expected):
    assert carry_hurdle_pct(bill, fee, years) == expected


def test_premium_discount():
    assert premium_discount_pct(D("100.5"), D("100")) == D("0.50")
    assert premium_discount_pct(D("99"), D("100")) == D("-1.00")
    assert premium_discount_pct(D("1"), D("0")) is None
