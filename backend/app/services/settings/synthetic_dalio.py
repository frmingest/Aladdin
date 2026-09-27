"""Fabricated demo-mode data for the Dalio and side-by-side modes (Epic
F22, story 22.12). Same rules as app/services/settings/synthetic_data.py:
built from the real response models, pure and deterministic, never reads
the database or a provider, and every narrative says it's demo data.
Kept in its own module because synthetic_data.py is already large.
"""
from __future__ import annotations

import uuid
from datetime import timedelta
from decimal import Decimal

from app.domain.analysis_schema.dalio_v1 import (
    DalioBlindPassOutputV1,
    DalioReconciliationOutputV1,
    DalioVerdict,
    DebtCycleAssessment,
    QuadrantFit,
)
from app.domain.analysis_schema.v1 import NarrativeAssessment
from app.domain.analyst_modes import DALIO_VERDICT_BASIS
from app.schemas.analysis import (
    ComparisonOut,
    EquityAnalysisRunOut,
    EvidenceItemOut,
    SideBySideOut,
)
from app.schemas.dalio import (
    AllWeatherOut,
    AllWeatherPositionOut,
    BetaOut,
    CountryFigureOut,
    CountryRiskOut,
    CycleFitBoardOut,
    CycleFitRowOut,
    DalioDerivedOut,
    DalioMacroOut,
    DalioSeriesOut,
    GoldDemandOut,
    WeightSliceOut,
)
from app.services.analysis.side_by_side import VERDICT_SCORE
from app.services.settings.synthetic_data import (
    _NOW,
    _ROWS,
    _ROWS_BY_ID,
    DEMO_NOTE,
    _other_id,
    demo_analysis_run,
)

_ROLE_BY_SECTOR = {
    "Technology": "growth_engine",
    "Health Care": "diversifier",
    "Consumer Staples": "deflation_hedge",
    "Financials": "growth_engine",
    "Energy": "inflation_hedge",
    "Consumer Discretionary": "redundant",
}
_VERDICT_BY_ROLE = {
    "growth_engine": "Hold",
    "inflation_hedge": "Buy",
    "deflation_hedge": "Buy",
    "diversifier": "Buy",
    "redundant": "Sell",
}
_ENVS_BY_ROLE = {
    "growth_engine": ["rising_growth", "falling_inflation"],
    "inflation_hedge": ["rising_inflation"],
    "deflation_hedge": ["falling_growth", "falling_inflation"],
    "diversifier": ["falling_growth"],
    "redundant": ["rising_growth"],
}
_ROLE_LABELS = {
    "growth_engine": "Growth engine", "inflation_hedge": "Inflation hedge", "deflation_hedge": "Deflation hedge",
    "currency_debasement_hedge": "Currency-debasement hedge", "diversifier": "Diversifier", "redundant": "Redundant",
}


def _role(row: dict) -> str:
    return _ROLE_BY_SECTOR.get(row["sector"], "diversifier")


def _section() -> NarrativeAssessment:
    return NarrativeAssessment(summary=DEMO_NOTE, evidence_ids=["demo-1"])


def demo_dalio_run(holding_id: uuid.UUID) -> EquityAnalysisRunOut | None:
    row = _ROWS_BY_ID.get(holding_id)
    if row is None:
        return None
    role = _role(row)
    verdict = DalioVerdict(
        rating=_VERDICT_BY_ROLE[role],
        portfolio_role=role,
        thesis_bullets=[DEMO_NOTE, f"Fabricated Dalio verdict for {row['ticker']} — not a real analysis."],
        top_risks=[DEMO_NOTE],
        metrics_to_monitor=["Fed net liquidity", "real policy rate", "broad dollar index"],
        invalidation_triggers=[DEMO_NOTE],
        evidence_ids=["demo-1"],
    )
    blind = DalioBlindPassOutputV1(
        debt_cycle=DebtCycleAssessment(
            short_term_phase="late_expansion", long_term_phase="late_leveraging", summary=DEMO_NOTE,
            evidence_ids=["demo-1"],
        ),
        quadrant_fit=QuadrantFit(favoured_environments=_ENVS_BY_ROLE[role], summary=DEMO_NOTE, evidence_ids=["demo-1"]),
        currency_risk=_section(),
        country_risk=_section(),
        internal_external_order=_section(),
        portfolio_role_and_diversification=_section(),
        verdict=verdict,
    )
    reconciliation = DalioReconciliationOutputV1(
        verdict=verdict, reconciliation_narrative=DEMO_NOTE, changed_from_blind=False, evidence_ids=["demo-1"]
    )
    return EquityAnalysisRunOut(
        id=_other_id("dalio-run", row["ticker"]),
        holding_id=row["id"],
        status="COMPLETED",
        schema_version="dalio_v1",
        blind_prompt_version="demo",
        reconciliation_prompt_version="demo",
        evidence_packet_version="demo",
        provider="demo",
        model_name="demo-fixture",
        started_at=_NOW - timedelta(hours=3),
        blind_completed_at=_NOW - timedelta(hours=2, minutes=30),
        completed_at=_NOW - timedelta(hours=2),
        error_message=None,
        evidence_unavailable_reasons=[],
        blind_pass=blind,
        blind_pass_citation_warnings=[],
        reconciliation=reconciliation,
        reconciliation_citation_warnings=[],
        price_target_low=row["bear"],
        price_target_high=row["bull"],
        price_target_currency="USD",
        evidence_items=[
            EvidenceItemOut(id="demo-1", category="fabricated", label="Demo evidence", content=DEMO_NOTE, citation=None)
        ],
        user_notes_snapshot=None,
        engine="cloud",
        queued_at=None,
        claimed_by=None,
        attempts=1,
        persona="dalio",
    )


def _agreement(buffett: str, dalio: str) -> str:
    b, d = VERDICT_SCORE[buffett], VERDICT_SCORE[dalio]
    if b == d:
        return "agree"
    if b * d < 0 or abs(b - d) >= 2:
        return "disagree"
    return "partly_agree"


def demo_side_by_side(holding_id: uuid.UUID) -> SideBySideOut | None:
    row = _ROWS_BY_ID.get(holding_id)
    if row is None:
        return None
    buffett = demo_analysis_run(holding_id)
    dalio = demo_dalio_run(holding_id)
    role = _role(row)
    d_verdict = _VERDICT_BY_ROLE[role]
    agreement = _agreement(row["verdict"], d_verdict)
    return SideBySideOut(
        holding_id=holding_id,
        buffett=buffett,
        dalio=dalio,
        comparison=ComparisonOut(
            agreement=agreement,
            headline=f"Demo: Buffett/Munger {row['verdict']}, Dalio {d_verdict}.",
            buffett_verdict=row["verdict"],
            dalio_verdict=d_verdict,
            dalio_role=role,
            buffett_moat=row["moat"],
            verdict_gap=VERDICT_SCORE[d_verdict] - VERDICT_SCORE[row["verdict"]],
            points=[DEMO_NOTE, f"Portfolio role (Dalio): {_ROLE_LABELS[role].lower()}."],
            buffett_analyzed_at=buffett.completed_at if buffett else None,
            dalio_analyzed_at=dalio.completed_at if dalio else None,
        ),
        synthesis=None,
        synthesis_enabled=False,
        dalio_verdict_basis=DALIO_VERDICT_BASIS,
    )


def _beta(value: str | None, t: str | None, n: int = 36) -> BetaOut:
    if value is None:
        return BetaOut(beta=None, t_stat=None, significant=False, n_months=12, reason="insufficient history (demo)")
    return BetaOut(beta=Decimal(value), t_stat=Decimal(t), significant=abs(Decimal(t)) >= 2, n_months=n, reason=None)


def demo_all_weather() -> AllWeatherOut:
    positions = []
    for i, row in enumerate(_ROWS):
        role = _role(row)
        positions.append(
            AllWeatherPositionOut(
                holding_id=row["id"], ticker=row["ticker"], name=row["name"], instrument_type="stock",
                trading_currency="USD", weight_pct=row["weight_pct"], value_nok=row["value_nok"],
                portfolio_role=role, dalio_verdict=_VERDICT_BY_ROLE[role],
                dalio_analyzed_at=_NOW - timedelta(hours=2), favoured_environments=_ENVS_BY_ROLE[role],
                inflation=_beta("1.8" if role == "inflation_hedge" else "-0.6", "2.4" if role == "inflation_hedge" else "-0.9"),
                growth=_beta("2.1" if role == "growth_engine" else "0.4", "2.6" if role == "growth_engine" else "0.5"),
                rates_us=_beta("-3.2" if role == "growth_engine" else "-1.1", "-2.2" if role == "growth_engine" else "-1.0"),
                rates_no=_beta(None if i % 3 == 0 else "-0.8", None if i % 3 == 0 else "-0.7"),
                tilt=f"{DEMO_NOTE}",
            )
        )
    by_role: dict[str, list] = {}
    for p in positions:
        by_role.setdefault(p.portfolio_role or "not_analyzed", []).append(p)
    envs = ("rising_growth", "falling_growth", "rising_inflation", "falling_inflation")
    env_labels = {"rising_growth": "Rising growth", "falling_growth": "Falling growth",
                  "rising_inflation": "Rising inflation", "falling_inflation": "Falling inflation"}
    judged = [
        WeightSliceOut(
            key=e, label=env_labels[e],
            weight_pct=sum((p.weight_pct for p in positions if e in p.favoured_environments), Decimal(0)),
            count=sum(1 for p in positions if e in p.favoured_environments),
        )
        for e in envs
    ]
    return AllWeatherOut(
        as_of=_NOW, total_value_nok=sum((r["value_nok"] for r in _ROWS), Decimal(0)), regime="baseline",
        positions=positions,
        by_role=[
            WeightSliceOut(key=k, label=_ROLE_LABELS.get(k, k), weight_pct=sum((p.weight_pct for p in v), Decimal(0)),
                           count=len(v))
            for k, v in by_role.items()
        ],
        by_judged_environment=judged,
        by_measured_environment=[
            WeightSliceOut(key=s.key, label=s.label, weight_pct=(s.weight_pct / 2).quantize(Decimal("0.01")), count=(s.count + 1) // 2)
            for s in judged
        ],
        by_currency=[WeightSliceOut(key="USD", label="USD", weight_pct=Decimal(100), count=len(positions))],
        by_country=[],
        country_coverage_pct=Decimal(0),
        rate_sensitivity=[],
        clusters=[],
        notes=[DEMO_NOTE],
    )


def demo_cycle_fit_board() -> CycleFitBoardOut:
    rows = []
    counts: dict[str, int] = {}
    for row in _ROWS:
        role = _role(row)
        verdict = _VERDICT_BY_ROLE[role]
        agreement = _agreement(row["verdict"], verdict)
        counts[agreement] = counts.get(agreement, 0) + 1
        rows.append(
            CycleFitRowOut(
                holding_id=row["id"], ticker=row["ticker"], name=row["name"], instrument_type="stock",
                weight_pct=row["weight_pct"], dalio_verdict=verdict, portfolio_role=role,
                dalio_analyzed_at=_NOW - timedelta(hours=2), dalio_stale=False, buffett_verdict=row["verdict"],
                buffett_moat=row["moat"], buffett_analyzed_at=_NOW - timedelta(hours=1), agreement=agreement,
            )
        )
    rows.sort(key=lambda r: (-VERDICT_SCORE[r.dalio_verdict or "Hold"], -(r.weight_pct or 0)))
    return CycleFitBoardOut(as_of=_NOW, rows=rows, dalio_analyzed_count=len(rows), agreement_counts=counts)


def demo_dalio_macro() -> DalioMacroOut:
    today = _NOW.date()
    return DalioMacroOut(
        series_version="demo",
        series=[
            DalioSeriesOut(
                key="us_broad_dollar_index", label="Broad US dollar index (demo)", group="fx", display_unit="index",
                frequency="daily", value=Decimal("120.00"), observed_on=today, change_12m=Decimal("-3.10"),
                stale=False, description=DEMO_NOTE, source_series_id="DEMO", source_url="", last_error=None,
            )
        ],
        derived=[
            DalioDerivedOut(
                key="us_fed_net_liquidity", label="Fed net liquidity (demo)", unit="USD bn", value=Decimal("5800.00"),
                observed_on=today, value_12m_ago=Decimal("6000.00"), change_12m=Decimal("-200.00"),
                formula=DEMO_NOTE, reason=None, description=DEMO_NOTE,
            )
        ],
        countries=[
            CountryRiskOut(
                country="USA", name="United States (demo)", currency="USD", sdr_basket_currency=True,
                ssi_score=Decimal("55.0"), ssi_band="High stress", ssi_components={"debt_trajectory": Decimal(85)},
                ssi_missing=[], data_quality="high",
                figures=[CountryFigureOut(label=DEMO_NOTE, value=Decimal(100), data_year=today.year - 1, note="")],
                fetched_at=_NOW,
            )
        ],
        gold_demand=GoldDemandOut(
            as_of="demo", quarters_behind=0, last_four_quarters=[("Q1 demo", Decimal(100))],
            last_four_total=Decimal(100), avg_2015_2021=Decimal(100), avg_2022_2024=Decimal(100), source=DEMO_NOTE,
        ),
    )
