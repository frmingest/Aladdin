"""dalio_v1 analysis output schema — the Ray Dalio persona (Epic F22, story
22.4). A new file, not an edit of v1/fund_v1 (CLAUDE.md Rule 3). One schema
for every instrument type (decision 5): Dalio's questions are
asset-class-based, so they apply the same way to a stock, a fund or a gold
ETC; what differs is the evidence.

The question it answers (plan §3, ECON-F22-01): not "is this a wonderful
business at a sensible price?" but "given where we are in the debt,
liquidity and geopolitical cycles, should I own this, and what job does it
do in my portfolio?"

  1. debt_cycle                     short- and long-term debt-cycle position
  2. quadrant_fit                   which growth/inflation environments it suits
  3. currency_risk                  currency and reserve-currency exposure
  4. country_risk                   sovereign stress and political stability
  5. internal_external_order        geopolitical / conflict exposure
  6. portfolio_role_and_diversification
  7. verdict                        Dalio's own Buy/Sell on the shared
                                    VerdictRating scale + a portfolio_role tag

Every number the model talks about is already in the evidence packet
(app/services/dalio/evidence.py) — CLAUDE.md Rule 1. The price-target range
is still set in Python from the DCF where one exists (stocks), and is n/a
for funds and ETCs.
"""
from __future__ import annotations

from typing import Literal

from pydantic import BaseModel

from app.domain.analysis_schema.v1 import NarrativeAssessment, VerdictRating

ShortTermDebtCyclePhase = Literal[
    "early_expansion", "late_expansion", "tightening", "contraction", "reflation", "unclear"
]
LongTermDebtCyclePhase = Literal["early", "mid", "late_leveraging", "deleveraging", "unclear"]
Environment = Literal["rising_growth", "falling_growth", "rising_inflation", "falling_inflation"]
PortfolioRole = Literal[
    "growth_engine",
    "inflation_hedge",
    "deflation_hedge",
    "currency_debasement_hedge",
    "diversifier",
    "redundant",
]

PORTFOLIO_ROLES: tuple[str, ...] = (
    "growth_engine",
    "inflation_hedge",
    "deflation_hedge",
    "currency_debasement_hedge",
    "diversifier",
    "redundant",
)
ENVIRONMENTS: tuple[str, ...] = ("rising_growth", "falling_growth", "rising_inflation", "falling_inflation")


class DebtCycleAssessment(BaseModel):
    short_term_phase: ShortTermDebtCyclePhase
    long_term_phase: LongTermDebtCyclePhase
    summary: str
    evidence_ids: list[str]


class QuadrantFit(BaseModel):
    favoured_environments: list[Environment]
    summary: str
    evidence_ids: list[str]


class DalioVerdict(BaseModel):
    rating: VerdictRating
    portfolio_role: PortfolioRole
    thesis_bullets: list[str]
    top_risks: list[str]
    metrics_to_monitor: list[str]
    invalidation_triggers: list[str]
    evidence_ids: list[str]


class DalioBlindPassOutputV1(BaseModel):
    debt_cycle: DebtCycleAssessment
    quadrant_fit: QuadrantFit
    currency_risk: NarrativeAssessment
    country_risk: NarrativeAssessment
    internal_external_order: NarrativeAssessment
    portfolio_role_and_diversification: NarrativeAssessment
    verdict: DalioVerdict


class DalioReconciliationOutputV1(BaseModel):
    verdict: DalioVerdict
    reconciliation_narrative: str
    changed_from_blind: bool
    evidence_ids: list[str]


def cited_evidence_ids_dalio_blind(output: DalioBlindPassOutputV1) -> set[str]:
    ids: set[str] = set(output.debt_cycle.evidence_ids) | set(output.quadrant_fit.evidence_ids)
    for section in (
        output.currency_risk,
        output.country_risk,
        output.internal_external_order,
        output.portfolio_role_and_diversification,
    ):
        ids.update(section.evidence_ids)
    ids.update(output.verdict.evidence_ids)
    return ids
