"""Sprint 25 rituals (2026-10-04): G17 Council Chamber, G18 Hall of Records,
G20 per-holding advisor lines.

Pure and deterministic over values the Fortress already derived (the game
state, the decision journal with its outcomes, the competence marks). No
provider, no model, no clock of its own, no write. Rules kept:

* No points, streaks or reward for attending the Council or for writing a
  review. An empty agenda is said plainly, never padded.
* The Hall of Records is hindsight, not a score: no hit rate, no ranking,
  and every entry carries the caption that a decision is not its outcome.
* Unknown stays unknown: a missing price, a missing verdict or an unmarked
  sector is shown as unknown, never as fine.
* Nothing here says buy, sell, add or trim.
"""
from __future__ import annotations

import uuid
from datetime import datetime
from decimal import Decimal

from app.domain.game_mapping.rituals_v1 import RitualsRules
from app.schemas.game import (
    CompetenceOut,
    CouncilHoldingOut,
    CouncilItemOut,
    CouncilOut,
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
COUNCIL_DISCLAIMER = (
    "The Council reads stored facts and the rules the Fortress already uses. It is not advice to "
    "trade, attending earns nothing, and an empty agenda means no rule flagged anything, not that all is well."
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


# --- G17 -------------------------------------------------------------------

_TITLES = {
    "tripwire": "A tripwire has fired",
    "thesis_review": "A thesis is flagged for review",
    "review_due": "Written reviews are owed",
    "weak_walls": "Weak walls on a large tower",
    "no_moat": "No moat found on a large tower",
    "stale_analysis": "The analysis is old or missing",
    "outside_circle": "Outside your circle of competence",
    "cash": "The vault figure",
}


def _names(kind: str, holdings: list[CouncilHoldingOut], rules: RitualsRules) -> tuple[list[CouncilHoldingOut], int]:
    ordered = sorted(holdings, key=lambda h: _w(h.weight_pct), reverse=True)
    cap = rules.council_max_names_per_item
    return ordered[:cap], max(len(ordered) - cap, 0)


def build_council(
    state: GameStateOut,
    records: RecordsOut,
    competence: CompetenceOut,
    rules: RitualsRules,
    *,
    now: datetime,
    demo: bool = False,
) -> CouncilOut:
    big = ("great", "medium")
    towers = state.towers
    raw: dict[str, tuple[list[CouncilHoldingOut], str, str, list[str]]] = {}

    def holdings_of(sel) -> list[CouncilHoldingOut]:
        return [CouncilHoldingOut(holding_id=t.holding_id, name=t.name, weight_pct=t.weight_pct) for t in towers if sel(t)]

    h = holdings_of(lambda t: t.thesis == "breached")
    if h:
        raw["tripwire"] = (h, "warning", "A tripwire on the thesis monitor has fired. Open each one and read what it measured.", [])
    h = holdings_of(lambda t: t.thesis == "review")
    if h:
        raw["thesis_review"] = (h, "note", "The thesis monitor flagged these for a fresh look at the original reasons.", [])

    owed: list[CouncilHoldingOut] = []
    seen: set[uuid.UUID | None] = set()
    weights = {t.holding_id: t.weight_pct for t in towers}
    for r in records.records:
        if (r.review_6m == "due" or r.review_12m == "due") and r.holding_id not in seen:
            seen.add(r.holding_id)
            owed.append(CouncilHoldingOut(holding_id=r.holding_id, name=r.company_name, weight_pct=weights.get(r.holding_id)))
    if owed:
        raw["review_due"] = (
            owed, "note",
            f"{records.reviews_due} written review(s) are owed on decisions you logged. Writing them is how a decision gets judged on its reasoning, not its outcome.",
            [],
        )

    h = holdings_of(lambda t: t.size_class in big and t.wall in ("timber", "rotted"))
    if h:
        raw["weak_walls"] = (h, "warning", "Timber or rotted walls (heavy debt or thin cover) on towers that are a large share of the portfolio.", [])
    h = holdings_of(lambda t: t.size_class in big and t.moat == "none")
    if h:
        raw["no_moat"] = (h, "warning", "The analysis found no moat on towers that are a large share of the portfolio.", [])
    h = holdings_of(lambda t: t.structure == "keep" and t.freshness in ("overgrown", "unsurveyed"))
    if h:
        raw["stale_analysis"] = (h, "note", "Analysis older than the stale limit, or never run. Queue a fresh one before relying on these readings.", [])

    status_by_id = {c.holding_id: c.status for c in competence.towers}
    h = holdings_of(lambda t: status_by_id.get(t.holding_id) == "outside")
    if h:
        raw["outside_circle"] = (h, "note", "You marked the sector of these holdings as outside your circle of competence.", [])

    if not towers:
        pass  # an empty portfolio has nothing to review, so no cash item either
    elif state.vault.level == "unsurveyed":
        raw["cash"] = ([], "note", "No cash figure has been entered, so the vault is unknown. Enter it on the Fortress.", [])
    elif state.vault.cash_stale:
        raw["cash"] = ([], "note", "The cash figure is older than the stale limit. Update it so the vault reads true.", [])

    items: list[CouncilItemOut] = []
    for kind in rules.agenda_order:
        if kind not in raw:
            continue
        holdings, tone, text, facts = raw[kind]
        shown, more = _names(kind, holdings, rules)
        items.append(
            CouncilItemOut(kind=kind, tone=tone, title=_TITLES[kind], text=text, holdings=shown, more=more, facts=facts)  # type: ignore[arg-type]
        )

    unknowns: list[str] = []
    if state.siege is None or state.siege.level == "unsurveyed":
        unknowns.append("The weather is unknown: no stored risk reading, so the siege level cannot be judged.")
    if state.temperament is not None and state.temperament.level == "unsurveyed":
        unknowns.append("The temperament is unknown: no logged decisions to read yet.")
    if not competence.sectors or all(s.level is None for s in competence.sectors):
        unknowns.append("No sector is marked in the Circle of Competence, so nothing is judged against it.")
    if not towers:
        unknowns.append("There are no holdings in the stored portfolio.")

    warnings = sum(1 for i in items if i.tone == "warning")
    if not towers:
        summary = "Nothing to review: the stored portfolio is empty."
    elif not items:
        summary = "No rule put anything on the agenda. That says only that nothing met a rule, not that all is well."
    else:
        summary = f"{len(items)} item(s) on the agenda, {warnings} of them warnings. Work down the list in order."
    return CouncilOut(
        rules_version=rules.version, demo=demo, as_of=now, items=items,
        advisors=list(state.advisors.lines) if state.advisors else [], unknowns=unknowns, summary=summary,
        disclaimer=COUNCIL_DISCLAIMER,
    )
