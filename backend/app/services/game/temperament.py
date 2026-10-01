"""Temperament meter (game mode G6): pure, line-by-line rules.

The meter reads only what Faiz logged (decision journal) and what the stored
portfolio snapshots show. No database, no network, no LLM here: every input
is a plain dataclass filled in by app/services/game/state.py, and every
result is a list of events, each with the date, the holding and one plain
sentence saying which rule it met. The needle is just "restoring events as a
share of all judged events", so it can always be recomputed by hand.

What it deliberately does not do:
- It never claims to detect FOMO or emotion; it can only see what was logged
  or what a snapshot diff shows.
- It never rewards trading. The only restores are the things Buffett rewards:
  keeping a position through a fall, acting once a tripwire has fired, and
  going back to check a past decision.
- Trims are never called a panic sell (trimming an oversized position can be
  prudent), and a sell after a "Hold" verdict is not judged at all.
- Informational only. Nothing here blocks, warns about or suggests a trade.
"""
from __future__ import annotations

import uuid
from dataclasses import dataclass, field
from datetime import date, datetime, timedelta, timezone
from decimal import Decimal

from app.domain.game_mapping.value_types import GameMapping

HUNDRED = Decimal(100)
TRADE_ACTIONS = frozenset({"buy", "add", "trim", "sell"})
BUYING = frozenset({"buy", "add"})
SELLING = frozenset({"trim", "sell"})
NEGATIVE_VERDICTS = frozenset({"Sell", "Avoid"})
POSITIVE_VERDICTS = frozenset({"Strong Buy", "Buy"})


@dataclass
class DecisionFact:
    """One decision-journal entry, reduced to what the rules read."""

    entry_id: uuid.UUID | None
    holding_id: uuid.UUID | None
    ticker: str
    name: str
    action: str
    decided_on: date
    verdict_at_decision: str | None = None
    has_invalidation: bool = False
    review_6m_written: bool = False
    review_12m_written: bool = False


@dataclass
class PositionStep:
    """One holding seen in two consecutive snapshots of the same account."""

    holding_id: uuid.UUID
    name: str
    from_at: datetime
    to_at: datetime
    quantity_before: Decimal | None
    quantity_after: Decimal | None
    price_before: Decimal | None
    price_after: Decimal | None
    """Both prices are in the security's own currency; `same_currency` says
    whether they can be compared at all."""
    same_currency: bool = True


@dataclass
class TurnoverFact:
    """What changed between the two latest snapshots of one account."""

    account_name: str
    from_at: datetime
    to_at: datetime
    positions_before: int
    positions_after: int
    added: int
    removed: int
    resized: int


@dataclass
class TemperamentInputs:
    decisions: list[DecisionFact] = field(default_factory=list)
    # holding_id -> when each of its tripwires is on record as having fired.
    tripwire_fired_at: dict[uuid.UUID, list[datetime]] = field(default_factory=dict)
    steps: list[PositionStep] = field(default_factory=list)
    turnover: list[TurnoverFact] = field(default_factory=list)


@dataclass
class TemperamentEvent:
    kind: str  # "drain" | "restore"
    rule: str
    on: date
    holding_name: str
    holding_id: uuid.UUID | None
    explanation: str
    source: str  # "journal" | "snapshots"
    entry_id: uuid.UUID | None = None


@dataclass
class TemperamentResult:
    level: str  # composed / steady / restless / rash / unsurveyed
    needle_pct: Decimal | None
    low_confidence: bool
    decisions_logged: int
    snapshot_comparisons: int
    drains: int
    restores: int
    window_days: int
    summary: str
    events: list[TemperamentEvent]
    turnover: list[TurnoverFact]


def _aware(value: datetime) -> datetime:
    return value if value.tzinfo is not None else value.replace(tzinfo=timezone.utc)


def _tripwire_fired_by(
    holding_id: uuid.UUID | None, day: date, fired: dict[uuid.UUID, list[datetime]]
) -> bool:
    if holding_id is None:
        return False
    return any(_aware(f).date() <= day for f in fired.get(holding_id, []))


def _pct(value: Decimal) -> str:
    return f"{(value * HUNDRED).quantize(Decimal('0.1'))}%"


# --- Journal rules -------------------------------------------------------


def decision_events(
    d: DecisionFact, fired: dict[uuid.UUID, list[datetime]], *, today: date
) -> list[TemperamentEvent]:
    """Events from one journal entry (churn is judged across entries, below)."""
    events: list[TemperamentEvent] = []

    def add(kind: str, rule: str, text: str, on: date | None = None) -> None:
        events.append(
            TemperamentEvent(
                kind=kind, rule=rule, on=on or d.decided_on, holding_name=d.name, holding_id=d.holding_id,
                explanation=text, source="journal", entry_id=d.entry_id,
            )
        )

    verdict = d.verdict_at_decision
    if d.action in BUYING and verdict in NEGATIVE_VERDICTS:
        add("drain", "bought_against_verdict", f"{d.action.capitalize()} while the latest analysis said {verdict}.")
    if d.action in BUYING and not d.has_invalidation:
        add("drain", "no_invalidation", f"{d.action.capitalize()} logged without writing what would prove it wrong.")
    tripwire_fired = _tripwire_fired_by(d.holding_id, d.decided_on, fired)
    if d.action == "sell" and verdict in POSITIVE_VERDICTS and not tripwire_fired:
        add(
            "drain", "sold_intact_thesis",
            f"Sold while the latest analysis said {verdict} and no tripwire had fired.",
        )
    if d.action in SELLING and tripwire_fired:
        add("restore", "acted_on_tripwire", f"{d.action.capitalize()} after a tripwire on this holding had fired.")
    days = (today - d.decided_on).days
    if days >= 182 and d.review_6m_written:
        add("restore", "review_6m_done", "Went back and wrote the 6-month review of this decision.",
            on=d.decided_on + timedelta(days=182))
    if days >= 365 and d.review_12m_written:
        add("restore", "review_12m_done", "Went back and wrote the 12-month review of this decision.",
            on=d.decided_on + timedelta(days=365))
    return events


def churn_events(decisions: list[DecisionFact], mapping: GameMapping) -> list[TemperamentEvent]:
    """One drain per burst of `churn_min_actions` trades on a holding inside
    `churn_window_days`. A burst is counted once, then the search restarts
    after it, so five trades in a month is one churn line, not three."""
    by_holding: dict[str, list[DecisionFact]] = {}
    for d in decisions:
        if d.action in TRADE_ACTIONS:
            key = str(d.holding_id) if d.holding_id is not None else f"ticker:{d.ticker}"
            by_holding.setdefault(key, []).append(d)
    events: list[TemperamentEvent] = []
    window = timedelta(days=mapping.churn_window_days)
    for trades in by_holding.values():
        trades.sort(key=lambda d: d.decided_on)
        i = 0
        while i < len(trades):
            j = i
            while j + 1 < len(trades) and trades[j + 1].decided_on - trades[i].decided_on <= window:
                j += 1
            count = j - i + 1
            if count >= mapping.churn_min_actions:
                last = trades[j]
                events.append(
                    TemperamentEvent(
                        kind="drain", rule="churn", on=last.decided_on, holding_name=last.name,
                        holding_id=last.holding_id, source="journal", entry_id=last.entry_id,
                        explanation=(
                            f"{count} trades on this holding within {mapping.churn_window_days} days "
                            f"({trades[i].decided_on.isoformat()} to {last.decided_on.isoformat()})."
                        ),
                    )
                )
                i = j + 1
            else:
                i += 1
    return events


# --- Snapshot rule --------------------------------------------------------


def held_through_drop(
    step: PositionStep, fired: dict[uuid.UUID, list[datetime]], mapping: GameMapping
) -> TemperamentEvent | None:
    """Kept the position (quantity not reduced) while its price fell by at
    least `held_drop_min_fraction`, with no tripwire fired by then. Holding on
    after a tripwire fired is not rewarded here (nor punished)."""
    if not step.same_currency or step.price_before is None or step.price_after is None:
        return None
    if step.price_before <= 0 or step.quantity_before is None or step.quantity_after is None:
        return None
    if step.quantity_after < step.quantity_before:
        return None
    change = step.price_after / step.price_before - 1
    if change > -mapping.held_drop_min_fraction:
        return None
    to_day = _aware(step.to_at).date()
    if _tripwire_fired_by(step.holding_id, to_day, fired):
        return None
    return TemperamentEvent(
        kind="restore", rule="held_through_drop", on=to_day, holding_name=step.name,
        holding_id=step.holding_id, source="snapshots",
        explanation=(
            f"Kept the position while the price fell {_pct(-change)} between snapshots "
            f"({_aware(step.from_at).date().isoformat()} to {to_day.isoformat()}), with no tripwire fired."
        ),
    )


def turnover_pct(t: TurnoverFact) -> Decimal | None:
    """Changed positions (added + removed + resized) as a share of every
    position seen in either snapshot, percent. None when both are empty."""
    seen = t.positions_before + t.added
    if seen <= 0:
        return None
    return (Decimal(t.added + t.removed + t.resized) / Decimal(seen) * HUNDRED).quantize(Decimal("0.1"))


# --- The meter ------------------------------------------------------------


def level_for(needle: Decimal, mapping: GameMapping) -> str:
    if needle >= mapping.composed_min_pct:
        return "composed"
    if needle >= mapping.steady_min_pct:
        return "steady"
    if needle >= mapping.restless_min_pct:
        return "restless"
    return "rash"


def temperament(inputs: TemperamentInputs, mapping: GameMapping, *, now: datetime) -> TemperamentResult:
    today = _aware(now).date()
    start = today - timedelta(days=mapping.temperament_window_days)
    decisions = [d for d in inputs.decisions if start <= d.decided_on <= today]
    steps = [s for s in inputs.steps if start <= _aware(s.to_at).date() <= today]

    # Rules run over every decision, then events are kept by their own date:
    # a 6-month review that fell due inside the window counts even when the
    # decision itself is older than the window.
    events: list[TemperamentEvent] = []
    for d in inputs.decisions:
        events.extend(decision_events(d, inputs.tripwire_fired_at, today=today))
    events.extend(churn_events(inputs.decisions, mapping))
    for s in steps:
        found = held_through_drop(s, inputs.tripwire_fired_at, mapping)
        if found is not None:
            events.append(found)
    events = [e for e in events if start <= e.on <= today]
    events.sort(key=lambda e: (e.on, e.holding_name), reverse=True)

    drains = sum(1 for e in events if e.kind == "drain")
    restores = sum(1 for e in events if e.kind == "restore")
    low_confidence = len(decisions) < mapping.temperament_min_decisions
    judged = drains + restores
    if judged == 0:
        needle = None
        level = "unsurveyed"
        if decisions or steps:
            summary = (
                f"{len(decisions)} logged decision(s) and {len(steps)} snapshot comparison(s) in the last "
                f"{mapping.temperament_window_days} days; none met a temperament rule, so there is nothing to judge."
            )
        else:
            summary = (
                f"No logged decisions or snapshot comparisons in the last {mapping.temperament_window_days} days. "
                "The meter fills in as you use the decision journal."
            )
    else:
        needle = (Decimal(restores) / Decimal(judged) * HUNDRED).quantize(Decimal("0.1"))
        level = level_for(needle, mapping)
        summary = (
            f"{restores} of {judged} judged event(s) restored the meter, based on {len(decisions)} logged "
            f"decision(s) and {len(steps)} snapshot comparison(s) in the last {mapping.temperament_window_days} days."
        )
    if low_confidence:
        summary += f" Fewer than {mapping.temperament_min_decisions} logged decisions: a low-confidence reading."
    return TemperamentResult(
        level=level,
        needle_pct=needle,
        low_confidence=low_confidence,
        decisions_logged=len(decisions),
        snapshot_comparisons=len(steps),
        drains=drains,
        restores=restores,
        window_days=mapping.temperament_window_days,
        summary=summary,
        events=events,
        turnover=list(inputs.turnover),
    )
