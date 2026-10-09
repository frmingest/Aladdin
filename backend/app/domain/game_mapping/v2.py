"""v2 game mapping (2026-10-09): v1 plus a coverage floor on the sky.

v1 let the weather read "calm" from a stored stress scenario that covered only
part of the book (equity and fund types; gold, bonds and unmodelled holdings
sat outside it). v2 adds `min_stress_coverage`: below that share of the
book's weight the sky can still turn gathering or besieged (a loss on the
covered part is a loss), but it can no longer read calm; it reads
"unsurveyed" (mist). The siege simulator uses the same 50% floor
(siege_scenarios_v1.min_beta_coverage). Every other number is v1 unchanged.
CLAUDE.md Rule 3: v1 is untouched.
"""
from __future__ import annotations

from dataclasses import replace
from decimal import Decimal

from app.domain.game_mapping.v1 import GAME_MAPPING_V1

GAME_MAPPING_V2 = replace(GAME_MAPPING_V1, version="v2", min_stress_coverage=Decimal("0.5"))
