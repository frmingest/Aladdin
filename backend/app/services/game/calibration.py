"""Calibration ledger (game mode C2 "hit rate", 2026-10-14).

Two counts, both gated and never a score:

1. Your calls: decisions with a confidence (1 to 5) and a 6- or 12-month
   price outcome, counted by whether the price moved the way the action
   expected (buy/add: up; sell/trim/pass: down). A hold has no direction and
   is left out. The longest horizon that has an outcome is used, once per
   decision.
2. The Oracle's range: analyst runs with a stored bear-to-bull price range,
   counted by whether the price 6 or 12 months after the run was below,
   inside or above that range.

Pure functions in the first half (no database, provider, model or clock);
the second half only gathers stored rows. CLAUDE.md Rule 1: all counting is
code. Nothing here changes a verdict, a tower or any other page.

Limits (domain/game_mapping/calibration_v1.py): nothing is a ratio before
`min_n`; a band needs `min_band_n`; the count always goes with the ratio.
"""
from __future__ import annotations

import uuid
from dataclasses import dataclass, field
from datetime import date, datetime, timedelta, timezone
from decimal import Decimal

from app.domain.game_mapping.calibration_v1 import CalibrationRules
from app.services.journal import BEARISH, BULLISH

# How far from the horizon date a stored price may be and still count as "the
# price then" for an analyst run.
RUN_PRICE_TOLERANCE_DAYS = 45


@dataclass(frozen=True)
class CallInput:
    entry_id: uuid.UUID
    action: str
    confidence: int | None
    return_pct: Decimal | None
    horizon_months: int | None


@dataclass(frozen=True)
class RunInput:
    run_id: uuid.UUID
    low: Decimal | None
    high: Decimal | None
    price: Decimal | None
    horizon_months: int | None


@dataclass
class Tally:
    n: int = 0
    as_expected: int | None = None
    against: int | None = None
    flat: int | None = None


@dataclass
class BandResult:
    confidence: int
    n: int
    shown: bool
    as_expected: int | None = None
    against: int | None = None
    flat: int | None = None


@dataclass
class CallsResult:
    n: int
    is_open: bool
    as_expected: int | None
    against: int | None
    flat: int | None
    bands: list[BandResult] = field(default_factory=list)
    waiting: int = 0
    """Directional decisions with a confidence but no 6- or 12-month outcome yet."""
    left_out: int = 0
    """Decisions with no confidence or no direction (a hold): not counted."""


@dataclass
class OracleResult:
    n: int
    is_open: bool
    inside: int | None
    below: int | None
    above: int | None
    waiting: int = 0
    """Runs with a range that are too young for a 6-month price."""


def _direction(action: str) -> int:
    if action in BULLISH:
        return 1
    if action in BEARISH:
        return -1
    return 0


def _outcome(direction: int, return_pct: Decimal) -> str:
    if return_pct == 0:
        return "flat"
    return "as_expected" if (return_pct > 0) == (direction > 0) else "against"


def build_calls(calls: list[CallInput], rules: CalibrationRules) -> CallsResult:
    counted: list[tuple[int, str]] = []
    waiting = 0
    left_out = 0
    for c in calls:
        direction = _direction(c.action)
        if c.confidence is None or direction == 0:
            left_out += 1
            continue
        if c.return_pct is None:
            waiting += 1
            continue
        counted.append((c.confidence, _outcome(direction, c.return_pct)))

    n = len(counted)
    is_open = n >= rules.min_n

    def tally(rows: list[str]) -> tuple[int, int, int]:
        return rows.count("as_expected"), rows.count("against"), rows.count("flat")

    bands: list[BandResult] = []
    for level in range(1, 6):
        rows = [o for conf, o in counted if conf == level]
        shown = is_open and len(rows) >= rules.min_band_n
        if shown:
            a, b, f = tally(rows)
            bands.append(BandResult(level, len(rows), True, a, b, f))
        else:
            bands.append(BandResult(level, len(rows), False))

    if is_open:
        a, b, f = tally([o for _, o in counted])
        return CallsResult(n, True, a, b, f, bands, waiting, left_out)
    return CallsResult(n, False, None, None, None, bands, waiting, left_out)


def build_oracle(runs: list[RunInput], rules: CalibrationRules) -> OracleResult:
    rows: list[str] = []
    waiting = 0
    for r in runs:
        if r.low is None or r.high is None or r.low > r.high:
            continue
        if r.price is None or r.horizon_months is None:
            waiting += 1
            continue
        rows.append("below" if r.price < r.low else "above" if r.price > r.high else "inside")
    n = len(rows)
    if n >= rules.min_n:
        return OracleResult(n, True, rows.count("inside"), rows.count("below"), rows.count("above"), waiting)
    return OracleResult(n, False, None, None, None, waiting)


# --- gathering stored rows (no counting here) ----------------------------------------


def _first_confidence(db, entries) -> dict[uuid.UUID, int | None]:
    from sqlalchemy import select

    from app.models.forecast import Forecast

    ids = [e.id for e in entries]
    first: dict[uuid.UUID, int | None] = {}
    if ids:
        rows = db.scalars(
            select(Forecast)
            .where(Forecast.entry_id.in_(ids), Forecast.source == "user")
            .order_by(Forecast.made_at)
        ).all()
        for row in rows:
            first.setdefault(row.entry_id, row.confidence)
    return {e.id: first.get(e.id, e.confidence) for e in entries}


def gather_calls(db, *, today: date) -> list[CallInput]:
    from sqlalchemy import select

    from app.models.journal import DecisionJournalEntry
    from app.services.journal import outcomes_for

    entries = list(db.scalars(select(DecisionJournalEntry)).all())
    outcomes = outcomes_for(db, entries, today=today)
    confidence = _first_confidence(db, entries)
    out: list[CallInput] = []
    for e in entries:
        o = outcomes[e.id]
        if o.return_12m_pct is not None:
            ret, months = o.return_12m_pct, 12
        elif o.return_6m_pct is not None:
            ret, months = o.return_6m_pct, 6
        else:
            ret, months = None, None
        out.append(CallInput(e.id, e.action, confidence[e.id], ret, months))
    return out


def gather_runs(db, rules: CalibrationRules, *, today: date) -> list[RunInput]:
    from sqlalchemy import select

    from app.models.analysis import EquityAnalysisRun
    from app.models.market import MarketObservation

    runs = db.scalars(
        select(EquityAnalysisRun).where(
            EquityAnalysisRun.price_target_low.is_not(None), EquityAnalysisRun.price_target_high.is_not(None)
        )
    ).all()
    obs_by_holding: dict[uuid.UUID, list] = {}
    holding_ids = {r.holding_id for r in runs}
    if holding_ids:
        for o in db.scalars(
            select(MarketObservation)
            .where(MarketObservation.holding_id.in_(holding_ids))
            .order_by(MarketObservation.observed_at)
        ).all():
            obs_by_holding.setdefault(o.holding_id, []).append(o)

    out: list[RunInput] = []
    for r in runs:
        at = r.completed_at or r.blind_completed_at or r.started_at
        if at is None:
            continue
        if at.tzinfo is None:
            at = at.replace(tzinfo=timezone.utc)
        price, months = None, None
        for m, days in reversed(rules.horizons_days):  # longest first
            target = at.date() + timedelta(days=days)
            if target > today:
                continue
            for o in obs_by_holding.get(r.holding_id, []):
                obs_day = (o.observed_at if o.observed_at.tzinfo else o.observed_at.replace(tzinfo=timezone.utc)).date()
                if obs_day < target:
                    continue
                if (obs_day - target).days <= RUN_PRICE_TOLERANCE_DAYS and (
                    r.price_target_currency is None or o.currency == r.price_target_currency
                ):
                    price, months = o.price, m
                break  # first price on or after the horizon date decides; too far = unknown
            if price is not None:
                break
        out.append(RunInput(r.id, r.price_target_low, r.price_target_high, price, months))
    return out


def get_calibration(db, rules: CalibrationRules, *, today: date | None = None):
    today = today or datetime.now(timezone.utc).date()
    return (
        build_calls(gather_calls(db, today=today), rules),
        build_oracle(gather_runs(db, rules, today=today), rules),
    )
