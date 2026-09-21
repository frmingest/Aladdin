"""Versioned analysis assumptions (capital-efficiency hurdle, history
lookback window) — see app/domain/analysis_assumptions/v1.py and
CLAUDE.md Rule 3. Mirrors app/domain/valuation_assumptions/'s registry
pattern exactly.
"""
from __future__ import annotations

from app.domain.analysis_assumptions.v1 import ANALYSIS_ASSUMPTIONS_V1
from app.domain.analysis_assumptions.value_types import AnalysisAssumptions

_VERSIONS: dict[str, AnalysisAssumptions] = {"v1": ANALYSIS_ASSUMPTIONS_V1}


def get_analysis_assumptions(version: str) -> AnalysisAssumptions:
    try:
        return _VERSIONS[version]
    except KeyError as exc:
        raise ValueError(f"Unknown analysis assumptions version: {version!r}") from exc
