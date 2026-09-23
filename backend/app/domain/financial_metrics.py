"""Deterministic label -> canonical metric mapping for structured financial
fact extraction (feeds `financial_line_items`, which
app/services/calculations.py computes ratios from).

This is intentionally a small, explicit lookup table rather than fuzzy or
LLM-based matching — CLAUDE.md Rule 1 (deterministic arithmetic) extends to
what counts as a *fact* in the first place: every value that lands in
financial_line_items must be attributable to an exact source cell, not a
guess. An unrecognized row label is simply not extracted as a structured
fact; it remains available as raw page/chunk text.

Extend this table as real filings show unmapped labels — do not make it
fuzzy in order to cover more rows automatically.
"""

CANONICAL_METRICS = (
    "revenue",
    "cost_of_goods_sold",
    "operating_income",
    "ebitda",
    "ebit",
    "net_income",
    "depreciation_and_amortization",
    "total_assets",
    "total_equity",
    "total_liabilities",
    "operating_cash_flow",
    "shares_outstanding",
    "total_debt",
    "cash_and_equivalents",
    "capital_expenditures",
    "interest_expense",
)

# Exact-match (case-insensitive, whitespace-normalized) label -> canonical
# metric. Covers common English and Norwegian statement labels — Faiz's
# real filings are a mix of both.
_LABEL_MAP: dict[str, str] = {
    "revenue": "revenue",
    "total revenue": "revenue",
    "net revenue": "revenue",
    "net sales": "revenue",
    "sales": "revenue",
    "operating revenue": "revenue",
    "driftsinntekter": "revenue",
    "omsetning": "revenue",
    "sum driftsinntekter": "revenue",
    "cost of goods sold": "cost_of_goods_sold",
    "cost of sales": "cost_of_goods_sold",
    "varekostnad": "cost_of_goods_sold",
    "operating income": "operating_income",
    "operating profit": "operating_income",
    "ebitda": "ebitda",
    "ebit": "ebit",
    "driftsresultat": "ebit",
    "net income": "net_income",
    "net profit": "net_income",
    "profit for the year": "net_income",
    "årsresultat": "net_income",
    "resultat etter skatt": "net_income",
    "depreciation and amortization": "depreciation_and_amortization",
    "depreciation & amortization": "depreciation_and_amortization",
    "avskrivninger": "depreciation_and_amortization",
    "total assets": "total_assets",
    "sum eiendeler": "total_assets",
    "total equity": "total_equity",
    "sum egenkapital": "total_equity",
    "total liabilities": "total_liabilities",
    "sum gjeld": "total_liabilities",
    "operating cash flow": "operating_cash_flow",
    "cash flow from operations": "operating_cash_flow",
    "kontantstrøm fra drift": "operating_cash_flow",
    "shares outstanding": "shares_outstanding",
    "utestående aksjer": "shares_outstanding",
    "total debt": "total_debt",
    "sum gjeld rentebærende": "total_debt",
    "interest-bearing debt": "total_debt",
    "cash and cash equivalents": "cash_and_equivalents",
    "cash and equivalents": "cash_and_equivalents",
    "kontanter og kontantekvivalenter": "cash_and_equivalents",
    "capital expenditures": "capital_expenditures",
    "capital expenditure": "capital_expenditures",
    "capex": "capital_expenditures",
    "investeringer i varige driftsmidler": "capital_expenditures",
    "interest expense": "interest_expense",
    "rentekostnader": "interest_expense",
    # --- 2026-09-23: labels seen in real Oslo Børs IR downloads (Vår Energi
    # factsheet CSV, Orkla quarterly/accounting-figures CSV) and common IFRS
    # statement wording. Still exact matches only.
    "operating revenues": "revenue",
    "total operating revenues": "revenue",
    "revenues": "revenue",
    "total revenues": "revenue",
    "sales revenue": "revenue",
    "salgsinntekter": "revenue",
    "total income": "revenue",
    "operating profit/(loss)": "operating_income",
    "operating profit/(loss) (ebit)": "operating_income",
    "operating profit (ebit)": "operating_income",
    "operating profit (loss)": "operating_income",
    "profit from operations": "operating_income",
    "profit for the period": "net_income",
    "profit/(loss) for the period": "net_income",
    "profit/(loss) for the year": "net_income",
    "profit (loss) for the period": "net_income",
    "profit (loss) for the year": "net_income",
    "net profit for the year": "net_income",
    "net income for the year": "net_income",
    "profit attributable to owners of the parent": "net_income",
    "profit for the period attributable to owners of the parent": "net_income",
    "profit attributable to equity holders of the parent": "net_income",
    "depreciation and amortisation": "depreciation_and_amortization",
    "depreciation & amortisation": "depreciation_and_amortization",
    "depreciation": "depreciation_and_amortization",
    "equity attributable to owners of the parent": "total_equity",
    "net cash flow from operating activities": "operating_cash_flow",
    "net cash from operating activities": "operating_cash_flow",
    "net cash flows from operating activities": "operating_cash_flow",
    "net cash provided by operating activities": "operating_cash_flow",
    "cash flow from operating activities": "operating_cash_flow",
    "cash flows from operating activities": "operating_cash_flow",
    "purchase of property, plant and equipment": "capital_expenditures",
    "purchases of property, plant and equipment": "capital_expenditures",
    "expenditures on property, plant and equipment": "capital_expenditures",
    "investments in property, plant and equipment": "capital_expenditures",
    "interest expenses": "interest_expense",
    "finance costs": "interest_expense",
}

# When two different labels in the same statement map to the same metric
# (e.g. "Profit for the period" and "Profit attributable to owners of the
# parent"), the label NOT listed here wins. The order mirrors the SEC
# EDGAR concept priority (app/providers/sec_edgar_provider.py CONCEPT_MAP):
# parent-attributable profit/equity over group totals, revenue over
# "total income" (which includes other operating income), D&A over bare
# depreciation. Two same-priority labels with different values are a
# conflict and neither is imported.
LOW_PRIORITY_LABELS: frozenset[str] = frozenset(
    {
        "total income",
        "profit for the period",
        "profit/(loss) for the period",
        "profit/(loss) for the year",
        "profit (loss) for the period",
        "profit (loss) for the year",
        "profit for the year",
        "net profit for the year",
        "net income for the year",
        "total equity",
        "sum egenkapital",
        "depreciation",
        "finance costs",
    }
)

# Stored as positive magnitudes whatever sign the source prints them with
# ("(858)", "-656") — the same convention SEC EDGAR facts use, which
# app/services/calculations.py relies on (free_cash_flow = OCF - capex,
# owner earnings = NI + D&A - capex).
POSITIVE_MAGNITUDE_METRICS: frozenset[str] = frozenset(
    {
        "cost_of_goods_sold",
        "depreciation_and_amortization",
        "capital_expenditures",
        "interest_expense",
    }
)


def normalize_label(raw_label: str) -> str:
    """Lower-cases, collapses whitespace, and strips list markers ("- ",
    "• ") and trailing colons/footnote asterisks that statement tables
    print around otherwise-standard labels (" - Depreciation and
    amortisation" in a cash-flow reconciliation)."""
    key = " ".join(raw_label.strip().lower().split())
    key = key.lstrip("-–—•* ").rstrip(":* ").strip()
    return key


def match_metric(raw_label: str) -> str | None:
    """Returns a canonical metric key for an exact known label, else None."""
    if not raw_label:
        return None
    return _LABEL_MAP.get(normalize_label(raw_label))


def label_priority(raw_label: str) -> int:
    """0 = preferred label for its metric, 1 = fallback (LOW_PRIORITY_LABELS)."""
    return 1 if normalize_label(raw_label) in LOW_PRIORITY_LABELS else 0
