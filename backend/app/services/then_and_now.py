"""B2 "Then and Now": what the analyst believed when a decision was written
versus what it believes now, beside the user's own words.

Read-only and database-only: no provider, no LLM call, no new storage, no
migration. Both sides come from `equity_analysis_runs` rows that already
exist. Rules this keeps:

- **Blind pass only.** The reconciliation pass saw the user's notes, so
  comparing it would let the user's own thesis colour "what the analyst
  thought" (CLAUDE.md Rule 4; design-team review item 6). Both sides read
  `blind_pass_json`.
- **Hindsight-safe "then".** The "then" run is the one in force at
  `decided_on` (`run_in_force`), never today's.
- **Changed lines only.** A line that did not change is counted, not shown.
  No arrows, no praise or blame, no "better/worse": a change is a change.
- **Wording is not meaning.** Risk and trigger lists are free text that the
  model words differently each run, so they are compared as sets of
  normalised lines and, when they differ, shown side by side for the reader
  to judge. The service never claims two differently worded lines mean the
  same or different things.
- **Unknown stays unknown.** No analysis then, or none now, or the same run
  on both sides, each gets its own status instead of an empty comparison.
"""
from __future__ import annotations

import uuid
from dataclasses import dataclass, field
from datetime import datetime
from typing import Literal

from sqlalchemy.orm import Session

from app.models.analysis import EquityAnalysisRun
from app.models.journal import DecisionJournalEntry
from app.services.analysis.latest import latest_runs_by_holding, run_in_force

THEN_AND_NOW_VERSION = "then-and-now-v1"

Status = Literal["compared", "same_run", "no_analysis_then", "no_analysis_now", "no_holding", "demo"]
Kind = Literal["value", "list"]


@dataclass
class Change:
    key: str
    label: str
    kind: Kind
    then_value: str | None = None
    now_value: str | None = None
    then_items: list[str] = field(default_factory=list)
    now_items: list[str] = field(default_factory=list)


@dataclass
class RunStamp:
    run_id: uuid.UUID
    analyzed_at: datetime | None
    model_name: str | None


@dataclass
class ThenAndNow:
    version: str
    status: Status
    then: RunStamp | None = None
    now: RunStamp | None = None
    changes: list[Change] = field(default_factory=list)
    unchanged_count: int = 0
    note: str | None = None


_VALUE_FIELDS = (
    ("verdict", "Verdict"),
    ("moat", "Moat"),
    ("target_range", "Price range from the stored valuation"),
)
_LIST_FIELDS = (
    ("thesis_bullets", "Thesis points"),
    ("top_risks", "Top risks"),
    ("invalidation_triggers", "What would prove it wrong"),
)


def _strings(value: object) -> list[str]:
    if not isinstance(value, list):
        return []
    return [str(v).strip() for v in value if str(v).strip()]


def _normalised(items: list[str]) -> set[str]:
    return {" ".join(i.casefold().split()) for i in items}


def _target_range(run: EquityAnalysisRun) -> str | None:
    low, high = run.price_target_low, run.price_target_high
    if low is None or high is None:
        return None
    currency = f" {run.price_target_currency}" if run.price_target_currency else ""
    return f"{low:.2f} to {high:.2f}{currency}"


def _blind_view(run: EquityAnalysisRun) -> dict[str, str | None | list[str]]:
    """The comparable facts of one run, blind pass only."""
    blind = run.blind_pass_json or {}
    verdict = blind.get("verdict") or {}
    moat = blind.get("moat") or {}
    return {
        "verdict": verdict.get("rating"),
        "moat": moat.get("overall_rating"),
        "target_range": _target_range(run),
        "thesis_bullets": _strings(verdict.get("thesis_bullets")),
        "top_risks": _strings(verdict.get("top_risks")),
        "invalidation_triggers": _strings(verdict.get("invalidation_triggers")),
    }


def _stamp(run: EquityAnalysisRun) -> RunStamp:
    return RunStamp(
        run_id=run.id,
        analyzed_at=run.completed_at or run.blind_completed_at or run.started_at,
        model_name=run.model_name,
    )


def compare_runs(then_run: EquityAnalysisRun, now_run: EquityAnalysisRun) -> tuple[list[Change], int]:
    """Changed lines between two runs, plus how many comparable lines did not change."""
    then_view, now_view = _blind_view(then_run), _blind_view(now_run)
    changes: list[Change] = []
    unchanged = 0
    for key, label in _VALUE_FIELDS:
        before, after = then_view[key], now_view[key]
        if before == after:
            unchanged += 1
            continue
        changes.append(Change(key=key, label=label, kind="value", then_value=before, now_value=after))  # type: ignore[arg-type]
    for key, label in _LIST_FIELDS:
        before_items, after_items = then_view[key], now_view[key]
        if _normalised(before_items) == _normalised(after_items):  # type: ignore[arg-type]
            unchanged += 1
            continue
        changes.append(
            Change(key=key, label=label, kind="list", then_items=before_items, now_items=after_items)  # type: ignore[arg-type]
        )
    return changes, unchanged


def build_then_and_now(db: Session, entry: DecisionJournalEntry) -> ThenAndNow:
    if entry.holding_id is None:
        return ThenAndNow(
            version=THEN_AND_NOW_VERSION,
            status="no_holding",
            note="This holding was removed, so there is no analysis history to compare.",
        )
    then_run = run_in_force(db, entry.holding_id, entry.decided_on)
    now_run = latest_runs_by_holding(db, [entry.holding_id]).get(entry.holding_id)

    if now_run is None:
        return ThenAndNow(
            version=THEN_AND_NOW_VERSION,
            status="no_analysis_now",
            note="No analysis has been run for this holding yet.",
        )
    if then_run is None:
        return ThenAndNow(
            version=THEN_AND_NOW_VERSION,
            status="no_analysis_then",
            now=_stamp(now_run),
            note="No analysis existed on the day you decided, so there is nothing to compare against.",
        )
    if then_run.id == now_run.id:
        return ThenAndNow(
            version=THEN_AND_NOW_VERSION,
            status="same_run",
            then=_stamp(then_run),
            now=_stamp(now_run),
            note="The analysis has not been re-run since you decided, so it still says the same.",
        )
    changes, unchanged = compare_runs(then_run, now_run)
    return ThenAndNow(
        version=THEN_AND_NOW_VERSION,
        status="compared",
        then=_stamp(then_run),
        now=_stamp(now_run),
        changes=changes,
        unchanged_count=unchanged,
        note=None if changes else "Nothing the analysis says has changed since you decided.",
    )
