"""Which schema, prompt and evidence packet an analysis run uses, by the
holding's analysis path (stock / fund / income / commodity).

One place, so the synchronous pipeline, the local queue and the readiness
check cannot drift apart (before 2026-10-07 each had its own
`if fund ... else ...`).
"""
from __future__ import annotations

from dataclasses import dataclass

from app.config.settings import Settings
from app.domain.instrument_types import (
    ANALYZABLE_TYPES,
    PATH_COMMODITY,
    PATH_FUND,
    PATH_INCOME,
)
from app.services.analysis.evidence_packet import EVIDENCE_PACKET_VERSION
from app.services.funds.evidence import FUND_EVIDENCE_PACKET_VERSION
from app.services.instruments.evidence import (
    COMMODITY_EVIDENCE_PACKET_VERSION,
    INCOME_EVIDENCE_PACKET_VERSION,
)


@dataclass(frozen=True)
class AnalysisVersions:
    schema: str
    prompt: str
    packet: str


def not_analyzable_message(instrument_type: str, ticker: str) -> str:
    return (
        f"holding {ticker!r} is tagged {instrument_type!r}, which is not analyzable: it has no analysis path "
        f"(supported: {', '.join(sorted(ANALYZABLE_TYPES))})"
    )


def versions_for(path: str, settings: Settings) -> AnalysisVersions:
    if path == PATH_FUND:
        return AnalysisVersions(
            settings.active_fund_analysis_schema_version,
            settings.active_fund_analysis_prompt_version,
            FUND_EVIDENCE_PACKET_VERSION,
        )
    if path == PATH_INCOME:
        return AnalysisVersions(
            settings.active_income_analysis_schema_version,
            settings.active_income_analysis_prompt_version,
            INCOME_EVIDENCE_PACKET_VERSION,
        )
    if path == PATH_COMMODITY:
        return AnalysisVersions(
            settings.active_commodity_analysis_schema_version,
            settings.active_commodity_analysis_prompt_version,
            COMMODITY_EVIDENCE_PACKET_VERSION,
        )
    return AnalysisVersions(
        settings.active_analysis_schema_version,
        settings.active_analysis_prompt_version,
        EVIDENCE_PACKET_VERSION,
    )
