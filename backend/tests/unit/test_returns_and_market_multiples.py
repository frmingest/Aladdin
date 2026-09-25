"""ROE / ROIC / ROCE, materials margin and the market multiples
(2026-09-25, claude/gap-closing-roic-roe-multiples-2026-09-25.md), on
figures shaped like the two real Oslo holdings: Vår Energi (90% effective
tax, book equity almost all hybrid capital) and Salmon Evolution (loss,
income statement by nature)."""
from __future__ import annotations

from decimal import Decimal

from app.services.metrics import (
    MARKET_RATIOS,
    MarketInputs,
    compute_holding_metrics,
    effective_tax_rate,
    invested_capital,
)

D = Decimal

# Vår Energi FY2024-like figures (USD m).
VAR = {
    "revenue": D(7800),
    "ebit": D(3500),
    "ebitda": D(5500),
    "net_income": D(785),
    "income_before_tax": D(3313),
    "income_tax_expense": D(2986),
    "total_assets": D(20000),
    "total_equity": D(832.5),
    "hybrid_capital": D(799.5),
    "total_debt": D(5000),
    "cash_and_equivalents": D(300),
    "lease_liabilities": D(212),
    "operating_cash_flow": D(4000),
    "capital_expenditures": D(2800),
}
VAR_PRIOR = {**VAR, "total_equity": D(1000), "total_debt": D(4800)}

SALMON = {
    "revenue": D(400),
    "raw_materials_used": D(200.9),
    "ebit": D(-40),
    "net_income": D(-47.4),
    "income_before_tax": D(-47.4),
    "income_tax_expense": D(0),
    "total_assets": D(3000),
    "total_equity": D(2000),
    "total_debt": D(700),
    "cash_and_equivalents": D(200),
    "eps_basic": D("-0.11"),
}


def test_roic_uses_the_effective_tax_rate_not_a_statutory_one():
    result = compute_holding_metrics(VAR, prior_facts=VAR_PRIOR)
    rate = D(2986) / D(3313)
    current = D(5000) + D(832.5) + D(212) - D(300)
    prior = D(4800) + D(1000) + D(212) - D(300)
    expected = D(3500) * (1 - rate) / ((current + prior) / 2)
    assert result.computed["roic"] == expected
    assert "effective tax 90.1%" in result.notes["roic"]
    assert "incl. leases" in result.notes["roic"]


def test_roce_is_the_pre_tax_return_on_the_same_capital():
    result = compute_holding_metrics(VAR, prior_facts=VAR_PRIOR)
    assert result.computed["roce"] > result.computed["roic"] * 9  # 90% tax
    assert "before tax" in result.notes["roce"]


def test_roe_is_not_meaningful_when_book_equity_is_depleted():
    result = compute_holding_metrics(VAR, prior_facts=VAR_PRIOR)
    assert "roe" not in result.computed
    reason = result.skipped["roe"]
    assert reason.startswith("not meaningful")
    assert "judge on ROIC" in reason


def test_roe_averages_ordinary_equity_over_two_year_ends():
    facts = {"net_income": D(150), "total_equity": D(900), "total_assets": D(2000)}
    prior = {"total_equity": D(700)}
    result = compute_holding_metrics(facts, prior_facts=prior)
    assert result.computed["roe"] == D(150) / D(800)
    assert "700" in result.notes["roe"] and "900" in result.notes["roe"]


def test_roe_without_prior_year_uses_year_end_and_says_so():
    result = compute_holding_metrics({"net_income": D(100), "total_equity": D(1000)})
    assert result.computed["roe"] == D("0.1")
    assert "not averaged" in result.notes["roe"]


def test_operating_loss_gives_negative_roce_and_no_roic():
    result = compute_holding_metrics(SALMON)
    assert result.computed["roce"] < 0
    assert result.skipped["roic"].startswith("not meaningful: EBIT is negative")


def test_positive_ebit_but_pre_tax_loss_has_no_tax_rate():
    facts = {**SALMON, "ebit": D(10)}
    result = compute_holding_metrics(facts)
    assert "no effective tax rate" in result.skipped["roic"]


def test_roic_names_missing_tax_inputs():
    facts = {k: v for k, v in VAR.items() if k != "income_tax_expense"}
    result = compute_holding_metrics(facts)
    assert "income_tax_expense" in result.skipped["roic"]


def test_effective_tax_rate_is_limited_to_0_100_percent():
    rate, note = effective_tax_rate({"income_tax_expense": D(150), "income_before_tax": D(100)})
    assert rate == D(1)
    assert "limited" in note
    assert effective_tax_rate({"income_tax_expense": D(5), "income_before_tax": D(-1)}) is None


def test_invested_capital_adds_leases_and_minorities():
    value, parts = invested_capital(
        {
            "total_debt": D(100),
            "total_equity": D(50),
            "cash_and_equivalents": D(30),
            "lease_liabilities": D(10),
            "minority_interests": D(5),
        }
    )
    assert value == D(135)
    assert parts == ["leases", "minority interests"]


def test_materials_margin_only_for_statements_by_nature():
    result = compute_holding_metrics(SALMON)
    assert result.computed["materials_margin"] == (D(400) - D(200.9)) / D(400)
    assert "not a true gross margin" in result.notes["materials_margin"]
    with_cogs = compute_holding_metrics({**SALMON, "cost_of_goods_sold": D(250)})
    assert "materials_margin" not in with_cogs.computed
    assert "materials_margin" not in with_cogs.skipped


def test_market_multiples_use_owner_view_ev_and_ordinary_equity():
    market = MarketInputs(price=D("2.8"), shares=D(2496), note="price × shares")
    result = compute_holding_metrics(VAR, market=market)
    cap = D("2.8") * D(2496)
    assert result.computed["market_cap"] == cap
    net_debt = D(5000) + D(799.5) - D(300)
    assert result.computed["enterprise_value"] == cap + net_debt + D(212)
    assert result.computed["price_to_earnings"] == cap / D(785)
    assert result.computed["price_to_sales"] == cap / D(7800)
    assert result.computed["ev_to_ebitda"] == (cap + net_debt + D(212)) / D(5500)
    assert result.computed["fcf_yield"] == (D(4000) - D(2800)) / cap
    # 33m of ordinary equity on 20bn of assets: P/B is not meaningful
    assert result.skipped["price_to_book"].startswith("not meaningful")
    assert result.notes["market_cap"] == "price × shares"


def test_loss_makes_pe_not_meaningful():
    result = compute_holding_metrics(SALMON, market=MarketInputs(price=D(50), shares=D(430)))
    assert result.skipped["price_to_earnings"].startswith("not meaningful")
    assert result.computed["price_to_book"] == D(50) * D(430) / D(2000)


def test_mixed_currencies_skip_the_new_ratios_too():
    result = compute_holding_metrics(
        VAR, {"revenue": "USD", "net_income": "NOK"}, market=MarketInputs(price=D(1), shares=D(1))
    )
    for name in ("roic", "roe", "roce", *MARKET_RATIOS):
        assert result.skipped[name] == "not computed: mixed currencies"
