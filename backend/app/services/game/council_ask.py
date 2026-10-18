"""Council questions (2026-10-18): "call a councillor to the floor".

Pure and deterministic: given the already-computed fortress, one holding, one of four fixed questions
and one of the two advisors, it picks the hand-written answer (app/domain/game_mapping/council_questions_v1.py)
and fills it with numbers computed here from stored fields. No database, no provider, no model, no clock,
no free text from the player, and nothing the player wrote (notes, thesis, journal) is read.

Rules it keeps (CLAUDE.md, docs/game/council-engagement-ideas-2026-10-18.md):
- It reads only values the Fortress already derived from stored data; each answer lists the facts behind it.
- Unknown stays unknown: no stored ratio or stress result gives a "no reading" answer, never a guess.
- Silence is not agreement: an advisor with no rule for the holding says so and says that is not a clean bill.
- No trade wording, no reward, no score.
"""
from __future__ import annotations

import uuid
from decimal import Decimal

from app.domain.game_mapping.council_questions_v1 import (
    COMBINED_WARN_PCT,
    COUNCIL_QUESTIONS_VERSION,
    QUESTIONS,
    TEMPLATES,
    Answer,
)
from app.schemas.game import AdvisorLineOut, CouncilAnswerOut, GameStateOut, TowerOut
from app.services.game import advisors as adv_rules
from app.services.game import rituals as rituals_svc

_TONE_RANK = {"warning": 0, "note": 1, "calm": 2}
_WEAK_WALLS = ("timber", "rotted")
_METHOD = {
    "dcf_bear": "the price falling to the bear-case value",
    "volatility": "a two-standard-deviation price move",
}
_ROUND = Decimal("0.1")


def _pct(value: Decimal | None) -> str:
    return "an unknown share" if value is None else f"{value.quantize(_ROUND)}%"


def _signed_pct(fraction: Decimal) -> str:
    return f"{(fraction * 100).quantize(_ROUND):+}%".replace("+-", "-")


def _say(case: str, advisor: str, **fill: object) -> Answer:
    tpl = TEMPLATES[case][advisor]
    return Answer(tpl.tone, tpl.text.format(**fill))


def _why_here(state: GameStateOut, tower: TowerOut, advisor: str) -> tuple[str, Answer, list[str], list[str]]:
    mine: list[AdvisorLineOut] = [
        line for line in rituals_svc.holding_advisor_lines(state, tower.holding_id).lines if line.advisor == advisor
    ]
    if not mine:
        return "silent", _say("why_silent", advisor, name=tower.name), [], []
    used = mine[:2]
    tone = min((line.tone for line in used), key=lambda t: _TONE_RANK[t])
    facts: list[str] = []
    for line in used:
        for f in line.facts:
            if f not in facts:
                facts.append(f)
    return "read", Answer(tone, " ".join(line.text for line in used)), facts, [line.rule for line in used]


def _edge(tower: TowerOut, advisor: str) -> tuple[str, Answer, list[str]]:
    if tower.structure != "keep" or tower.wall == "not_applicable":
        return "none", _say("edge_no_walls", advisor, name=tower.name), [tower.wall_reason]
    if tower.wall == "unsurveyed":
        return "none", _say("edge_unsurveyed", advisor, name=tower.name), [tower.wall_reason]
    margins = tower.wall_margins
    main = [m for m in margins if m.metric != "interest_coverage"]
    up = next((m for m in main if m.direction == "stronger"), None)
    near = [m for m in margins if m.direction == "weaker" and m.near]
    facts = [tower.wall_reason, *(m.text for m in margins)]
    wall = tower.wall
    if near:
        return "read", _say("edge_slipping", advisor, name=tower.name, wall=wall, nearest=" ".join(m.text for m in near)), facts
    top = tower.wall == "basalt" or (up is None and any(m.direction == "weaker" for m in main))
    gap = up.text if up is not None else "No ratio is stored to measure the way up, so the distance is not known."
    if top:
        return "read", _say("edge_top", advisor, name=tower.name, wall=wall), facts
    if tower.wall in _WEAK_WALLS:
        return "read", _say("edge_weak", advisor, name=tower.name, wall=wall, gap=gap), facts
    return "read", _say("edge_climbing", advisor, name=tower.name, wall=wall, gap=gap), facts


def _storm(state: GameStateOut, tower: TowerOut, advisor: str) -> tuple[str, Answer, list[str]]:
    if tower.siege_exposure == "unsurveyed" or tower.siege_shock_pct is None:
        facts = ["no stress result stored for this holding"]
        return "none", _say("storm_no_reading", advisor, name=tower.name), facts
    how = _METHOD.get(tower.siege_method or "", "the stored stress scenario")
    shock = _signed_pct(tower.siege_shock_pct)
    case = {"sheltered": "storm_sheltered", "exposed": "storm_exposed", "breach_risk": "storm_breach_risk"}[tower.siege_exposure]
    facts = [f"stored stress result: {shock} ({how})", f"exposure class: {tower.siege_exposure.replace('_', ' ')}"]
    if state.siege is not None:
        facts.append(f"weather over the realm: {state.siege.level}")
    return "read", _say(case, advisor, name=tower.name, shock=shock, how=how), facts


def _beside(state: GameStateOut, tower: TowerOut, advisor: str) -> tuple[str, Answer, list[str]]:
    sector = tower.sector or "not stored"
    facts = [f"weight: {_pct(tower.weight_pct)}", f"sector: {sector}"]
    partners = tower.shared_wall_with
    if not partners:
        return "read", _say("beside_alone", advisor, name=tower.name, weight=_pct(tower.weight_pct), sector=sector), facts
    by_name = {t.name: t for t in state.towers}
    weights = [tower.weight_pct, *(by_name[p].weight_pct if p in by_name else None for p in partners)]
    known = all(w is not None for w in weights)
    total = sum((w for w in weights if w is not None), Decimal(0))
    combined = _pct(total) if known else "an unknown share"
    facts.append(f"moves together with: {', '.join(partners)}")
    facts.append(f"weights together: {combined}")
    heavy = known and total >= COMBINED_WARN_PCT
    case = "beside_heavy" if heavy else "beside_together"
    return "read", _say(case, advisor, name=tower.name, partners=" and ".join(partners) if len(partners) < 3 else ", ".join(partners), combined=combined), facts


def answer(state: GameStateOut, holding_id: uuid.UUID, question: str, advisor: str) -> CouncilAnswerOut | None:
    """The advisor's answer, or None when the holding is not in the fortress."""
    if question not in QUESTIONS:
        raise ValueError(f"unknown question {question!r}")
    tower = next((t for t in state.towers if t.holding_id == holding_id), None)
    if tower is None:
        return None
    rules: list[str] = []
    if question == "why_here":
        read, a, facts, rules = _why_here(state, tower, advisor)
    elif question == "edge":
        read, a, facts = _edge(tower, advisor)
    elif question == "storm":
        read, a, facts = _storm(state, tower, advisor)
    else:
        read, a, facts = _beside(state, tower, advisor)
    return CouncilAnswerOut(
        holding_id=tower.holding_id, holding_name=tower.name, question=question, advisor=advisor,  # type: ignore[arg-type]
        read=read, tone=a.tone, text=a.text, facts=facts, rules=rules,  # type: ignore[arg-type]
        questions_version=COUNCIL_QUESTIONS_VERSION, disclaimer=adv_rules.DISCLAIMER,
    )
