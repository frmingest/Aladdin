"""Cycle-fit board (Epic F22, story 22.11): the Dalio counterpart of the
margin-of-safety board — every owned holding with its Dalio verdict and
portfolio role, plus the Buffett/Munger verdict and the deterministic
agreement for side-by-side mode. Reads stored runs only; no LLM, no
network.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone
from decimal import Decimal

from sqlalchemy.orm import Session

from app.domain.analyst_modes import DALIO, DEFAULT_PERSONA
from app.services.analysis.latest import (
    latest_runs_by_holding,
    run_portfolio_role,
    run_ratings,
)
from app.services.analysis.side_by_side import VERDICT_SCORE, compare_runs
from app.services.portfolio_overview import build_overview

STALE_AFTER = timedelta(days=90)


@dataclass
class CycleFitRow:
    holding_id: object
    ticker: str
    name: str
    instrument_type: str
    weight_pct: Decimal | None
    dalio_verdict: str | None
    portfolio_role: str | None
    dalio_analyzed_at: datetime | None
    dalio_stale: bool
    buffett_verdict: str | None
    buffett_moat: str | None
    buffett_analyzed_at: datetime | None
    agreement: str


@dataclass
class CycleFitBoard:
    as_of: datetime | None
    rows: list[CycleFitRow] = field(default_factory=list)
    dalio_analyzed_count: int = 0
    agreement_counts: dict[str, int] = field(default_factory=dict)


def build_cycle_fit_board(db: Session, *, now: datetime | None = None) -> CycleFitBoard:
    now = now or datetime.now(timezone.utc)
    overview = build_overview(db)
    ids = [p.holding_id for p in overview.positions]
    dalio_runs = latest_runs_by_holding(db, ids, persona=DALIO)
    buffett_runs = latest_runs_by_holding(db, ids, persona=DEFAULT_PERSONA)
    board = CycleFitBoard(as_of=overview.as_of)
    for p in overview.positions:
        d = dalio_runs.get(p.holding_id)
        b = buffett_runs.get(p.holding_id)
        d_verdict, _m, d_at = run_ratings(d) if d else (None, None, None)
        b_verdict, b_moat, b_at = run_ratings(b) if b else (None, None, None)
        if d_at is not None and d_at.tzinfo is None:
            d_at = d_at.replace(tzinfo=timezone.utc)
        comparison = compare_runs(b, d)
        board.rows.append(
            CycleFitRow(
                holding_id=p.holding_id,
                ticker=p.ticker,
                name=p.name,
                instrument_type=p.instrument_type,
                weight_pct=p.weight_pct,
                dalio_verdict=d_verdict,
                portfolio_role=run_portfolio_role(d) if d else None,
                dalio_analyzed_at=d_at,
                dalio_stale=bool(d_at and now - d_at > STALE_AFTER),
                buffett_verdict=b_verdict,
                buffett_moat=b_moat,
                buffett_analyzed_at=b_at,
                agreement=comparison.agreement,
            )
        )
        board.agreement_counts[comparison.agreement] = board.agreement_counts.get(comparison.agreement, 0) + 1
    board.dalio_analyzed_count = sum(1 for r in board.rows if r.dalio_verdict)
    # Best Dalio verdict first, then by weight; unanalyzed last.
    board.rows.sort(
        key=lambda r: (
            r.dalio_verdict is None,
            -VERDICT_SCORE.get(r.dalio_verdict or "", -9),
            -(r.weight_pct or Decimal(0)),
        )
    )
    return board
