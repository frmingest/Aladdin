"""v1 analysis assumptions.

CLAUDE.md Rule 3: a judgment call like the capital-efficiency hurdle
directly shapes a real analysis output (the evidence packet's "meets
hurdle?" comparison, computed deterministically here in Python — never by
the LLM), so it gets the same versioning discipline as
app/domain/valuation_assumptions/: bump the version, don't edit v1's
numbers once a real analysis run has used them.

15% ROIC/ROE is the Brain's own stated hurdle
(claude/buffett-munger-rebuild-sprint-plan-2026-09-21.md, Step 1.3) — a
standard Buffett/Munger-style bar (roughly double a typical long-run
equity-market return), not independently re-derived here. 5 years matches
the Brain's own "3-5yr avg" phrasing at its upper bound; a holding with
fewer periods filed simply averages over however many it has (see
app/services/analysis/evidence_packet.py).
"""
from __future__ import annotations

from decimal import Decimal

from app.domain.analysis_assumptions.value_types import AnalysisAssumptions

ANALYSIS_ASSUMPTIONS_V1 = AnalysisAssumptions(
    version="v1",
    capital_efficiency_hurdle=Decimal("0.15"),
    history_years=5,
)
