"""Analyst modes and personas (Epic F22, 2026-09-27).

Two things that are easy to confuse:

- A **persona** is who produced one analysis run: the Buffett/Munger
  engine (Sprints 4 and 8) or the Ray Dalio engine (F22). Every
  `equity_analysis_runs` row carries exactly one persona.
- A **mode** is what the whole app is showing right now (decision 4: one
  whole-app switch, no per-page override): one persona's view, or both
  side by side.

The default mode and persona are Buffett/Munger, so nothing changes for
existing runs, pages or API callers that never mention either.
See claude/analyst-modes-epic-f22-2026-09-27.md.
"""
from __future__ import annotations

from typing import Literal

from app.domain.instrument_types import INSTRUMENT_TYPES

Persona = Literal["buffett_munger", "dalio"]
AnalystMode = Literal["buffett_munger", "dalio", "side_by_side"]

BUFFETT_MUNGER: Persona = "buffett_munger"
DALIO: Persona = "dalio"
SIDE_BY_SIDE: AnalystMode = "side_by_side"

PERSONAS: tuple[str, ...] = (BUFFETT_MUNGER, DALIO)
ANALYST_MODES: tuple[str, ...] = (BUFFETT_MUNGER, DALIO, SIDE_BY_SIDE)
DEFAULT_PERSONA: Persona = BUFFETT_MUNGER
DEFAULT_MODE: AnalystMode = BUFFETT_MUNGER

PERSONA_LABELS: dict[str, str] = {
    BUFFETT_MUNGER: "Buffett/Munger",
    DALIO: "Ray Dalio",
}
MODE_LABELS: dict[str, str] = {**PERSONA_LABELS, SIDE_BY_SIDE: "Side-by-side"}

# ECON-F22-01: shown next to every Dalio verdict so a Buffett "Buy" and a
# Dalio "Sell" on the same holding read as two different questions, not a
# contradiction.
DALIO_VERDICT_BASIS = (
    "Basis: where we are in the debt, liquidity and geopolitical cycles, currency and "
    "country risk, and the job this holding does in the portfolio. Not business quality."
)

# Decision 5 (§3c): Dalio's lens is asset-class-based, so every instrument
# type is analyzable by it — stocks, equity and bond funds, money-market
# funds and physical-commodity ETCs alike. The Buffett engine stays limited
# to EQUITY_ANALYZABLE_TYPES.
DALIO_ANALYZABLE_TYPES = frozenset(INSTRUMENT_TYPES)


def is_persona(value: str) -> bool:
    return value in PERSONAS


def is_mode(value: str) -> bool:
    return value in ANALYST_MODES


def other_persona(persona: str) -> str:
    return DALIO if persona == BUFFETT_MUNGER else BUFFETT_MUNGER
