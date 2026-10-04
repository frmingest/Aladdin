"""G15 The Ravens (Sprint 24, 2026-10-04): a raven lands on a tower when a
new report is captured, carrying what changed.

Deterministic and read-only. A raven is created from stored rows only:

* **figures raven** — the newest fiscal period of a stock holding was
  captured (its `FinancialLineItem` rows were written) within the window. The
  newest period is compared with the one directly before it, measure by
  measure (return on capital, margins, leverage, cover, owner earnings, free
  cash flow), using the app's own `compute_holding_metrics`, so every number
  is the one the holding page shows. A measure is only called better or worse
  when it moved by at least the step in `time_and_filings_v1`.
* **text-only raven** — a Newsweb annual or interim report was captured but
  produced no figures (half-year reports are read as text evidence only, per
  CLAUDE.md Rule 1; an untagged PDF yields nothing). It says so and compares
  nothing.

A raven is information, never a verdict: it says what moved, not what to do.
"Seen" is kept per browser by the raven's stable `id`.
"""
from __future__ import annotations

import uuid
from datetime import datetime, timedelta, timezone
from decimal import ROUND_HALF_UP, Decimal

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.domain.game_mapping.time_and_filings_v1 import (
    RavenMeasure,
    TimeAndFilingsRules,
)
from app.domain.instrument_types import STOCK
from app.domain.sectors import is_financial_sector
from app.models.document import Document
from app.models.financial_line_item import FinancialLineItem
from app.models.holding import Holding
from app.schemas.game import RavenLineOut, RavenOut, RavensOut
from app.services.filings.newsweb_annual_report import (
    ANNUAL_REPORT_DOCUMENT_TYPE,
    INTERIM_REPORT_DOCUMENT_TYPE,
)
from app.services.holding_facts import (
    PeriodFacts,
    facts_by_period,
    latest_period,
    previous_period,
)
from app.services.metrics import (
    compute_holding_metrics,
    mark_not_meaningful_for_financials,
)
from app.services.valuation.board import current_positions

ZERO = Decimal(0)
HUNDRED = Decimal(100)


def _aware(value: datetime) -> datetime:
    return value if value.tzinfo is not None else value.replace(tzinfo=timezone.utc)


def _q(value: Decimal, places: str = "0.1") -> Decimal:
    return value.quantize(Decimal(places), rounding=ROUND_HALF_UP)


def _fmt_value(measure: RavenMeasure, value: Decimal, currency: str | None) -> str:
    if measure.kind == "points":
        return f"{_q(value * HUNDRED)}%"
    if measure.kind == "multiple":
        return f"{_q(value)}x"
    magnitude = abs(value)
    body = f"{_q(value / Decimal(1_000_000))}m" if magnitude >= 1_000_000 else f"{_q(value, '1')}"
    return f"{body} {currency}".strip() if currency else body


def measure_line(
    measure: RavenMeasure,
    previous: Decimal | None,
    current: Decimal | None,
    *,
    previous_period_label: str,
    current_period_label: str,
    currency: str | None,
    currency_changed: bool,
) -> RavenLineOut | None:
    """One compared measure; None when it exists in neither period."""
    if previous is None and current is None:
        return None
    base = {"metric": measure.metric, "label": measure.label, "previous": previous, "current": current}
    if previous is None or current is None:
        missing = previous_period_label if previous is None else current_period_label
        return RavenLineOut(
            **base, direction="unknown", text=f"{measure.label}: could not be computed for {missing}, so no comparison."
        )
    if measure.kind == "relative" and currency_changed:
        return RavenLineOut(
            **base, direction="unknown",
            text=f"{measure.label}: the two periods are reported in different currencies, so they are not compared.",
        )

    if measure.kind == "relative":
        if previous == ZERO:
            return RavenLineOut(
                **base, direction="unknown", text=f"{measure.label}: the earlier figure is zero, so no comparison."
            )
        moved = (current - previous) / abs(previous)
    else:
        moved = current - previous
    step_met = abs(moved) >= measure.min_change
    went_up = current > previous
    if not step_met:
        direction = "steady"
    elif went_up == (measure.direction == "higher_better"):
        direction = "better"
    else:
        direction = "worse"

    before = _fmt_value(measure, previous, currency)
    after = _fmt_value(measure, current, currency)
    if direction == "steady":
        text = f"{measure.label} held steady ({before} to {after})."
    else:
        verb = "rose" if went_up else "fell"
        text = f"{measure.label} {verb} from {before} to {after}."
    return RavenLineOut(**base, direction=direction, text=text)


def compare_periods(
    latest: PeriodFacts,
    previous: PeriodFacts,
    before_previous: PeriodFacts | None,
    rules_v: TimeAndFilingsRules,
    *,
    financial: bool,
) -> list[RavenLineOut]:
    now_result = compute_holding_metrics(latest.facts, latest.currencies, prior_facts=previous.facts)
    then_result = compute_holding_metrics(
        previous.facts, previous.currencies, prior_facts=before_previous.facts if before_previous else None
    )
    if financial:
        mark_not_meaningful_for_financials(now_result)
        mark_not_meaningful_for_financials(then_result)
    currency = latest.currency
    changed = latest.currency is not None and previous.currency is not None and latest.currency != previous.currency
    lines: list[RavenLineOut] = []
    for measure in rules_v.raven_measures:
        line = measure_line(
            measure,
            then_result.computed.get(measure.metric),
            now_result.computed.get(measure.metric),
            previous_period_label=previous.period,
            current_period_label=latest.period,
            currency=currency,
            currency_changed=changed,
        )
        if line is not None:
            lines.append(line)
    return lines


def summarise(lines: list[RavenLineOut], previous_period_label: str) -> tuple[str, int, int]:
    better = sum(1 for line in lines if line.direction == "better")
    worse = sum(1 for line in lines if line.direction == "worse")
    steady = sum(1 for line in lines if line.direction == "steady")
    unknown = sum(1 for line in lines if line.direction == "unknown")
    if not lines:
        return (
            f"Nothing could be compared with {previous_period_label}: the figures that the measures need are missing.",
            0,
            0,
        )
    parts = [f"{better} better", f"{worse} worse", f"{steady} steady"]
    if unknown:
        parts.append(f"{unknown} not comparable")
    return f"Against {previous_period_label}: " + ", ".join(parts) + ".", better, worse


def build_ravens(db: Session, rules_v: TimeAndFilingsRules, *, now: datetime | None = None) -> RavensOut:
    now = _aware(now or datetime.now(timezone.utc))
    window_start = now - timedelta(days=rules_v.raven_window_days)
    owned = {p.holding_id for p in current_positions(db)}
    ravens: list[RavenOut] = []
    notes: list[str] = []

    # Figures ravens: stock holdings with line items captured inside the window.
    recent_holdings = set(
        db.scalars(
            select(FinancialLineItem.holding_id)
            .join(Holding, Holding.id == FinancialLineItem.holding_id)
            .where(FinancialLineItem.created_at >= window_start, Holding.asset_class_raw == STOCK)
            .distinct()
        )
    )
    figure_docs: set[uuid.UUID] = set()
    for holding in sorted(
        db.scalars(select(Holding).where(Holding.id.in_(recent_holdings))) if recent_holdings else [],
        key=lambda h: h.name,
    ):
        periods = facts_by_period(db, holding.id)
        latest = latest_period(periods)
        if latest is None:
            continue
        newest = db.execute(
            select(FinancialLineItem.document_id, FinancialLineItem.created_at)
            .where(FinancialLineItem.holding_id == holding.id, FinancialLineItem.period == latest.period)
            .order_by(FinancialLineItem.created_at.desc())
            .limit(1)
        ).first()
        if newest is None or _aware(newest.created_at) < window_start:
            continue  # the newest period was captured earlier: no raven; older years were a back-fill
        figure_docs.update(
            db.scalars(
                select(FinancialLineItem.document_id)
                .where(FinancialLineItem.holding_id == holding.id, FinancialLineItem.period == latest.period)
                .distinct()
            )
        )
        previous = previous_period(periods, latest.period)
        if previous is None:
            lines: list[RavenLineOut] = []
            summary, better, worse = ("First report on file for this tower: nothing to compare with yet.", 0, 0)
        else:
            before_previous = previous_period(periods, previous.period)
            lines = compare_periods(
                latest, previous, before_previous, rules_v, financial=is_financial_sector(holding.sector)
            )
            summary, better, worse = summarise(lines, previous.period)
        captured = _aware(newest.created_at)
        ravens.append(
            RavenOut(
                id=f"fig:{holding.id}:{latest.period}",
                kind="figures",
                holding_id=holding.id,
                ticker=holding.ticker,
                name=holding.name,
                in_portfolio=holding.id in owned,
                period=latest.period,
                previous_period=previous.period if previous else None,
                captured_at=captured,
                age_days=max((now - captured).days, 0),
                document_id=newest.document_id,
                summary=summary,
                better=better,
                worse=worse,
                lines=lines,
            )
        )

    # Text-only ravens: a captured report that produced no figures.
    docs = db.scalars(
        select(Document)
        .where(
            Document.holding_id.is_not(None),
            Document.type.in_((ANNUAL_REPORT_DOCUMENT_TYPE, INTERIM_REPORT_DOCUMENT_TYPE)),
            Document.uploaded_at >= window_start,
        )
        .order_by(Document.uploaded_at.desc())
    ).all()
    with_items = set(
        db.scalars(
            select(FinancialLineItem.document_id).where(FinancialLineItem.document_id.in_([d.id for d in docs]))
        )
    ) if docs else set()
    holdings = {
        h.id: h for h in db.scalars(select(Holding).where(Holding.id.in_({d.holding_id for d in docs})))
    } if docs else {}
    for doc in docs:
        if doc.id in with_items or doc.id in figure_docs:
            continue
        holding = holdings.get(doc.holding_id)
        if holding is None:
            continue
        kind_word = "half-year or interim" if doc.type == INTERIM_REPORT_DOCUMENT_TYPE else "annual"
        captured = _aware(doc.uploaded_at)
        ravens.append(
            RavenOut(
                id=f"doc:{doc.id}",
                kind="text_only",
                holding_id=holding.id,
                ticker=holding.ticker,
                name=holding.name,
                in_portfolio=holding.id in owned,
                period=doc.reporting_period,
                previous_period=None,
                captured_at=captured,
                age_days=max((now - captured).days, 0),
                document_id=doc.id,
                summary=(
                    f"A new {kind_word} report was captured. No figures were extracted from it "
                    "(it is read as text evidence only), so there is no comparison."
                ),
                better=0,
                worse=0,
                lines=[],
            )
        )

    ravens.sort(key=lambda r: (-r.captured_at.timestamp(), r.name))
    if not ravens:
        notes.append(
            f"No report has been captured in the last {rules_v.raven_window_days} days. "
            "A raven lands when a Newsweb fetch, an ESEF upload or a statement CSV adds a new period."
        )
    notes.append(
        "A raven reports what moved between two stored periods. It is not a verdict and not a reason to trade."
    )
    return RavensOut(
        rules_version=rules_v.version, as_of=now, window_days=rules_v.raven_window_days, ravens=ravens, notes=notes
    )


__all__ = ["build_ravens", "compare_periods", "measure_line", "summarise"]
