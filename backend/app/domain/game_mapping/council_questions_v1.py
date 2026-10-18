"""v1 Council questions (2026-10-18, "Call a councillor to the floor").

The Council page lets the player pick one holding, one of four fixed questions and one of the two
advisors. The answer is chosen by fixed rules in app/services/game/council_ask.py from values the
Fortress already stored, and worded here by hand. No model writes any of it, there is no free-text
question, and every number in a line is filled by application code. Each answer also carries the
stored facts it was built from, so it can be checked.

Voice rules (CLAUDE.md "truth over flattery"): state what the stored data shows, then what to look at.
Never "buy", "sell", "add", "trim" or an instruction to trade. Unknown stays unknown and is said so.
Silence is never "all clear". The Oracle is patient, the Partner is blunt and starts from what could go wrong.

CLAUDE.md Rule 3: once these have been shown for real, do not edit a template in place. Add
`council_questions_v2.py`.
"""
from __future__ import annotations

from typing import Literal, NamedTuple

COUNCIL_QUESTIONS_VERSION = "v1"

Question = Literal["why_here", "edge", "storm", "beside"]
QUESTIONS: tuple[str, ...] = ("why_here", "edge", "storm", "beside")
Advisor = Literal["oracle", "partner"]
Tone = Literal["warning", "note", "calm"]

# A holding and the ones it moves with count as "heavy" at or above this share of the portfolio (percent).
COMBINED_WARN_PCT = 30


class Answer(NamedTuple):
    tone: Tone
    text: str


# case -> advisor -> (tone, text). Placeholders are filled by the service; a typo fails a test.
TEMPLATES: dict[str, dict[str, Answer]] = {
    # why_here, when this advisor has no rule that names the holding. {name}
    "why_silent": {
        "oracle": Answer("calm", "Nothing about {name} makes me raise my hand. That is not a clean bill of health, only a rule that did not fire."),
        "partner": Answer("calm", "No rule of mine fires on {name}. Do not read that as safe. It means I have nothing stored to point at."),
    },
    # edge. {name}
    "edge_no_walls": {
        "oracle": Answer("note", "{name} has no walls of its own to measure: it is not a business with a balance sheet we hold. Judge what it holds instead."),
        "partner": Answer("note", "Nothing to measure on {name}: no balance sheet of its own. Do not borrow comfort from a wall that is not there."),
    },
    "edge_unsurveyed": {
        "oracle": Answer("note", "I cannot say how close the edge is for {name}: no balance sheet is stored for it yet. That is fog, not safety."),
        "partner": Answer("note", "No stored statements for {name}, so I have no distance to give you. Unknown is not the same as fine."),
    },
    # {name}, {wall}, {nearest} = the weaker-side sentence that is within the near band
    "edge_slipping": {
        "oracle": Answer("warning", "{name} stands behind {wall} walls, and a number sits close to the line of a weaker rung. {nearest}"),
        "partner": Answer("warning", "{name}: {wall} walls, but not by much. {nearest} Invert it: what would one weaker report do to this wall?"),
    },
    # {name}, {wall}, {gap}
    "edge_weak": {
        "oracle": Answer("note", "{name} stands behind {wall} walls, the weaker end of the ladder. {gap}"),
        "partner": Answer("warning", "{name} has {wall} walls. That is the weak end. {gap}"),
    },
    "edge_top": {
        "oracle": Answer("calm", "{name} stands behind {wall} walls, as high as this ladder goes. That is a reading of the last statements, not a promise."),
        "partner": Answer("calm", "{name}: {wall} walls, nothing stronger to measure toward. The last report says so; the next one can change it."),
    },
    "edge_climbing": {
        "oracle": Answer("calm", "{name} stands behind {wall} walls. {gap}"),
        "partner": Answer("note", "{name}: {wall} walls. {gap} A distance on the last statements, nothing more."),
    },
    # storm. {name}
    "storm_no_reading": {
        "oracle": Answer("note", "I have no storm reading for {name}. The stored stress scenario did not cover it, so I will not guess."),
        "partner": Answer("note", "No stress result stored for {name}. If you wanted a number from me, you do not get one."),
    },
    # {name}, {shock}, {how}
    "storm_sheltered": {
        "oracle": Answer("calm", "In the stored stress scenario {name} moves {shock} on {how}. It rides this one better than most."),
        "partner": Answer("calm", "{name}: {shock} in the stored scenario, on {how}. Sheltered here. A different storm hits different walls."),
    },
    "storm_exposed": {
        "oracle": Answer("note", "In the stored stress scenario {name} moves {shock} on {how}. It feels the weather."),
        "partner": Answer("note", "{name} drops {shock} in the stored scenario, on {how}. Ask whether you could sit through that."),
    },
    "storm_breach_risk": {
        "oracle": Answer("warning", "In the stored stress scenario {name} moves {shock} on {how}. That is a wall at risk of breach."),
        "partner": Answer("warning", "{name}: {shock} in the stored scenario, on {how}. That is the kind of hole that does not close by itself."),
    },
    # beside. {name}, {weight}, {sector}
    "beside_alone": {
        "oracle": Answer("calm", "No stored partner moves with {name}. It is {weight} of the portfolio; sector: {sector}."),
        "partner": Answer("calm", "I find nothing stored that moves with {name}. That means the check found none, not that none exists. {weight}; sector: {sector}."),
    },
    # {name}, {partners}, {combined}
    "beside_together": {
        "oracle": Answer("note", "{name} moves together with {partners}. Between them they are about {combined} of the portfolio."),
        "partner": Answer("note", "{name} and {partners} fall together. That is about {combined} of the portfolio riding on one weather."),
    },
    "beside_heavy": {
        "oracle": Answer("warning", "{name} moves together with {partners}, and between them they are about {combined} of the portfolio. That is a lot resting on one thing."),
        "partner": Answer("warning", "{name} and {partners} move as one, and they are about {combined} of everything you own. Call it one bet, not several."),
    },
}
