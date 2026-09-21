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
}


def match_metric(raw_label: str) -> str | None:
    """Returns a canonical metric key for an exact known label, else None."""
    if not raw_label:
        return None
    key = " ".join(raw_label.strip().lower().split())
    return _LABEL_MAP.get(key)
