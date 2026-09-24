"""fund_v1 analysis output schema — the fund / ETF counterpart of v1
(Sprint 8, F9). A new file, not an edit of v1 (CLAUDE.md Rule 3).

A fund has no single business, no statements and no DCF, so the Brain's
five steps are re-cut around the two things a Buffett/Munger reader asks
of any fund:

  1. The businesses underneath   -> `moat` (look-through: the quality and
     moat of what the fund owns, as far as the look-through covers it)
  2. The steward and its cost    -> `steward_and_costs` (fees and their
     compounding drag, excess return or tracking difference, whether the
     manager does what the mandate says)
  3. How the basket is built     -> `portfolio_construction`
     (concentration, sector/country/currency, overlap with stocks owned
     directly)
  4. Macro & industry stress     -> `macro_stress_test`
  5. Price                       -> `valuation_synthesis` (only what the
     given evidence supports — usually no fund-level intrinsic value)
  6. Fit                         -> `role_in_portfolio` (circle of
     competence, what job this fund does in the portfolio)
  7. Verdict                     -> VerdictContent (same shape as v1)

`moat.overall_rating` uses the same Wide/Narrow/None scale as v1, so the
dashboard's moat roll-up (app/services/analysis/latest.run_ratings) works
unchanged. Every number in these sections comes from the evidence packet
(app/services/funds/evidence.py), computed in Python — CLAUDE.md Rule 1.

The reconciliation pass reuses ReconciliationOutputV1 unchanged.
"""
from __future__ import annotations

from pydantic import BaseModel

from app.domain.analysis_schema.v1 import (
    MoatRating,
    NarrativeAssessment,
    VerdictContent,
)


class LookThroughMoat(BaseModel):
    circle_of_competence_summary: str
    overall_rating: MoatRating
    """The value-weighted moat of the businesses the fund owns, as far as
    the look-through evidence covers them."""
    coverage_caveat: str
    """How much of the fund the moat judgement actually rests on."""
    evidence_ids: list[str]


class FundBlindPassOutputV1(BaseModel):
    moat: LookThroughMoat
    steward_and_costs: NarrativeAssessment
    portfolio_construction: NarrativeAssessment
    macro_stress_test: NarrativeAssessment
    valuation_synthesis: NarrativeAssessment
    role_in_portfolio: NarrativeAssessment
    verdict: VerdictContent


def cited_evidence_ids_fund_blind(output: FundBlindPassOutputV1) -> set[str]:
    ids: set[str] = set(output.moat.evidence_ids)
    for section in (
        output.steward_and_costs,
        output.portfolio_construction,
        output.macro_stress_test,
        output.valuation_synthesis,
        output.role_in_portfolio,
    ):
        ids.update(section.evidence_ids)
    ids.update(output.verdict.evidence_ids)
    return ids
