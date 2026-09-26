"""Sprint 11 — deterministic "what changed since the latest analysis"
checks. Every reason is a fact, not a verdict (CLAUDE.md Rule 1: no LLM
involved, and no check here says whether a change is good or bad — that
judgement is the tripwires/status classification's job, or Faiz's own).

The two thresholds below are named constants in this one place so they're
easy to tune later, per the sprint spec.
"""
from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timezone
from decimal import Decimal

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models.analysis import EquityAnalysisRun, EquityHoldingNote
from app.models.document import Document
from app.models.financial_line_item import FinancialLineItem
from app.models.holding import Holding
from app.services.thesis.prices import (
    convert_price,
    latest_stored_price,
    stored_price_at_or_before,
)

STALE_ANALYSIS_AFTER_DAYS = 180
BIG_PRICE_MOVE_PCT = Decimal("0.20")


@dataclass
class ChangeReason:
    key: str
    text: str


def _aware(dt: datetime) -> datetime:
    return dt if dt.tzinfo is not None else dt.replace(tzinfo=timezone.utc)


def changes_since_run(
    db: Session, holding: Holding, run: EquityAnalysisRun, *, now: datetime | None = None
) -> list[ChangeReason]:
    now = now or datetime.now(timezone.utc)
    started_at = _aware(run.started_at)
    reasons: list[ChangeReason] = []

    age_days = (now - started_at).days
    if age_days >= STALE_ANALYSIS_AFTER_DAYS:
        reasons.append(
            ChangeReason(
                "stale_analysis",
                f"Latest analysis is {age_days} days old (≥ {STALE_ANALYSIS_AFTER_DAYS})",
            )
        )

    new_facts = (
        db.scalar(
            select(func.count(FinancialLineItem.id)).where(
                FinancialLineItem.holding_id == holding.id,
                FinancialLineItem.created_at > run.started_at,
            )
        )
        or 0
    )
    if new_facts:
        reasons.append(
            ChangeReason("new_figures", f"{new_facts} new financial figure(s) stored since the analysis")
        )

    new_docs = (
        db.scalar(
            select(func.count(Document.id)).where(
                Document.holding_id == holding.id, Document.uploaded_at > run.started_at
            )
        )
        or 0
    )
    if new_docs:
        reasons.append(
            ChangeReason("new_documents", f"{new_docs} new document(s) uploaded since the analysis")
        )

    note = db.scalar(select(EquityHoldingNote).where(EquityHoldingNote.holding_id == holding.id))
    if (
        note is not None
        and _aware(note.updated_at) > started_at
        and (run.user_notes_snapshot or "") != note.content
    ):
        reasons.append(ChangeReason("notes_changed", "Your notes have changed since this run's reconciliation pass"))

    analysis_price = stored_price_at_or_before(db, holding.id, started_at)
    current_price = latest_stored_price(db, holding.id)
    if analysis_price is not None and current_price is not None and analysis_price.price > 0:
        current_in_analysis_ccy = (
            current_price.price
            if current_price.currency == analysis_price.currency
            else convert_price(db, current_price, analysis_price.currency)
        )
        if current_in_analysis_ccy is not None:
            move = (current_in_analysis_ccy - analysis_price.price) / analysis_price.price
            if abs(move) >= BIG_PRICE_MOVE_PCT:
                direction = "up" if move > 0 else "down"
                reasons.append(
                    ChangeReason(
                        "big_price_move",
                        f"Price is {direction} {abs(move) * 100:.0f}% since the analysis "
                        f"(≥ {int(BIG_PRICE_MOVE_PCT * 100)}%)",
                    )
                )

        if run.price_target_low is not None and run.price_target_high is not None:
            target_currency = run.price_target_currency or analysis_price.currency
            current_in_target_ccy = (
                current_price.price
                if current_price.currency == target_currency
                else convert_price(db, current_price, target_currency)
            )
            if current_in_target_ccy is not None:
                low = min(run.price_target_low, run.price_target_high)
                high = max(run.price_target_low, run.price_target_high)
                if current_in_target_ccy < low:
                    reasons.append(
                        ChangeReason(
                            "outside_dcf_range",
                            f"Price ({target_currency} {current_in_target_ccy:.2f}) is below the run's "
                            f"bear value ({target_currency} {low:.2f})",
                        )
                    )
                elif current_in_target_ccy > high:
                    reasons.append(
                        ChangeReason(
                            "outside_dcf_range",
                            f"Price ({target_currency} {current_in_target_ccy:.2f}) is above the run's "
                            f"bull value ({target_currency} {high:.2f})",
                        )
                    )
            # else: FX unavailable — this check is skipped gracefully, per spec.

    return reasons
