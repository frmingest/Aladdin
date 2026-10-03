"""v3 valuation assumptions (2026-10-03, Sprint 19).

Identical to v2 in every market input and guardrail; the only change is how
the DCF's growth base is chosen. v1 and v2 measured CAGR from the earliest
period on file, so a company with one loss-making early year (Vår Energi,
Salmon Evolution on the margin-of-safety board) was "unavailable" however
profitable it is now, and its whole filed history could never help.

v3 measures growth over the latest unbroken run of profitable years
(`growth_base_method="profitable_run"`), counts real elapsed years, and says
which older loss years it left out. It does not guess where there is no
honest rate: a company whose latest year is a loss, or with only one
profitable year, stays unavailable with a plain reason. A different model
(price-to-book, asset-based) for those is a separate product decision.

CLAUDE.md Rule 3: do not edit these numbers once a real analysis has used
them — add v4.py instead.
"""
from __future__ import annotations

from dataclasses import replace

from app.domain.valuation_assumptions.v2 import VALUATION_ASSUMPTIONS_V2

VALUATION_ASSUMPTIONS_V3 = replace(
    VALUATION_ASSUMPTIONS_V2, version="v3", growth_base_method="profitable_run"
)
