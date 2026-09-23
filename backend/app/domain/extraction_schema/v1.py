"""Versioned output schema for LLM-assisted financial-statement extraction
from uploaded PDF filings (2026-09-23).

The model's job here is transcription, not analysis: find a line on a
statement page and copy the number exactly as printed, with the page it's
on. It never adds, converts or rescales anything (CLAUDE.md Rule 1) — the
scale/sign/currency handling and the "is this number really on that page"
check are deterministic code in app/services/documents/financial_extraction.py.
"""
from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field

from app.domain.financial_metrics import CANONICAL_METRICS

MetricKey = Literal[
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
]

Scale = Literal["units", "thousands", "millions", "billions"]


class StatementFactV1(BaseModel):
    metric: MetricKey
    fiscal_year: int = Field(description="Calendar year the fiscal year ends in, e.g. 2025")
    value_as_printed: str = Field(
        description="The number exactly as printed on the page, including any parentheses or minus sign"
    )
    scale: Scale = Field(description="The unit the statement says its figures are in")
    currency: str | None = Field(
        default=None, description="ISO currency code the statement is presented in, null for share counts"
    )
    source_page: int = Field(description="The PAGE number the number was copied from")
    label_as_printed: str = Field(description="The line label exactly as printed next to the number")


class FinancialsExtractionV1(BaseModel):
    facts: list[StatementFactV1]


# Keep the Literal and the canonical tuple from drifting apart silently.
assert set(MetricKey.__args__) == set(CANONICAL_METRICS)  # type: ignore[attr-defined]
