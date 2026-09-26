"""Sprint 11 — tripwire CRUD, the strict-crossing firing rule, and
best-effort regex parsing of a "make a tripwire" suggestion from an
analysis run's invalidation triggers / metrics-to-monitor text.

Firing rule (checked by `evaluate_and_update`, deterministic — CLAUDE.md
Rule 1, never the LLM):
- value strictly crosses the threshold in the configured direction ->
  fires; `fired_at` is set the first time this happens and left alone on
  every later fire (so it always shows *when* it first crossed).
- back on the right side -> `fired_at` and `seen_at` are cleared.
- the value can't be computed (missing input) -> reported as "no data";
  an existing `fired_at` is NOT touched — a tripwire that was firing stays
  firing until it's actually seen back on the right side.
- editing the operator/threshold, or pausing (`active=False`), clears
  `fired_at`/`seen_at` — a firing belongs to the rule that produced it.
"""
from __future__ import annotations

import re
import uuid
from dataclasses import dataclass
from datetime import datetime, timezone
from decimal import Decimal, InvalidOperation

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.holding import Holding
from app.models.thesis import (
    OPERATOR_ABOVE,
    OPERATOR_BELOW,
    TRIPWIRE_OPERATORS,
    ThesisTripwire,
)
from app.services.thesis.metrics_registry import METRICS_BY_KEY, compute_metric_value

UNSET = object()
"""Sentinel for `update_tripwire`'s `label` — None is a valid value (clear
the label), so "not given" needs its own marker."""


@dataclass
class TripwireEvaluation:
    tripwire: ThesisTripwire
    current_value: Decimal | None
    unavailable_reason: str | None
    firing: bool


def _crosses(value: Decimal, operator: str, threshold: Decimal) -> bool:
    return value < threshold if operator == OPERATOR_BELOW else value > threshold


def evaluate_and_update(
    db: Session, tripwire: ThesisTripwire, holding: Holding, *, now: datetime | None = None
) -> TripwireEvaluation:
    """Computes the tripwire's metric now and updates `fired_at`/`seen_at`
    in place (no commit — callers batch it). Does not check `active`;
    callers decide whether a paused tripwire is evaluated at all."""
    now = now or datetime.now(timezone.utc)
    result = compute_metric_value(db, holding, tripwire.metric)

    if result.value is None:
        # "no data": never clears an existing firing.
        return TripwireEvaluation(tripwire, None, result.unavailable_reason, tripwire.fired_at is not None)

    firing_now = _crosses(result.value, tripwire.operator, tripwire.threshold)
    if firing_now and tripwire.fired_at is None:
        tripwire.fired_at = now
        tripwire.updated_at = now
    elif not firing_now and (tripwire.fired_at is not None or tripwire.seen_at is not None):
        tripwire.fired_at = None
        tripwire.seen_at = None
        tripwire.updated_at = now

    return TripwireEvaluation(tripwire, result.value, None, tripwire.fired_at is not None)


def evaluate_holding_tripwires(
    db: Session, holding: Holding, *, now: datetime | None = None
) -> list[TripwireEvaluation]:
    """Every tripwire on this holding, newest-created last. Paused
    (`active=False`) ones are returned unevaluated (never firing — pausing
    already cleared any old firing) rather than skipped, so the caller can
    still list/edit/re-enable them."""
    tripwires = db.scalars(
        select(ThesisTripwire).where(ThesisTripwire.holding_id == holding.id).order_by(ThesisTripwire.created_at)
    ).all()
    evaluations: list[TripwireEvaluation] = []
    dirty = False
    for tripwire in tripwires:
        if not tripwire.active:
            evaluations.append(TripwireEvaluation(tripwire, None, "paused", False))
            continue
        evaluations.append(evaluate_and_update(db, tripwire, holding, now=now))
        dirty = True
    if dirty:
        db.commit()
    return evaluations


def create_tripwire(
    db: Session,
    holding: Holding,
    *,
    metric: str,
    operator: str,
    threshold: Decimal,
    label: str | None = None,
    origin: str | None = None,
    source_run_id: uuid.UUID | None = None,
) -> ThesisTripwire:
    if metric not in METRICS_BY_KEY:
        raise ValueError(f"unknown metric '{metric}' — see GET /thesis/metrics")
    if operator not in TRIPWIRE_OPERATORS:
        raise ValueError(f"operator must be one of {TRIPWIRE_OPERATORS}")
    tripwire = ThesisTripwire(
        holding_id=holding.id,
        metric=metric,
        operator=operator,
        threshold=threshold,
        label=label,
        origin=origin,
        source_run_id=source_run_id,
    )
    db.add(tripwire)
    db.commit()
    db.refresh(tripwire)
    return tripwire


def update_tripwire(
    db: Session,
    tripwire: ThesisTripwire,
    *,
    operator: str | None = None,
    threshold: Decimal | None = None,
    label=UNSET,
    active: bool | None = None,
) -> ThesisTripwire:
    """Any given field replaces the current one; fields left out (the
    default) are untouched. Changing the operator/threshold, or pausing,
    clears `fired_at`/`seen_at` — see module docstring."""
    rule_changed = False

    if operator is not None and operator != tripwire.operator:
        if operator not in TRIPWIRE_OPERATORS:
            raise ValueError(f"operator must be one of {TRIPWIRE_OPERATORS}")
        tripwire.operator = operator
        rule_changed = True

    if threshold is not None and threshold != tripwire.threshold:
        tripwire.threshold = threshold
        rule_changed = True

    if label is not UNSET:
        tripwire.label = label

    if active is not None and active != tripwire.active:
        tripwire.active = active
        if not active:
            rule_changed = True

    if rule_changed:
        tripwire.fired_at = None
        tripwire.seen_at = None

    tripwire.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(tripwire)
    return tripwire


def acknowledge_tripwire(db: Session, tripwire: ThesisTripwire) -> ThesisTripwire:
    if tripwire.fired_at is None:
        raise ValueError("tripwire is not currently firing")
    tripwire.seen_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(tripwire)
    return tripwire


# --- "Make a tripwire" pre-fill: regex only, never an LLM call. ---------

_METRIC_ALIASES: tuple[tuple[str, str], ...] = (
    ("net debt/ebitda", "net_debt_to_ebitda"),
    ("net debt to ebitda", "net_debt_to_ebitda"),
    ("debt/equity", "debt_to_equity"),
    ("debt to equity", "debt_to_equity"),
    ("interest coverage", "interest_coverage"),
    ("gross margin", "gross_margin"),
    ("operating margin", "operating_margin"),
    ("net margin", "net_margin"),
    ("revenue growth", "revenue_growth_yoy"),
    ("free cash flow", "free_cash_flow"),
    ("fcf yield", "fcf_yield"),
    ("fcf", "free_cash_flow"),
    ("owner earnings", "owner_earnings"),
    ("net debt", "net_debt"),
    ("price to earnings", "price_to_earnings"),
    ("p/e", "price_to_earnings"),
    ("price to book", "price_to_book"),
    ("p/b", "price_to_book"),
    ("ev/ebitda", "ev_to_ebitda"),
    ("enterprise value", "ev_to_ebitda"),
    ("roic", "roic"),
    ("roce", "roce"),
    ("roe", "roe"),
    ("share price", "share_price"),
    ("stock price", "share_price"),
)
# Longest phrase first, so "net debt/ebitda" wins over the bare "net debt".
_METRIC_ALIASES = tuple(sorted(_METRIC_ALIASES, key=lambda pair: -len(pair[0])))

_BELOW_WORDS = re.compile(r"\b(below|under|falls?\s+below|drops?\s+below|declines?\s+below)\b", re.IGNORECASE)
_ABOVE_WORDS = re.compile(r"\b(above|over|exceeds?|rises?\s+above|climbs?\s+above|goes?\s+above)\b", re.IGNORECASE)
_NUMBER_RE = re.compile(r"(-?\d+(?:\.\d+)?)\s*(x|%)?", re.IGNORECASE)


@dataclass
class ParsedTripwire:
    metric: str
    operator: str
    threshold: Decimal


def parse_tripwire_from_text(text: str) -> ParsedTripwire | None:
    """Best-effort parse of a sentence like "Net debt/EBITDA rises above
    2.5x" into (metric, operator, threshold) — pure string/regex matching,
    no LLM call. Returns None whenever it can't confidently find a known
    metric, a direction and a number; the user fills the tripwire form
    manually in that case."""
    lowered = text.lower()

    metric = next((key for phrase, key in _METRIC_ALIASES if phrase in lowered), None)
    if metric is None:
        return None

    if _BELOW_WORDS.search(lowered):
        operator = OPERATOR_BELOW
    elif _ABOVE_WORDS.search(lowered):
        operator = OPERATOR_ABOVE
    else:
        return None

    matches = _NUMBER_RE.findall(text)
    if not matches:
        return None
    raw, suffix = matches[-1]
    try:
        value = Decimal(raw)
    except InvalidOperation:
        return None

    is_percent_metric = METRICS_BY_KEY[metric].unit == "pct"
    threshold = value / 100 if is_percent_metric and suffix == "%" else value
    return ParsedTripwire(metric=metric, operator=operator, threshold=threshold)


@dataclass
class TripwireSuggestion:
    text: str
    parsed: ParsedTripwire | None


def suggestions_from_run(run) -> list[TripwireSuggestion]:
    """One suggestion per invalidation-trigger / metric-to-monitor
    sentence on the latest run's blind pass, each with a best-effort
    parse (None when it couldn't be parsed — the caller shows a blank
    "make a tripwire" form for those)."""
    if run is None:
        return []
    blind = run.blind_pass_json or {}
    texts = list(blind.get("invalidation_triggers") or []) + list(blind.get("metrics_to_monitor") or [])
    return [TripwireSuggestion(text=text, parsed=parse_tripwire_from_text(text)) for text in texts]
