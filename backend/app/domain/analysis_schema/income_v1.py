"""income_v1 analysis output schema — bond funds and money-market funds
(2026-10-07). A new file next to v1 and fund_v1 (CLAUDE.md Rule 3).

An income fund owns loans, not businesses: there is no moat, no
look-through of company quality and no DCF. A Buffett/Munger reader asks
three things of one:

  1. What do I earn, against the safe alternative?  -> `yield_and_alternatives`
     (yield, spread over Norwegian bills and bonds, real yield after
     inflation, how much of the yield the fee takes)
  2. What can go wrong?                              -> `credit_and_rate_risk`
     (credit quality, duration and the price effect of a rate rise, the
     breakeven rate rise, concentration in few issuers)
  3. What does the steward cost, and does it earn it? -> `steward_and_costs`
  then how the basket is built (`portfolio_construction`), the macro
  stress test, the role the fund plays, and the verdict (same shape as v1).

There is deliberately no `moat` field: the dashboard's moat roll-up
(app/services/analysis/latest.run_ratings) simply finds none for these.
Every number is computed in Python (app/services/instruments/metrics.py).
The reconciliation pass reuses ReconciliationOutputV1 unchanged.
"""
from __future__ import annotations

from pydantic import BaseModel

from app.domain.analysis_schema.v1 import NarrativeAssessment, VerdictContent


class IncomeBlindPassOutputV1(BaseModel):
    yield_and_alternatives: NarrativeAssessment
    credit_and_rate_risk: NarrativeAssessment
    steward_and_costs: NarrativeAssessment
    portfolio_construction: NarrativeAssessment
    macro_stress_test: NarrativeAssessment
    role_in_portfolio: NarrativeAssessment
    verdict: VerdictContent


def cited_evidence_ids_income_blind(output: IncomeBlindPassOutputV1) -> set[str]:
    ids: set[str] = set(output.verdict.evidence_ids)
    for section in (
        output.yield_and_alternatives,
        output.credit_and_rate_risk,
        output.steward_and_costs,
        output.portfolio_construction,
        output.macro_stress_test,
        output.role_in_portfolio,
    ):
        ids.update(section.evidence_ids)
    return ids
