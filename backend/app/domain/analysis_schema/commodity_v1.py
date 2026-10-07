"""commodity_v1 analysis output schema — a physical-metal ETC / certificate
(2026-10-07). A new file next to v1 and fund_v1 (CLAUDE.md Rule 3).

A bar of metal has no earnings, no balance sheet and no moat. Buffett's own
view of gold is the yardstick: it produces nothing, so its price rests on
the next buyer. The reader still asks what a holder must judge:

  1. What exactly do I own?    -> `what_you_own` (backing, custody, the
     right to delivery, issuer structure, premium or discount to the metal)
  2. What does holding it cost? -> `cost_and_carry` (the yearly charge and
     the carry hurdle: how far the metal must rise just to match T-bills)
  3. Macro stress test          -> `macro_stress_test` (real rates, the
     currency, the metal's role in a crisis)
  4. Role in the portfolio      -> `role_in_portfolio` (insurance, hedge or
     speculation; position size; a cheaper way to hold the same thing)
  5. Verdict                    -> VerdictContent (same shape as v1)

No `moat` and no `valuation_synthesis`: the metal has no intrinsic value in
the evidence. Every number is computed in Python. The reconciliation pass
reuses ReconciliationOutputV1 unchanged.
"""
from __future__ import annotations

from pydantic import BaseModel

from app.domain.analysis_schema.v1 import NarrativeAssessment, VerdictContent


class CommodityBlindPassOutputV1(BaseModel):
    what_you_own: NarrativeAssessment
    cost_and_carry: NarrativeAssessment
    macro_stress_test: NarrativeAssessment
    role_in_portfolio: NarrativeAssessment
    verdict: VerdictContent


def cited_evidence_ids_commodity_blind(output: CommodityBlindPassOutputV1) -> set[str]:
    ids: set[str] = set(output.verdict.evidence_ids)
    for section in (
        output.what_you_own,
        output.cost_and_carry,
        output.macro_stress_test,
        output.role_in_portfolio,
    ):
        ids.update(section.evidence_ids)
    return ids
