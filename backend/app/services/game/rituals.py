"""Sprint 25 rituals (2026-10-04): G18 Hall of Records, G20 per-holding advisor lines.

Pure and deterministic over values the Fortress already derived (the game
state, the decision journal with its outcomes). No
provider, no model, no clock of its own, no write. Rules kept:

* No points, streaks or reward for writing a review.
* The Hall of Records is hindsight, not a score: no hit rate, no ranking,
  and every entry carries the caption that a decision is not its outcome.
* Unknown stays unknown: a missing price, a missing verdict or an unmarked
  sector is shown as unknown, never as fine.
* Nothing here says buy, sell, add or trim.
"""
from __future__ import annotations

import uuid
from decimal import Decimal

from app.domain.game_mapping.rituals_v1 import RitualsRules
from app.schemas.game import (
    GameStateOut,
    HoldingAdvisorsOut,
    RecordOut,
    RecordsOut,
)
from app.schemas.journal import JournalEntryOut
from app.services.game import advisors as adv_rules

HINDSIGHT_CAPTION = (
    "A decision is not its outcome. These records show what you wrote, what the price did since "
    "and which reviews are still owed. They are not a score and not a hit rate."
)

ZERO = Decimal(0)


def _w(value: Decimal | None) -> Decimal:
    return value if value is not None else ZERO


# --- G20 -------------------------------------------------------------------


def holding_advisor_lines(state: GameStateOut, holding_id: uuid.UUID) -> HoldingAdvisorsOut:
    """Every matching line about one holding, most urgent first. Fortress-wide
    lines (weather, vault, shantytown) are not about a holding and are left out."""
    found = adv_rules.candidate_lines(
        state.towers, state.diworsification, state.vault, state.siege, state.temperament
    )
    rank = {rule: i for i, rule in enumerate(adv_rules.RULE_ORDER)}
    mine = [line for line in found if line.holding_id == holding_id]
    mine.sort(key=lambda line: (adv_rules._TONE_RANK[line.tone], rank[line.rule]))
    return HoldingAdvisorsOut(
        holding_id=holding_id,
        lines_version=state.advisors.lines_version if state.advisors else "v1",
        lines=mine,
        disclaimer=adv_rules.DISCLAIMER,
    )


# --- G18 -------------------------------------------------------------------


def _review_state(text: str | None, due: bool) -> str:
    if (text or "").strip():
        return "written"
    return "due" if due else "not_due"


def build_records(
    entries: list[JournalEntryOut], state: GameStateOut | None, rules: RitualsRules, *, demo: bool = False
) -> RecordsOut:
    verdict_now: dict[uuid.UUID, str | None] = {}
    if state is not None:
        verdict_now = {t.holding_id: t.verdict_rating for t in state.towers}
    out: list[RecordOut] = []
    for e in sorted(entries, key=lambda e: (e.decided_on, e.created_at), reverse=True):
        o = e.outcome
        out.append(
            RecordOut(
                id=e.id, holding_id=e.holding_id, ticker=e.ticker, company_name=e.company_name, action=e.action,
                decided_on=e.decided_on, days_since=o.days_since, thesis=e.thesis, invalidation=e.invalidation,
                confidence=e.confidence, verdict_then=e.verdict_at_decision,
                verdict_now=verdict_now.get(e.holding_id) if e.holding_id else None,
                price_then=e.price, price_now=o.latest_price, price_now_at=o.latest_price_at, currency=e.currency,
                price_change_pct=o.return_pct,
                price_note=o.note or (None if o.latest_price is not None else "no stored price since the decision"),
                review_6m=_review_state(e.review_6m, o.review_6m_due),  # type: ignore[arg-type]
                review_12m=_review_state(e.review_12m, o.review_12m_due),  # type: ignore[arg-type]
                review_6m_text=e.review_6m, review_12m_text=e.review_12m,
            )
        )
    due = sum(1 for r in out if r.review_6m == "due") + sum(1 for r in out if r.review_12m == "due")
    return RecordsOut(rules_version=rules.version, demo=demo, records=out, reviews_due=due, caption=HINDSIGHT_CAPTION)
