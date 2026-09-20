"""
Deterministic label -> canonical metric mapping for structured financial fact
extraction (architecture §6.2 Excel, §20 financial_line_items).

This is intentionally a small, explicit lookup table rather than fuzzy/LLM
matching — Phase 1 has no AI dependency (§26), and every value that lands in
financial_line_items must be attributable to an exact source cell, not a
guess (§5.1: derived metrics vs. LLM interpretation are different evidence
tiers). Unrecognized row labels are simply not extracted as structured facts;
they remain available as raw page/chunk text for later phases.

Extend this table as real exports show unmapped labels — do not make it
fuzzy in order to cover more rows automatically.
"""

CANONICAL_METRICS = (
    "revenue",
    "ebitda",
    "ebit",
    "net_income",
    "total_assets",
    "total_equity",
    "total_liabilities",
    "operating_cash_flow",
    "shares_outstanding",
    # Added for the Buffett/Munger redesign (2026-09-20) -- Step 2 of the
    # analysis framework (balance-sheet health, owner earnings) needs
    # net_debt (app.domain.calculations.net_debt), free_cash_flow
    # (app.domain.calculations.free_cash_flow), and interest-coverage-style
    # ratios (app.domain.calculations.ratio), none of which were extractable
    # from XLSX financial facts before these four labels existed. See
    # claude/buffett-munger-redesign-sprint-plan-2026-09-20.md.
    "total_debt",
    "cash_and_equivalents",
    "capital_expenditures",
    "interest_expense",
)

# Exact-match (case-insensitive, whitespace-normalized) label -> canonical metric.
# Covers common English and Norwegian statement labels.
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
    "ebitda": "ebitda",
    "ebit": "ebit",
    "driftsresultat": "ebit",
    "net income": "net_income",
    "net profit": "net_income",
    "profit for the year": "net_income",
    "årsresultat": "net_income",
    "resultat etter skatt": "net_income",
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
    # Added for the Buffett/Munger redesign (2026-09-20) -- see
    # CANONICAL_METRICS above for why.
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
