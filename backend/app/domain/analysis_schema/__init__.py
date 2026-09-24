"""Versioned analysis output schema registry (CLAUDE.md Rule 3) — mirrors
app/domain/valuation_assumptions/'s version-registry pattern. A future v2
adds a new module here and a new entry in the two dicts below; existing
stored runs keep pointing at v1's schema via their own
`schema_version` column.
"""
from __future__ import annotations

from pydantic import BaseModel

from app.domain.analysis_schema.fund_v1 import (
    FundBlindPassOutputV1,
    LookThroughMoat,
    cited_evidence_ids_fund_blind,
)
from app.domain.analysis_schema.v1 import (
    MOAT_SOURCES,
    BlindPassOutputV1,
    MoatAssessment,
    MoatSourceRating,
    NarrativeAssessment,
    ReconciliationOutputV1,
    VerdictContent,
    cited_evidence_ids_blind,
    cited_evidence_ids_reconciliation,
)

# "fund_v1" (Sprint 8): the fund / ETF analysis. Its reconciliation output
# has the same shape as v1's, so it reuses that class.
_BLIND_SCHEMAS: dict[str, type[BaseModel]] = {
    "v1": BlindPassOutputV1,
    "fund_v1": FundBlindPassOutputV1,
}
_RECONCILIATION_SCHEMAS: dict[str, type[BaseModel]] = {
    "v1": ReconciliationOutputV1,
    "fund_v1": ReconciliationOutputV1,
}


def is_fund_schema(version: str) -> bool:
    return version.startswith("fund_")


def cited_evidence_ids_any_blind(output: BaseModel) -> set[str]:
    """Every evidence_id cited in a blind-pass output of any schema."""
    if isinstance(output, FundBlindPassOutputV1):
        return cited_evidence_ids_fund_blind(output)
    if isinstance(output, BlindPassOutputV1):
        return cited_evidence_ids_blind(output)
    raise TypeError(f"unknown blind-pass output type: {type(output).__name__}")


def get_blind_pass_schema(version: str) -> type[BaseModel]:
    try:
        return _BLIND_SCHEMAS[version]
    except KeyError as exc:
        raise ValueError(f"Unknown analysis schema version: {version!r}") from exc


def get_reconciliation_schema(version: str) -> type[BaseModel]:
    try:
        return _RECONCILIATION_SCHEMAS[version]
    except KeyError as exc:
        raise ValueError(f"Unknown analysis schema version: {version!r}") from exc


__all__ = [
    "MOAT_SOURCES",
    "BlindPassOutputV1",
    "FundBlindPassOutputV1",
    "LookThroughMoat",
    "MoatAssessment",
    "MoatSourceRating",
    "NarrativeAssessment",
    "ReconciliationOutputV1",
    "VerdictContent",
    "cited_evidence_ids_any_blind",
    "cited_evidence_ids_blind",
    "cited_evidence_ids_fund_blind",
    "cited_evidence_ids_reconciliation",
    "get_blind_pass_schema",
    "get_reconciliation_schema",
    "is_fund_schema",
]
