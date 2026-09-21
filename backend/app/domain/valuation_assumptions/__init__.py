"""Versioned DCF assumptions — equity risk premium, terminal growth rate,
and bull/bear scenario growth offsets (Sprint 3 — see
claude/buffett-munger-rebuild-sprint-plan-2026-09-21.md).

CLAUDE.md Rule 3: "a change that could alter a real analysis output is a
*new* version file... never an in-place edit of a version already used for
a real run." These numbers directly determine a DCF's output, so they get
the same versioning discipline as prompts (backend/prompts/research/) even
though they're plain Python constants rather than .md files — add a new
`vN.py` module and bump Settings.active_valuation_assumptions_version
rather than editing v1's numbers once a real analysis has used them.

Every rate here is a FRACTION (0.045 for 4.5%), not a percentage — the one
deliberate exception is app/providers/base.py's RiskFreeRate.rate, which
FRED publishes as a percentage; app/services/valuation/discount_rate.py is
the one place that gets divided by 100 before being combined with these.
"""
from __future__ import annotations

from app.domain.valuation_assumptions.v1 import VALUATION_ASSUMPTIONS_V1
from app.domain.valuation_assumptions.value_types import ValuationAssumptions

_VERSIONS: dict[str, ValuationAssumptions] = {"v1": VALUATION_ASSUMPTIONS_V1}


def get_valuation_assumptions(version: str) -> ValuationAssumptions:
    try:
        return _VERSIONS[version]
    except KeyError as exc:
        raise ValueError(f"Unknown valuation assumptions version: {version!r}") from exc
