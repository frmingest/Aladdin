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

Owner's view (Buffett/Munger definitions, decided 2026-09-23 — see
claude/fy2025-uploads-external-validation-2026-09-23.md):
- Free cash flow is cash left for the ORDINARY shareholder: operating cash
  flow minus capex, decommissioning payments, and — when IFRS lets the
  company classify them outside operating activities — interest paid,
  lease payments and hybrid-capital coupons. Each deduction is used only
  when it was extracted, and each one used is named in the notes.
- Owner earnings = net income + D&A - capex - decommissioning payments -
  lease payments. Net income is already after interest and hybrid coupons;
  lease payments are subtracted because IFRS 16 puts part of rent into the
  D&A that is added back.
- Hybrid/perpetual capital is debt to an ordinary shareholder: it is added
  to net debt and taken out of equity for debt/equity.
- A ratio whose denominator is zero or negative is "not meaningful" and is
  reported as skipped with the reason, never as a number (-27x Net
  debt/EBITDA on a loss-making company says nothing).
"""
from __future__ import annotations

from dataclasses import dataclass, field
from decimal import Decimal

from app.services import calculations

ZERO = Decimal(0)

# Capex above this multiple of D&A almost certainly includes growth
# investment; owner earnings still treat it all as maintenance
# (conservative), but say so.
GROWTH_CAPEX_MULTIPLE = Decimal("1.5")


@dataclass
class MetricsResult:
    computed: dict[str, Decimal] = field(default_factory=dict)
    skipped: dict[str, str] = field(default_factory=dict)
    # metric -> how an input was stood in for (e.g. "EBIT = operating
    # income"), shown next to the number so a substitution is never silent.
    notes: dict[str, str] = field(default_factory=dict)
    # Whole-period problems (mixed currencies, ...).
    warnings: list[str] = field(default_factory=list)


# Every name this module can put in `computed` from facts alone.
FACT_RATIOS = (
    "gross_margin",
    "operating_margin",
    "net_margin",
    "free_cash_flow",
    "owner_earnings",
    "net_debt",
    "net_debt_to_ebitda",
    "net_debt_to_fcf",
    "interest_coverage",
    "debt_to_equity",
)
NON_MONETARY_FACTS = frozenset({"shares_outstanding"})

# (fact, label) — cash outflows subtracted from FCF when extracted.
FCF_DEDUCTIONS: tuple[tuple[str, str], ...] = (
    ("decommissioning_payments", "decommissioning payments"),
    ("interest_paid_financing", "interest paid (classified in financing)"),
    ("lease_payments_financing", "lease payments"),
    ("hybrid_distributions", "hybrid capital coupons"),
)
# Owner earnings start from net income, which is already after interest
# expense and (to ordinary holders) hybrid coupons.
OWNER_EARNINGS_DEDUCTIONS: tuple[tuple[str, str], ...] = (
    ("decommissioning_payments", "decommissioning payments"),
    ("lease_payments_financing", "lease payments"),
)


def _get(facts: dict[str, Decimal], *names: str) -> list[Decimal] | None:
    values = []
    missing = []
    for name in names:
        if name in facts:
            values.append(facts[name])
        else:
            missing.append(name)
    return values if not missing else None


def _deductions(
    facts: dict[str, Decimal], deductions: tuple[tuple[str, str], ...]
) -> tuple[Decimal, list[str]]:
    total = ZERO
    used: list[str] = []
    for name, label in deductions:
        value = facts.get(name)
        if value:
            total += value
            used.append(label)
    return total, used


def free_cash_flow_to_owners(facts: dict[str, Decimal]) -> tuple[Decimal, str | None] | None:
    """(FCF, note) or None when operating cash flow or capex is missing.
    The note names the extra deductions used; None when there were none."""
    values = _get(facts, "operating_cash_flow", "capital_expenditures")
    if values is None:
        return None
    extra, used = _deductions(facts, FCF_DEDUCTIONS)
    value = calculations.free_cash_flow(*values) - extra
    note = ("operating cash flow - capex" + "".join(f" - {label}" for label in used)) if used else None
    return value, note


def owner_earnings_from_facts(facts: dict[str, Decimal]) -> tuple[Decimal, str | None] | None:
    """(owner earnings, note) or None when an input is missing. Shared by
    GET /holdings/{id}/metrics, the evidence packet and the DCF, so all
    three use the same definition."""
    values = _get(facts, "net_income", "depreciation_and_amortization", "capital_expenditures")
    if values is None:
        return None
    net_income, d_and_a, capex = values
    extra, used = _deductions(facts, OWNER_EARNINGS_DEDUCTIONS)
    # working_capital_change isn't an extracted fact yet — explicitly 0,
    # matching calculations.owner_earnings's own documented convention.
    value = calculations.owner_earnings(net_income, d_and_a, capex, ZERO) - extra
    parts = []
    if used:
        parts.append("net income + D&A - capex" + "".join(f" - {label}" for label in used))
    if d_and_a > ZERO and capex > d_and_a * GROWTH_CAPEX_MULTIPLE:
        parts.append(
            f"capex is {capex / d_and_a:.1f}x D&A, so it likely includes growth "
            "investment — all of it is treated as maintenance (conservative)"
        )
    return value, "; ".join(parts) or None


def ordinary_equity(facts: dict[str, Decimal]) -> Decimal | None:
    """Equity belonging to ordinary shareholders: total equity minus any
    hybrid/perpetual capital classified as equity."""
    if "total_equity" not in facts:
        return None
    return facts["total_equity"] - facts.get("hybrid_capital", ZERO)


def _fmt(value: Decimal) -> str:
    return f"{value / Decimal(1_000_000):,.1f}m" if abs(value) >= 1_000_000 else f"{value:,.2f}"


def _not_meaningful(what: str, value: Decimal) -> str:
    return f"not meaningful: {what} is {'zero' if value == ZERO else 'negative'} ({_fmt(value)})"


def compute_holding_metrics(
    facts: dict[str, Decimal], currencies: dict[str, str | None] | None = None
) -> MetricsResult:
    """`facts` maps canonical metric name (app/domain/financial_metrics.py's
    CANONICAL_METRICS) -> value, for a single holding and a single period.
    `currencies` (optional) maps the same names -> ISO currency; when the
    monetary facts of one period come in more than one currency (e.g. a
    NOK factsheet and a USD annual report), nothing is computed — a ratio
    across currencies is wrong, not approximately right."""
    result = MetricsResult()

    mixed = sorted(
        {c for m, c in (currencies or {}).items() if c and m in facts and m not in NON_MONETARY_FACTS}
    )
    if len(mixed) > 1:
        message = (
            f"facts for this period are in mixed currencies ({', '.join(mixed)}) — "
            "delete the document with the wrong currency and re-upload"
        )
        result.warnings.append(message)
        for name in FACT_RATIOS:
            result.skipped[name] = "not computed: mixed currencies"
        _always_skipped(result)
        return result

    facts = dict(facts)
    # EBIT: an IFRS/GAAP operating profit IS EBIT (finance items and tax sit
    # below it). Used only when no explicit EBIT fact exists, and said so.
    if "ebit" not in facts and "operating_income" in facts:
        facts["ebit"] = facts["operating_income"]
        result.notes["interest_coverage"] = "EBIT = operating income"
    # EBITDA: derived only when not extracted directly. Impairments are not
    # separated from operating income here (an iXBRL upload derives EBITDA
    # properly, net of impairments, at extraction time).
    if "ebitda" not in facts and "ebit" in facts and "depreciation_and_amortization" in facts:
        facts["ebitda"] = facts["ebit"] + facts["depreciation_and_amortization"]
        result.notes["net_debt_to_ebitda"] = "EBITDA = EBIT + D&A (impairments not separated)"

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

    def ratio(metric_name: str, numerator: Decimal, denominator: Decimal, what: str, fn) -> None:
        if denominator <= ZERO:
            result.skipped[metric_name] = _not_meaningful(what, denominator)
            return
        result.computed[metric_name] = fn(numerator, denominator)

    for metric_name, other, fn in (
        ("gross_margin", "cost_of_goods_sold", calculations.gross_margin),
        ("operating_margin", "operating_income", calculations.operating_margin),
        ("net_margin", "net_income", calculations.net_margin),
    ):
        if "revenue" in facts and facts["revenue"] <= ZERO:
            result.skipped[metric_name] = _not_meaningful("revenue", facts["revenue"])
        else:
            attempt(metric_name, "revenue", other, fn=fn)

    fcf = free_cash_flow_to_owners(facts)
    if fcf is None:
        missing = [n for n in ("operating_cash_flow", "capital_expenditures") if n not in facts]
        result.skipped["free_cash_flow"] = f"missing: {', '.join(missing)}"
    else:
        result.computed["free_cash_flow"] = fcf[0]
        if fcf[1]:
            result.notes["free_cash_flow"] = fcf[1]

    owner = owner_earnings_from_facts(facts)
    if owner is None:
        missing = [
            name
            for name in ("net_income", "depreciation_and_amortization", "capital_expenditures")
            if name not in facts
        ]
        result.skipped["owner_earnings"] = f"missing: {', '.join(missing)}"
    else:
        result.computed["owner_earnings"] = owner[0]
        if owner[1]:
            result.notes["owner_earnings"] = owner[1]

    hybrid = facts.get("hybrid_capital", ZERO)
    net_debt_inputs = _get(facts, "total_debt", "cash_and_equivalents")
    net_debt_value: Decimal | None = None
    if net_debt_inputs is None:
        missing = [name for name in ("total_debt", "cash_and_equivalents") if name not in facts]
        result.skipped["net_debt"] = f"missing: {', '.join(missing)}"
    else:
        total_debt, cash = net_debt_inputs
        net_debt_value = calculations.net_debt(total_debt + hybrid, cash)
        result.computed["net_debt"] = net_debt_value
        if hybrid:
            result.notes["net_debt"] = (
                f"includes hybrid capital {_fmt(hybrid)} as debt; leases excluded"
            )

    if net_debt_value is not None:
        if "ebitda" in facts:
            ratio(
                "net_debt_to_ebitda", net_debt_value, facts["ebitda"], "EBITDA",
                calculations.net_debt_to_ebitda,
            )
        else:
            result.skipped["net_debt_to_ebitda"] = "missing: ebitda"
        if "free_cash_flow" in result.computed:
            ratio(
                "net_debt_to_fcf", net_debt_value, result.computed["free_cash_flow"],
                "free cash flow", calculations.net_debt_to_fcf,
            )
        else:
            result.skipped["net_debt_to_fcf"] = "missing: free_cash_flow (itself unavailable)"
    else:
        result.skipped["net_debt_to_ebitda"] = "missing: net_debt (itself unavailable)"
        result.skipped["net_debt_to_fcf"] = "missing: net_debt (itself unavailable)"

    coverage_inputs = _get(facts, "ebit", "interest_expense")
    if coverage_inputs is None:
        missing = [n for n in ("ebit", "interest_expense") if n not in facts]
        result.skipped["interest_coverage"] = f"missing: {', '.join(missing)}"
    elif coverage_inputs[0] <= ZERO:
        result.skipped["interest_coverage"] = (
            _not_meaningful("EBIT", coverage_inputs[0]) + " — operating earnings don't cover interest"
        )
    else:
        ratio(
            "interest_coverage", coverage_inputs[0], coverage_inputs[1], "interest expense",
            calculations.interest_coverage,
        )

    equity = ordinary_equity(facts)
    if "total_debt" not in facts or equity is None:
        missing = [n for n in ("total_debt", "total_equity") if n not in facts]
        result.skipped["debt_to_equity"] = f"missing: {', '.join(missing)}"
    else:
        what = "ordinary shareholders' equity" if hybrid else "equity"
        ratio(
            "debt_to_equity", facts["total_debt"] + hybrid, equity, what,
            calculations.debt_to_equity,
        )
        if hybrid:
            note = (
                f"hybrid capital {_fmt(hybrid)} counted as debt, not equity "
                f"(ordinary equity {_fmt(equity)})"
            )
            result.notes["debt_to_equity"] = note

    _always_skipped(result)
    return result


def _always_skipped(result: MetricsResult) -> None:
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
