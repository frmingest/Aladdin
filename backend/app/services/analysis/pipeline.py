"""Ties the evidence packet, blind pass, and reconciliation pass together
into one persisted EquityAnalysisRun for a holding — Sprint 4's centerpiece
(claude/buffett-munger-rebuild-sprint-plan-2026-09-21.md).

CLAUDE.md Rule 1: the verdict's price-target range is set here, in plain
Python, from the Sprint 3 DCF bear/bull scenarios — the LLM is never asked
to produce a price target itself (see prompts/analysis/{blind,
reconciliation}_v1.md).
CLAUDE.md Rule 4: `run_blind_pass` is called with no notes argument at
all — only `run_reconciliation_pass` below is given `user_notes`.
CLAUDE.md: fail visibly — a blind-pass failure persists a FAILED run with
the real error; a reconciliation-pass failure (rarer, since the blind pass
already succeeded) keeps the blind pass's own output rather than losing it,
recording the reconciliation error separately.
"""
from __future__ import annotations

from collections.abc import Callable
from datetime import datetime, timezone
from typing import TypeVar

from sqlalchemy.orm import Session

from app.config.settings import get_settings
from app.domain.instrument_types import EQUITY_ANALYZABLE_TYPES, is_fund_type
from app.models.analysis import EquityAnalysisRun, EquityAnalysisRunStatus
from app.models.holding import Holding
from app.providers.base import (
    LLMProvider,
    LLMUnavailableError,
    MarketDataProvider,
    ResearchProvider,
    RiskFreeRateProvider,
)
from app.providers.newsweb_provider import NewswebAnnouncementsProvider
from app.services.analysis.blind_pass import run_blind_pass
from app.services.analysis.evidence_packet import (
    EVIDENCE_PACKET_VERSION,
    build_evidence_packet,
)
from app.services.analysis.notes import get_holding_note
from app.services.analysis.reconciliation_pass import run_reconciliation_pass
from app.services.funds.evidence import (
    FUND_EVIDENCE_PACKET_VERSION,
    build_fund_evidence_packet,
)

T = TypeVar("T")


class NotEquityAnalyzableError(Exception):
    """A bond fund, money-market fund, or physical commodity ETC has no
    moat/ROIC/owner-earnings to assess — raised instead of silently
    analyzing a non-equity holding as if it were one."""


def _call_with_fallback(
    primary: LLMProvider, fallback: LLMProvider | None, fn: Callable[[LLMProvider], T]
) -> tuple[T, LLMProvider]:
    """Tries `fn(primary)`; on LLMUnavailableError, tries `fn(fallback)` if
    one is configured (app.providers.factory.get_llm_fallback_provider) —
    mirrors this app's existing primary-then-fallback LLM provider design
    (app/providers/factory.py), just not exercised by any service before
    this sprint's structured-output calls."""
    try:
        return fn(primary), primary
    except LLMUnavailableError:
        if fallback is None:
            raise
        return fn(fallback), fallback


def run_full_analysis(
    db: Session,
    holding: Holding,
    *,
    llm_provider: LLMProvider,
    llm_fallback_provider: LLMProvider | None,
    market_data_provider: MarketDataProvider,
    risk_free_rate_provider: RiskFreeRateProvider,
    research_provider: ResearchProvider,
    announcements_provider: NewswebAnnouncementsProvider | None = None,
    run: EquityAnalysisRun | None = None,
) -> EquityAnalysisRun:
    """Runs the full pipeline for `holding`.

    `run`: an existing, already-claimed run row to execute (Sprint 5B: the
    local worker passes the QUEUED run it claimed, so the row the UI has
    been polling is the one that gets the result). None = create a new row
    (the synchronous cloud path, unchanged).
    """
    if holding.asset_class_raw not in EQUITY_ANALYZABLE_TYPES:
        raise NotEquityAnalyzableError(
            f"holding {holding.ticker!r} is tagged {holding.asset_class_raw!r}, not analyzable as "
            f"equity ({', '.join(sorted(EQUITY_ANALYZABLE_TYPES))} only)"
        )

    settings = get_settings()
    # Sprint 8 (F9): an equity ETF / fund takes the fund path — its own
    # evidence packet (look-through, cost, track record), schema and
    # prompts. Everything else below (passes, fallback, notes, statuses) is
    # shared.
    is_fund = is_fund_type(holding.asset_class_raw)
    if is_fund:
        schema_version = settings.active_fund_analysis_schema_version
        prompt_version = settings.active_fund_analysis_prompt_version
        packet_version = FUND_EVIDENCE_PACKET_VERSION
    else:
        schema_version = settings.active_analysis_schema_version
        prompt_version = settings.active_analysis_prompt_version
        packet_version = EVIDENCE_PACKET_VERSION

    if run is None:
        run = EquityAnalysisRun(
            holding_id=holding.id,
            status=EquityAnalysisRunStatus.RUNNING.value,
            schema_version=schema_version,
            blind_prompt_version=prompt_version,
            evidence_packet_version=packet_version,
            evidence_packet_json={},
            evidence_unavailable_reasons=[],
        )
        db.add(run)
    else:
        if run.holding_id != holding.id:
            raise ValueError("run belongs to a different holding")
        # Versions are those of the code that actually executes the run
        # (the worker's), not of the server that queued it.
        run.status = EquityAnalysisRunStatus.RUNNING.value
        run.schema_version = schema_version
        run.blind_prompt_version = prompt_version
        run.evidence_packet_version = packet_version
        run.error_message = None
    db.flush()

    if is_fund:
        packet = build_fund_evidence_packet(db, holding, research_provider=research_provider)
    else:
        packet = build_evidence_packet(
            db,
            holding,
            market_data_provider=market_data_provider,
            risk_free_rate_provider=risk_free_rate_provider,
            research_provider=research_provider,
            announcements_provider=announcements_provider,
        )
    run.evidence_packet_json = packet.as_dict()
    run.evidence_unavailable_reasons = packet.unavailable_reasons

    try:
        blind_result, used_provider = _call_with_fallback(
            llm_provider,
            llm_fallback_provider,
            lambda provider: run_blind_pass(
                provider, packet, schema_version=schema_version, prompt_version=prompt_version
            ),
        )
    except LLMUnavailableError as exc:
        run.status = EquityAnalysisRunStatus.FAILED.value
        run.error_message = f"blind pass failed: {exc}"
        db.commit()
        db.refresh(run)
        return run

    run.provider = used_provider.name
    run.model_name = blind_result.response.usage.model
    run.blind_pass_json = blind_result.output.model_dump(mode="json")
    run.blind_pass_citation_warnings = blind_result.citation_warnings
    run.blind_completed_at = datetime.now(timezone.utc)
    run.status = EquityAnalysisRunStatus.BLIND_ONLY.value

    note = get_holding_note(db, holding.id)
    user_notes = note.content if note is not None else None
    run.user_notes_snapshot = user_notes
    run.reconciliation_prompt_version = prompt_version

    try:
        reconciliation_result, _used_provider = _call_with_fallback(
            llm_provider,
            llm_fallback_provider,
            lambda provider: run_reconciliation_pass(
                provider,
                packet,
                blind_result.output,
                user_notes=user_notes,
                schema_version=schema_version,
                prompt_version=prompt_version,
            ),
        )
    except LLMUnavailableError as exc:
        run.error_message = f"reconciliation pass failed (blind pass result kept): {exc}"
        db.commit()
        db.refresh(run)
        return run

    run.reconciliation_json = reconciliation_result.output.model_dump(mode="json")
    run.reconciliation_citation_warnings = reconciliation_result.citation_warnings
    run.completed_at = datetime.now(timezone.utc)
    run.status = EquityAnalysisRunStatus.COMPLETED.value

    if not is_fund:  # a fund has no DCF, so no price-target range
        _attach_price_target(run, packet)

    db.commit()
    db.refresh(run)
    return run


def _attach_price_target(run: EquityAnalysisRun, packet) -> None:
    valuation = packet.valuation
    if valuation is None or valuation.dcf is None:
        return
    scenarios = {s.label: s.intrinsic_value_per_share for s in valuation.dcf.scenarios}
    bear = scenarios.get("bear")
    bull = scenarios.get("bull")
    if bear is None or bull is None:
        return
    run.price_target_low = min(bear, bull)
    run.price_target_high = max(bear, bull)
    run.price_target_currency = valuation.valuation_currency
