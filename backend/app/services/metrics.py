"""Turns a holding's raw extracted facts (FinancialLineItem rows, one
period's worth) into the deterministic ratios app/services/calculations.py
knows how to compute — CLAUDE.md Rule 1: this is application code, the LLM
never touches this arithmetic.

Every ratio is computed only when every input it needs is present in the
facts dict; anything that can't be computed is reported with the specific
missing input(s) rather than silently omitted (CLAUDE.md: fail visibly).

Returns on capital (2026-09-25, claude/gap-closing-roic-roe-multiples-2026-09-25.md):
- ROE = net income to ordinary holders / AVERAGE ordinary equity (this and
  the prior year-end when the prior year is on file). Not meaningful when
  that equity is <= 0 or under 5% of total assets — dividends and buybacks
  have emptied the book (Vår Energi), and ROE then measures the payout
  policy, not the business. ROIC is the metric to judge such a company on.
- ROIC = EBIT x (1 - EFFECTIVE tax rate) / average invested capital. The
  rate is the filing's own tax / pre-tax profit (Vår Energi ~90% under the
  Norwegian petroleum tax) — never a statutory 22%. Invested capital =
  debt + hybrid capital + lease liabilities + ordinary equity + minority
  interests - cash.
- ROCE = EBIT / the same average invested capital: the pre-tax return,
  comparable across tax regimes.
- Materials margin = (revenue - raw materials and consumables used) /
  revenue, only for income statements by nature (no cost of sales).

Market multiples need a share price and a share count, which aren't
filing facts: the caller passes them as MarketInputs (price already
converted to the filing's reporting currency, share count from
app/services/market_data/shares.py). Without them every multiple is
skipped with the reason.

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


@dataclass(frozen=True)
class MarketInputs:
    """What the multiples need beyond the filing: a price per share already
    in the filing's reporting currency, and a share count. `note` says
    where both came from; it is shown next to market cap."""

    price: Decimal
    shares: Decimal
    note: str = ""


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
    "roe",
    "roic",
    "roce",
    "materials_margin",
)
MARKET_RATIOS = (
    "market_cap",
    "enterprise_value",
    "price_to_earnings",
    "price_to_book",
    "price_to_sales",
    "ev_to_ebitda",
    "fcf_yield",
)
NON_MONETARY_FACTS = frozenset({"shares_outstanding"})

# Ordinary equity below this share of total assets is "depleted": ROE and
# P/B over it describe the payout history, not the business.
DEPLETED_EQUITY_SHARE_OF_ASSETS = Decimal("0.05")

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
    facts: dict[str, Decimal],
    currencies: dict[str, str | None] | None = None,
    *,
    prior_facts: dict[str, Decimal] | None = None,
    market: MarketInputs | None = None,
    market_unavailable_reason: str | None = None,
) -> MetricsResult:
    """`facts` maps canonical metric name (app/domain/financial_metrics.py's
    CANONICAL_METRICS) -> value, for a single holding and a single period.
    `currencies` (optional) maps the same names -> ISO currency; when the
    monetary facts of one period come in more than one currency (e.g. a
    NOK factsheet and a USD annual report), nothing is computed — a ratio
    across currencies is wrong, not approximately right.

    `prior_facts` (the previous fiscal year, same holding) turns year-end
    denominators into averages for ROE / ROIC / ROCE. `market` enables the
    market multiples; `market_unavailable_reason` explains their absence."""
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
        for name in (*FACT_RATIOS, *MARKET_RATIOS):
            result.skipped[name] = "not computed: mixed currencies"
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

    _materials_margin(facts, result)
    prior = _with_ebit(prior_facts) if prior_facts else None
    _return_on_equity(facts, prior, result)
    _returns_on_capital(facts, prior, result)
    if market is None:
        reason = market_unavailable_reason or "needs a share price and a share count"
        for name in MARKET_RATIOS:
            result.skipped[name] = f"not available: {reason}"
    else:
        _market_multiples(facts, market, net_debt_value, result)
    return result


def _with_ebit(facts: dict[str, Decimal]) -> dict[str, Decimal]:
    facts = dict(facts)
    if "ebit" not in facts and "operating_income" in facts:
        facts["ebit"] = facts["operating_income"]
    return facts


def _pct(value: Decimal) -> str:
    return f"{value * 100:.1f}%"


def _averaged(
    current: Decimal, prior: Decimal | None, what: str
) -> tuple[Decimal, str]:
    """(average of the two year-ends, note) — or the year-end alone when the
    prior year isn't on file, and the note says so."""
    if prior is None:
        return current, f"{what} at year-end (prior year not on file, so not averaged)"
    return (current + prior) / 2, f"average {what} {_fmt(prior)} → {_fmt(current)}"


def _depleted(equity: Decimal, facts: dict[str, Decimal], what: str = "ordinary equity") -> str | None:
    """Reason text when ordinary equity is too thin to divide by, else None."""
    assets = facts.get("total_assets")
    if equity <= ZERO:
        return _not_meaningful(what, equity)
    if assets and assets > ZERO and equity < assets * DEPLETED_EQUITY_SHARE_OF_ASSETS:
        return (
            f"not meaningful: {what} ({_fmt(equity)}) is only {_pct(equity / assets)} "
            "of total assets — book equity depleted by distributions; judge on ROIC"
        )
    return None


def _materials_margin(facts: dict[str, Decimal], result: MetricsResult) -> None:
    if "cost_of_goods_sold" in facts:
        return  # a true gross margin exists; nothing to stand in for
    values = _get(facts, "revenue", "raw_materials_used")
    if values is None:
        result.skipped["materials_margin"] = (
            "missing: " + ", ".join(n for n in ("revenue", "raw_materials_used") if n not in facts)
        )
        return
    revenue, materials = values
    if revenue <= ZERO:
        result.skipped["materials_margin"] = _not_meaningful("revenue", revenue)
        return
    result.computed["materials_margin"] = calculations.gross_margin(revenue, materials)
    result.notes["materials_margin"] = (
        "revenue − raw materials and consumables used (income statement by nature) — "
        "not a true gross margin: staff and other production costs are not deducted"
    )


def _return_on_equity(
    facts: dict[str, Decimal], prior: dict[str, Decimal] | None, result: MetricsResult
) -> None:
    equity = ordinary_equity(facts)
    if "net_income" not in facts or equity is None:
        missing = [n for n in ("net_income", "total_equity") if n not in facts]
        result.skipped["roe"] = f"missing: {', '.join(missing)}"
        return
    prior_equity = ordinary_equity(prior) if prior else None
    average, note = _averaged(equity, prior_equity, "ordinary equity")
    reason = _depleted(average, facts, "average ordinary equity" if prior_equity is not None else "ordinary equity")
    if reason:
        result.skipped["roe"] = reason
        return
    result.computed["roe"] = calculations.roe(facts["net_income"], average)
    result.notes["roe"] = note + (" (hybrid capital excluded)" if facts.get("hybrid_capital") else "")


def invested_capital(facts: dict[str, Decimal]) -> tuple[Decimal, list[str]] | None:
    """Debt + hybrid capital + lease liabilities + ordinary equity + minority
    interests - cash, or None when debt, cash or equity is missing. The
    list names the optional parts that were included. Hybrid + ordinary
    equity = total equity, so total equity is used directly."""
    values = _get(facts, "total_debt", "total_equity", "cash_and_equivalents")
    if values is None:
        return None
    debt, equity, cash = values
    total = debt + equity - cash
    parts: list[str] = []
    for name, label in (("lease_liabilities", "leases"), ("minority_interests", "minority interests")):
        if facts.get(name):
            total += facts[name]
            parts.append(label)
    return total, parts


def effective_tax_rate(facts: dict[str, Decimal]) -> tuple[Decimal, str] | None:
    """(rate limited to 0-100%, note) from tax / pre-tax profit, or None
    when either is missing or pre-tax profit is <= 0."""
    values = _get(facts, "income_tax_expense", "income_before_tax")
    if values is None or values[1] <= ZERO:
        return None
    tax, pre_tax = values
    raw = tax / pre_tax
    rate = min(max(raw, ZERO), Decimal(1))
    note = f"effective tax {_pct(rate)} (tax {_fmt(tax)} ÷ pre-tax profit {_fmt(pre_tax)})"
    if rate != raw:
        note += f"; the filing's rate of {_pct(raw)} was limited to 0–100%"
    return rate, note


def _returns_on_capital(
    facts: dict[str, Decimal], prior: dict[str, Decimal] | None, result: MetricsResult
) -> None:
    capital = invested_capital(facts)
    if capital is None or "ebit" not in facts:
        missing = [
            n for n in ("ebit", "total_debt", "total_equity", "cash_and_equivalents") if n not in facts
        ]
        for name in ("roic", "roce"):
            result.skipped[name] = f"missing: {', '.join(missing)}"
        return
    current, parts = capital
    prior_capital = invested_capital(prior) if prior else None
    average, capital_note = _averaged(
        current, prior_capital[0] if prior_capital else None, "invested capital"
    )
    if parts:
        capital_note += f" (incl. {', '.join(parts)})"
    if average <= ZERO:
        for name in ("roic", "roce"):
            result.skipped[name] = _not_meaningful("average invested capital", average)
        return

    ebit = facts["ebit"]
    result.computed["roce"] = calculations.roic(ebit, average)
    result.notes["roce"] = f"EBIT ÷ {capital_note} — before tax"

    if ebit <= ZERO:
        result.skipped["roic"] = _not_meaningful("EBIT", ebit) + " — an operating loss; see ROCE"
        return
    missing_tax = [n for n in ("income_tax_expense", "income_before_tax") if n not in facts]
    if missing_tax:
        result.skipped["roic"] = f"missing: {', '.join(missing_tax)} (for the effective tax rate)"
        return
    tax = effective_tax_rate(facts)
    if tax is None:
        result.skipped["roic"] = (
            _not_meaningful("pre-tax profit", facts["income_before_tax"])
            + " — no effective tax rate; see ROCE"
        )
        return
    rate, tax_note = tax
    result.computed["roic"] = calculations.roic(ebit * (1 - rate), average)
    result.notes["roic"] = f"EBIT × (1 − tax rate) ÷ {capital_note}; {tax_note}"


def _market_multiples(
    facts: dict[str, Decimal],
    market: MarketInputs,
    net_debt_value: Decimal | None,
    result: MetricsResult,
) -> None:
    if market.shares <= ZERO or market.price <= ZERO:
        for name in MARKET_RATIOS:
            result.skipped[name] = "not available: share price or share count is not positive"
        return
    market_cap = market.price * market.shares
    result.computed["market_cap"] = market_cap
    if market.note:
        result.notes["market_cap"] = market.note

    if net_debt_value is None:
        result.skipped["enterprise_value"] = "missing: net_debt (itself unavailable)"
        enterprise_value = None
    else:
        extras = [
            (label, facts[name])
            for name, label in (("lease_liabilities", "leases"), ("minority_interests", "minority interests"))
            if facts.get(name)
        ]
        enterprise_value = calculations.enterprise_value(
            market_cap,
            net_debt_value + sum((v for _l, v in extras), ZERO),
            ZERO,
        )
        result.computed["enterprise_value"] = enterprise_value
        result.notes["enterprise_value"] = "market cap + net debt (incl. hybrid capital)" + "".join(
            f" + {label}" for label, _v in extras
        )

    def multiple(name: str, numerator: Decimal | None, fact: str, what: str, fn) -> None:
        if numerator is None:
            return
        if fact not in facts and fact not in result.computed:
            result.skipped[name] = f"missing: {fact}"
            return
        denominator = facts.get(fact, result.computed.get(fact))
        ratio(name, numerator, denominator, what, fn)  # type: ignore[arg-type]

    def ratio(name: str, numerator: Decimal, denominator: Decimal, what: str, fn) -> None:
        if denominator <= ZERO:
            result.skipped[name] = _not_meaningful(what, denominator)
            return
        result.computed[name] = fn(numerator, denominator)

    multiple("price_to_earnings", market_cap, "net_income", "net income", calculations.price_to_earnings)
    multiple("price_to_sales", market_cap, "revenue", "revenue", calculations.price_to_sales)
    if "ebitda" in facts:
        if enterprise_value is not None:
            multiple("ev_to_ebitda", enterprise_value, "ebitda", "EBITDA", calculations.ev_to_ebitda)
        else:
            result.skipped["ev_to_ebitda"] = "missing: enterprise_value (itself unavailable)"
    else:
        result.skipped["ev_to_ebitda"] = "missing: ebitda"

    equity = ordinary_equity(facts)
    if equity is None:
        result.skipped["price_to_book"] = "missing: total_equity"
    else:
        reason = _depleted(equity, facts)
        if reason:
            result.skipped["price_to_book"] = reason.replace("; judge on ROIC", "")
        else:
            result.computed["price_to_book"] = calculations.price_to_book(market_cap, equity)
            if facts.get("hybrid_capital"):
                result.notes["price_to_book"] = "on ordinary equity (hybrid capital excluded)"

    if "free_cash_flow" in result.computed:
        result.computed["fcf_yield"] = result.computed["free_cash_flow"] / market_cap
        result.notes["fcf_yield"] = "free cash flow to owners ÷ market cap"
    else:
        result.skipped["fcf_yield"] = "missing: free_cash_flow (itself unavailable)"
