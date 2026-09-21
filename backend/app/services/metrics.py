"""Turns a holding's raw extracted facts (FinancialLineItem rows, one
period's worth) into the deterministic ratios app/services/calculations.py
knows how to compute — CLAUDE.md Rule 1: this is application code, the LLM
never touches this arithmetic.

Every ratio is computed only when every input it needs is present in the
facts dict; anything that can't be computed is reported with the specific
missing input(s) rather than silently omitted (CLAUDE.md: fail visibly).
Two categories are always skipped for now, by design, not oversight:
- ROIC needs NOPAT and invested capital, neither of which is a raw
  extracted fact (NOPAT needs a tax rate; invested capital is itself a
  derived figure) — nothing here guesses at either.
- Every valuation multiple (P/E, P/B, P/S, EV/EBITDA, enterprise value)
  needs live market data (price/market cap), which isn't in
  financial_line_items — that's Phase 2 (market_observations), not built
  yet.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from decimal import Decimal

from app.services import calculations

ZERO = Decimal(0)


@dataclass
class MetricsResult:
    computed: dict[str, Decimal] = field(default_factory=dict)
    skipped: dict[str, str] = field(default_factory=dict)


def _get(facts: dict[str, Decimal], *names: str) -> list[Decimal] | None:
    values = []
    missing = []
    for name in names:
        if name in facts:
            values.append(facts[name])
        else:
            missing.append(name)
    return None if missing else values


def compute_holding_metrics(facts: dict[str, Decimal]) -> MetricsResult:
    """`facts` maps canonical metric name (app/domain/financial_metrics.py's
    CANONICAL_METRICS) -> value, for a single holding and a single period."""
    result = MetricsResult()

    def attempt(metric_name: str, *inputs: str, fn) -> None:
        values = _get(facts, *inputs)
        if values is None:
            missing = [name for name in inputs if name not in facts]
            result.skipped[metric_name] = f"missing: {', '.join(missing)}"
            return
        try:
            result.computed[metric_name] = fn(*values)
        except ValueError as exc:
            result.skipped[metric_name] = str(exc)

    attempt("gross_margin", "revenue", "cost_of_goods_sold", fn=calculations.gross_margin)
    attempt("operating_margin", "revenue", "operating_income", fn=calculations.operating_margin)
    attempt("net_margin", "revenue", "net_income", fn=calculations.net_margin)

    attempt(
        "free_cash_flow",
        "operating_cash_flow",
        "capital_expenditures",
        fn=calculations.free_cash_flow,
    )

    owner_earnings_inputs = _get(
        facts, "net_income", "depreciation_and_amortization", "capital_expenditures"
    )
    if owner_earnings_inputs is None:
        missing = [
            name
            for name in ("net_income", "depreciation_and_amortization", "capital_expenditures")
            if name not in facts
        ]
        result.skipped["owner_earnings"] = f"missing: {', '.join(missing)}"
    else:
        net_income, d_and_a, capex = owner_earnings_inputs
        # working_capital_change isn't an extracted fact yet — explicitly 0,
        # matching calculations.owner_earnings's own documented convention
        # for "pass 0 when unknown rather than omitting it".
        result.computed["owner_earnings"] = calculations.owner_earnings(
            net_income, d_and_a, capex, ZERO
        )

    net_debt_inputs = _get(facts, "total_debt", "cash_and_equivalents")
    net_debt_value: Decimal | None = None
    if net_debt_inputs is None:
        missing = [name for name in ("total_debt", "cash_and_equivalents") if name not in facts]
        result.skipped["net_debt"] = f"missing: {', '.join(missing)}"
    else:
        net_debt_value = calculations.net_debt(*net_debt_inputs)
        result.computed["net_debt"] = net_debt_value

    if net_debt_value is not None:
        attempt(
            "net_debt_to_ebitda",
            "ebitda",
            fn=lambda ebitda: calculations.net_debt_to_ebitda(net_debt_value, ebitda),
        )
        if "free_cash_flow" in result.computed:
            try:
                result.computed["net_debt_to_fcf"] = calculations.net_debt_to_fcf(
                    net_debt_value, result.computed["free_cash_flow"]
                )
            except ValueError as exc:
                result.skipped["net_debt_to_fcf"] = str(exc)
        else:
            result.skipped["net_debt_to_fcf"] = "missing: free_cash_flow (itself unavailable)"
    else:
        result.skipped["net_debt_to_ebitda"] = "missing: net_debt (itself unavailable)"
        result.skipped["net_debt_to_fcf"] = "missing: net_debt (itself unavailable)"

    attempt(
        "interest_coverage", "ebit", "interest_expense", fn=calculations.interest_coverage
    )
    attempt("debt_to_equity", "total_debt", "total_equity", fn=calculations.debt_to_equity)

    for metric_name in ("roic", "roe"):
        result.skipped[metric_name] = (
            "not computable from extracted filing facts alone "
            "(needs NOPAT/invested capital — not yet derived)"
        )
    for metric_name in (
        "price_to_earnings",
        "price_to_book",
        "price_to_sales",
        "ev_to_ebitda",
        "enterprise_value",
    ):
        result.skipped[metric_name] = "requires live market data (Phase 2, not yet available)"

    return result
