"""Unit tests for app/services/metrics.py — the deterministic
facts-to-ratios layer behind GET /holdings/{id}/metrics."""
from __future__ import annotations

from decimal import Decimal

from app.services.metrics import compute_holding_metrics

FULL_FACTS = {
    "revenue": Decimal(1000),
    "cost_of_goods_sold": Decimal(600),
    "operating_income": Decimal(250),
    "ebitda": Decimal(300),
    "ebit": Decimal(250),
    "net_income": Decimal(150),
    "depreciation_and_amortization": Decimal(50),
    "total_equity": Decimal(800),
    "operating_cash_flow": Decimal(220),
    "total_debt": Decimal(400),
    "cash_and_equivalents": Decimal(100),
    "capital_expenditures": Decimal(70),
    "interest_expense": Decimal(20),
}


def test_computes_every_derivable_ratio_when_all_facts_present():
    result = compute_holding_metrics(FULL_FACTS)

    assert result.computed["gross_margin"] == (Decimal(1000) - Decimal(600)) / Decimal(1000)
    assert result.computed["operating_margin"] == Decimal(250) / Decimal(1000)
    assert result.computed["net_margin"] == Decimal(150) / Decimal(1000)
    assert result.computed["free_cash_flow"] == Decimal(220) - Decimal(70)
    assert result.computed["owner_earnings"] == Decimal(150) + Decimal(50) - Decimal(70)
    assert result.computed["net_debt"] == Decimal(400) - Decimal(100)
    assert result.computed["net_debt_to_ebitda"] == result.computed["net_debt"] / Decimal(300)
    assert (
        result.computed["net_debt_to_fcf"]
        == result.computed["net_debt"] / result.computed["free_cash_flow"]
    )
    assert result.computed["interest_coverage"] == Decimal(250) / Decimal(20)
    assert result.computed["debt_to_equity"] == Decimal(400) / Decimal(800)


def test_always_skips_roic_roe_and_valuation_multiples():
    result = compute_holding_metrics(FULL_FACTS)

    for metric in ("roic", "roe"):
        assert metric in result.skipped
        assert metric not in result.computed

    for metric in (
        "price_to_earnings",
        "price_to_book",
        "price_to_sales",
        "ev_to_ebitda",
        "enterprise_value",
    ):
        assert "market data" in result.skipped[metric]


def test_reports_specific_missing_inputs_when_facts_are_sparse():
    result = compute_holding_metrics({"revenue": Decimal(1000)})

    assert "gross_margin" not in result.computed
    assert "cost_of_goods_sold" in result.skipped["gross_margin"]
    assert "net_debt" in result.skipped
    assert "net_debt_to_ebitda" in result.skipped
    assert "net_debt_to_fcf" in result.skipped


def test_net_debt_to_ebitda_skipped_when_ebitda_zero():
    facts = dict(FULL_FACTS)
    facts["ebitda"] = Decimal(0)
    result = compute_holding_metrics(facts)

    assert "net_debt_to_ebitda" in result.skipped
    assert "net_debt" in result.computed  # net_debt itself still computes fine


def test_mixed_currencies_in_one_period_compute_nothing():
    currencies = {name: "USD" for name in FULL_FACTS}
    currencies["revenue"] = "NOK"
    result = compute_holding_metrics(FULL_FACTS, currencies)

    assert result.computed == {}
    assert "mixed currencies (NOK, USD)" in result.warnings[0]
    assert result.skipped["gross_margin"] == "not computed: mixed currencies"


def test_ebit_falls_back_to_operating_income_and_says_so():
    facts = {k: v for k, v in FULL_FACTS.items() if k not in ("ebit", "ebitda")}
    result = compute_holding_metrics(facts)

    assert result.computed["interest_coverage"] == Decimal(250) / Decimal(20)
    assert result.notes["interest_coverage"] == "EBIT = operating income"
    # EBITDA derived as EBIT + D&A = 300
    assert result.computed["net_debt_to_ebitda"] == Decimal(300) / Decimal(300)
    assert "EBIT + D&A" in result.notes["net_debt_to_ebitda"]


def test_explicit_ebit_and_ebitda_are_never_overridden():
    result = compute_holding_metrics(FULL_FACTS)
    assert result.notes == {}
