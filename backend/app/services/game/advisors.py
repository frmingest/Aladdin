"""The two advisors of game mode (F33, G7b, 2026-10-01).

Pure and deterministic: given the already-computed fortress it picks which
hand-written lines (app/domain/game_mapping/advisor_lines_v1.py) apply. No
database, no provider, no model, no clock. Same input, same lines.

Rules it keeps (docs/game-mode-fortress-2026-10-01.md, CLAUDE.md):
- It only reads values the endpoint already derived from stored data, so an
  advisor can never say something the Ledger cannot back up. Each line
  carries the `facts` that triggered it.
- It never recommends a trade and never rewards one. "Calm" lines are about
  patience and record-keeping, not about doing more.
- Unknown stays unknown: fog, an unsurveyed vault or a low-confidence meter
  produce a "cannot judge" line or nothing, never a confident one.
- Most urgent first: warnings, then notes, then calm. Within a tone the order
  is the order of RULE_ORDER, then largest holding first.
"""
from __future__ import annotations

from decimal import Decimal

from app.domain.game_mapping.advisor_lines_v1 import ADVISOR_LINES_VERSION, TEMPLATES
from app.schemas.game import (
    AdvisorLineOut,
    AdvisorsOut,
    DiworsificationOut,
    SiegeOut,
    TemperamentOut,
    TowerOut,
    VaultOut,
)

DISCLAIMER = (
    "Written for Aladdin in the spirit of a patient owner and a blunt sceptic. These are not "
    "quotations from Warren Buffett or Charlie Munger, and nothing here is advice to trade."
)

# How many lines are shown, and how many per rule, so one rule cannot drown the rest.
MAX_LINES = 6
MAX_PER_RULE = 2

_BIG = ("great", "medium")
_STRONG_WALLS = ("basalt", "granite")
_MOATS = ("wide", "narrow")
_TURNING = ("gathering", "besieged")
_STRAINED = ("restless", "rash")

# Fixed priority inside a tone. Earlier = said first.
RULE_ORDER: tuple[str, ...] = (
    "tripwire_fired",
    "weak_walls_big_tower",
    "no_moat_big_tower",
    "storm_vault_thin",
    "temperament_strained",
    "thesis_review",
    "stale_big_tower",
    "shared_wall",
    "dear_big_tower",
    "shantytown",
    "vault_unknown",
    "cheap_on_strong_walls",
    "storm_vault_ready",
    "temperament_composed",
    "all_quiet",
)
_TONE_RANK = {"warning": 0, "note": 1, "calm": 2}


def _pct(value: Decimal | None) -> str:
    return "an unknown share" if value is None else f"{value:.1f}%"


def _line(
    rule: str,
    *,
    holding: TowerOut | None = None,
    facts: list[str] | None = None,
    **fill: object,
) -> AdvisorLineOut:
    t = TEMPLATES[rule]
    return AdvisorLineOut(
        advisor=t.advisor,
        rule=rule,
        tone=t.tone,
        text=t.text.format(**fill),
        holding_id=holding.holding_id if holding else None,
        holding_name=holding.name if holding else None,
        facts=facts or [],
    )


def _by_weight(towers: list[TowerOut]) -> list[TowerOut]:
    return sorted(towers, key=lambda t: t.weight_pct if t.weight_pct is not None else Decimal(-1), reverse=True)


def candidate_lines(
    towers: list[TowerOut],
    diworsification: DiworsificationOut,
    vault: VaultOut,
    siege: SiegeOut | None,
    temperament: TemperamentOut | None,
) -> list[AdvisorLineOut]:
    """Every line whose rule matches, before the display limit is applied."""
    if not towers:
        return []
    lines: list[AdvisorLineOut] = []
    ordered = _by_weight(towers)

    for t in ordered:
        weight = _pct(t.weight_pct)
        if t.thesis == "breached":
            lines.append(
                _line(
                    "tripwire_fired",
                    holding=t,
                    count=t.tripwires_fired,
                    name=t.name,
                    facts=[f"{t.tripwires_fired} tripwire(s) fired on the thesis monitor"],
                )
            )
        elif t.thesis == "review":
            lines.append(
                _line("thesis_review", holding=t, name=t.name, facts=["the thesis monitor flagged it for review"])
            )
        if t.size_class in _BIG and t.wall in ("timber", "rotted"):
            lines.append(
                _line(
                    "weak_walls_big_tower",
                    holding=t,
                    name=t.name,
                    weight=weight,
                    wall=t.wall,
                    facts=[f"weight {weight}", f"wall: {t.wall}", t.wall_reason],
                )
            )
        if t.size_class in _BIG and t.moat == "none":
            lines.append(
                _line(
                    "no_moat_big_tower",
                    holding=t,
                    name=t.name,
                    weight=weight,
                    facts=[f"weight {weight}", "moat: none found by the analysis"],
                )
            )
        if t.size_class in _BIG and t.freshness == "overgrown" and t.analysis_age_days is not None:
            lines.append(
                _line(
                    "stale_big_tower",
                    holding=t,
                    name=t.name,
                    age=t.analysis_age_days,
                    facts=[f"analysis age {t.analysis_age_days} days", f"weight {weight}"],
                )
            )
        if t.land in ("bargain", "discount") and t.wall in _STRONG_WALLS and t.moat in _MOATS:
            zone = "bear case" if t.land == "bargain" else "base case"
            lines.append(
                _line(
                    "cheap_on_strong_walls",
                    holding=t,
                    name=t.name,
                    zone=zone,
                    facts=[f"land: {t.land}", f"wall: {t.wall}", f"moat: {t.moat}", t.land_reason],
                )
            )
        if t.size_class in _BIG and t.land == "overpriced":
            lines.append(
                _line(
                    "dear_big_tower",
                    holding=t,
                    name=t.name,
                    weight=weight,
                    facts=["land: above the bull case", f"weight {weight}", t.land_reason],
                )
            )

    turning = siege is not None and siege.level in _TURNING
    if turning and siege is not None:
        if vault.level in ("thin", "empty"):
            lines.append(
                _line(
                    "storm_vault_thin",
                    level=vault.level,
                    facts=[f"weather: {siege.level}", f"vault: {vault.level}", *siege.reasons[:2]],
                )
            )
        elif vault.level in ("deep", "stocked"):
            lines.append(
                _line(
                    "storm_vault_ready",
                    level=vault.level,
                    facts=[f"weather: {siege.level}", f"vault: {vault.level}", *siege.reasons[:2]],
                )
            )

    if vault.level == "unsurveyed" or vault.cash_stale:
        reason = "no cash has been entered" if vault.level == "unsurveyed" else "the cash figure is old"
        lines.append(_line("vault_unknown", reason=reason, facts=[f"vault: {vault.level}", f"stale: {vault.cash_stale}"]))

    if diworsification.shantytown != "none":
        lines.append(
            _line(
                "shantytown",
                shacks=diworsification.shack_count,
                facts=[f"{diworsification.shack_count} positions under the tiny-position size", f"{diworsification.position_count} positions in all"],
            )
        )

    if siege is not None:
        for wall in siege.shared_walls[:MAX_PER_RULE]:
            lines.append(
                _line(
                    "shared_wall",
                    names=" and ".join(wall.names),
                    correlation=f"{wall.correlation:.2f}",
                    combined=f"{wall.combined_weight_pct:.1f}%",
                    facts=[f"correlation {wall.correlation:.2f}", f"combined weight {wall.combined_weight_pct:.1f}%"],
                )
            )

    if temperament is not None and not temperament.low_confidence:
        if temperament.level in _STRAINED:
            lines.append(
                _line(
                    "temperament_strained",
                    level=temperament.level,
                    drains=temperament.drains,
                    decisions=temperament.decisions_logged,
                    facts=[f"{temperament.drains} drains, {temperament.restores} restores", temperament.summary],
                )
            )
        elif temperament.level == "composed":
            lines.append(
                _line(
                    "temperament_composed",
                    decisions=temperament.decisions_logged,
                    facts=[f"{temperament.drains} drains, {temperament.restores} restores", temperament.summary],
                )
            )

    # The quiet line is only honest when nothing else is asking for attention.
    if not any(line.tone != "calm" for line in lines) and (siege is None or siege.level == "calm"):
        lines.append(_line("all_quiet", facts=[f"{len(towers)} holdings surveyed", "no tripwire fired"]))
    return lines


def advisors(
    towers: list[TowerOut],
    diworsification: DiworsificationOut,
    vault: VaultOut,
    siege: SiegeOut | None,
    temperament: TemperamentOut | None,
) -> AdvisorsOut:
    """The shown lines (most urgent first) plus how many more matched."""
    found = candidate_lines(towers, diworsification, vault, siege, temperament)
    rank = {rule: i for i, rule in enumerate(RULE_ORDER)}
    found.sort(key=lambda line: (_TONE_RANK[line.tone], rank[line.rule]))  # stable: weight order kept

    shown: list[AdvisorLineOut] = []
    per_rule: dict[str, int] = {}
    for line in found:
        if len(shown) >= MAX_LINES:
            break
        if per_rule.get(line.rule, 0) >= MAX_PER_RULE:
            continue
        per_rule[line.rule] = per_rule.get(line.rule, 0) + 1
        shown.append(line)
    return AdvisorsOut(
        lines_version=ADVISOR_LINES_VERSION,
        lines=shown,
        hidden_count=len(found) - len(shown),
        disclaimer=DISCLAIMER,
    )
