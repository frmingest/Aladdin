"""Deterministic Buffett/Munger vs Dalio comparison for one holding (Epic
F22, story 22.7). No LLM: the agree/disagree strip is a plain diff of the
two runs' stored verdicts (ECON-F22-06 — a model that sees both outputs
can blend them, so the comparison itself is code).
"""
from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime

from app.models.analysis import EquityAnalysisRun
from app.services.analysis.latest import run_portfolio_role, run_ratings

# Same ordering as thesis tracking's VERDICT_RANK, centred on Hold.
VERDICT_SCORE: dict[str, int] = {"Strong Buy": 2, "Buy": 1, "Hold": 0, "Sell": -1, "Avoid": -2}

ROLE_LABELS: dict[str, str] = {
    "growth_engine": "growth engine",
    "inflation_hedge": "inflation hedge",
    "deflation_hedge": "deflation hedge",
    "currency_debasement_hedge": "currency-debasement hedge",
    "diversifier": "diversifier",
    "redundant": "redundant",
}


@dataclass
class Comparison:
    agreement: str  # "agree" | "partly_agree" | "disagree" | "incomplete"
    headline: str
    buffett_verdict: str | None = None
    dalio_verdict: str | None = None
    dalio_role: str | None = None
    buffett_moat: str | None = None
    verdict_gap: int | None = None  # dalio score - buffett score
    points: list[str] = field(default_factory=list)
    buffett_analyzed_at: datetime | None = None
    dalio_analyzed_at: datetime | None = None


def compare_runs(buffett: EquityAnalysisRun | None, dalio: EquityAnalysisRun | None) -> Comparison:
    b_verdict, b_moat, b_at = run_ratings(buffett) if buffett else (None, None, None)
    d_verdict, _none, d_at = run_ratings(dalio) if dalio else (None, None, None)
    role = run_portfolio_role(dalio) if dalio else None
    comp = Comparison(
        agreement="incomplete",
        headline="",
        buffett_verdict=b_verdict,
        dalio_verdict=d_verdict,
        dalio_role=role,
        buffett_moat=b_moat,
        buffett_analyzed_at=b_at,
        dalio_analyzed_at=d_at,
    )
    if b_verdict is None or d_verdict is None:
        missing = [name for name, v in (("Buffett/Munger", b_verdict), ("Dalio", d_verdict)) if v is None]
        comp.headline = f"Waiting for the {' and '.join(missing)} analysis."
        return comp

    gap = VERDICT_SCORE[d_verdict] - VERDICT_SCORE[b_verdict]
    comp.verdict_gap = gap
    b_score, d_score = VERDICT_SCORE[b_verdict], VERDICT_SCORE[d_verdict]
    if gap == 0:
        comp.agreement = "agree"
        comp.headline = f"Both say {b_verdict}."
    elif b_score * d_score < 0 or abs(gap) >= 2:
        comp.agreement = "disagree"
        comp.headline = f"They disagree: Buffett/Munger {b_verdict}, Dalio {d_verdict}."
    else:
        comp.agreement = "partly_agree"
        comp.headline = f"Same direction, different strength: Buffett/Munger {b_verdict}, Dalio {d_verdict}."

    comp.points.append(
        f"Verdict gap: Dalio is {abs(gap)} step{'s' if abs(gap) != 1 else ''} "
        f"{'more positive' if gap > 0 else 'more negative' if gap < 0 else 'apart'} than Buffett/Munger."
        if gap
        else "Verdicts match exactly."
    )
    if b_moat:
        comp.points.append(f"Business quality (Buffett/Munger): {b_moat} moat.")
    if role:
        comp.points.append(f"Portfolio role (Dalio): {ROLE_LABELS.get(role, role)}.")
        if role == "redundant" and b_score > 0:
            comp.points.append(
                "Tension: a good business by Buffett/Munger's lens, but Dalio sees it adding a return stream "
                "the portfolio already has."
            )
        if role in ("inflation_hedge", "deflation_hedge", "currency_debasement_hedge", "diversifier") and b_score < 0:
            comp.points.append(
                "Tension: weak on business quality or price, but Dalio values it as a hedge/diversifier."
            )
    if b_at and d_at:
        days = abs((b_at - d_at).days)
        if days > 30:
            older = "Buffett/Munger" if b_at < d_at else "Dalio"
            comp.points.append(f"The {older} run is {days} days older — the two may be reading different markets.")
    if buffett is not None and buffett.price_target_low is not None:
        comp.points.append(
            f"DCF price-target range (deterministic): {buffett.price_target_low:,.2f}-{buffett.price_target_high:,.2f} "
            f"{buffett.price_target_currency or ''}."
        )
    return comp
