"""
Unit tests for the daily-budget guard in app.services.analysis.runner
(2026-09-16 — Faiz's "many stored PDF documents hit the free tier's rate
limit" report) and the fallback-provider path added on top of it
(2026-09-17 — see claude/llm-provider-alternatives-2026-09-17.md). Exercises
`run_analysis` directly against a throwaway in-memory SQLite session (no
HTTP layer, no real Gemini/Mistral calls — a FakeLLMProvider stands in, same
pattern as tests/integration/test_analysis_api.py), independent of external
infrastructure (§22).

The free tier's binding constraint for `gemini-3.6-flash` is
`llm_rate_limit_rpd` (20 requests/day, ADR 0013) — an order of magnitude
tighter than the per-minute pacing app.providers.gemini_retry already
handles. These tests set that limit very low (1-3) so the guard's
pre-flight skip is exercised deterministically, without needing to
fabricate realistic-looking llm_usage_events timestamps.

The fallback tests below (`test_fallback_*`) cover the 2026-09-17 addition:
once that same daily budget is exhausted, a holding is only skipped outright
when no `fallback_provider` was passed to `run_analysis` — otherwise it gets
a real two-pass analysis from the fallback instead, and the ledger records
that fallback's own provider name (not the primary's) for that holding's
usage rows.
"""

import json
from decimal import Decimal

import pytest

import app.models  # noqa: F401 — populates Base.metadata before create_all
from app.config.database import Base
from app.config.settings import Settings
from app.models.document import Document, DocumentChunk, DocumentStatus, DocumentType
from app.models.holding import Holding
from app.models.llm_usage import LLMUsageEvent
from app.models.portfolio import PortfolioPosition, PortfolioSnapshot, SnapshotStatus
from app.providers.base import LLMProvider, LLMResponse, LLMUnavailableError
from app.services.analysis.runner import run_analysis
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

_BLIND_OUTPUT = {
    "executive_summary": "Solid energy producer with growing volumes.",
    "thesis_status": "new",
    "business_quality": {"score": 7, "confidence": "medium", "reasoning": "Reasonable moat."},
    "financial_strength": {"score": 6, "confidence": "medium", "reasoning": "Adequate balance sheet."},
    "valuation": {"score": 5, "confidence": "low", "reasoning": "Limited multiples data."},
    "key_strengths": ["Growing production volumes"],
    "key_risks": ["Commodity price exposure"],
    "new_information": [],
    "invalidation_triggers": ["Sustained oil price collapse"],
    "decision_considerations": ["Monitor next quarterly report"],
    "source_references": [],
    "insufficient_evidence_areas": [],
}

_RECONCILIATION_OUTPUT = {
    "thesis_divergence": {
        "blind_assessment_summary": "Cautiously positive.",
        "user_thesis_summary": "Bullish on the energy transition angle.",
        "material_disagreement": False,
        "disagreement_notes": "Aligned.",
    },
    "additional_risks": [],
    "additional_considerations": [],
    "source_references": [],
}


class FakeLLMProvider(LLMProvider):
    """Counts real calls made — the point of these tests is confirming the
    guard skips a holding *before* any call, not just that it fails
    afterwards."""

    def __init__(self, always_fail: bool = False):
        self.always_fail = always_fail
        self.calls_made = 0

    def generate_structured(self, *, system_prompt, user_content, response_schema, prompt_version):
        self.calls_made += 1
        if self.always_fail:
            raise LLMUnavailableError("simulated provider outage")
        payload = _BLIND_OUTPUT if "persona" in prompt_version else _RECONCILIATION_OUTPUT
        return LLMResponse(content=json.dumps(payload), model="fake-model", input_tokens=10, output_tokens=5, latency_ms=1.0)


@pytest.fixture()
def db():
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(engine)
    session_factory = sessionmaker(bind=engine, autoflush=False, autocommit=False)
    session = session_factory()
    yield session
    session.close()
    engine.dispose()


def _settings(rpd: int, fallback_provider: str = "none") -> Settings:
    # active_prompt_version pinned to "v2": the repo's default ("v3") has no
    # prompts/synthesis/v3.md on disk (a pre-existing, unrelated gap flagged
    # in claude/progress.md — settings.active_prompt_version defaults ahead
    # of what prompts/synthesis/ actually has). Irrelevant to what these
    # tests exercise; "v2" just avoids tripping over it.
    return Settings(
        llm_rate_limit_rpd=rpd,
        llm_provider="stub",
        active_prompt_version="v2",
        llm_fallback_provider=fallback_provider,
    )


def _make_snapshot(db) -> PortfolioSnapshot:
    source_doc = Document(
        holding_id=None,
        type=DocumentType.PORTFOLIO_SNAPSHOT.value,
        original_filename="portfolio.csv",
        mime_type="text/csv",
        size_bytes=10,
        storage_path="x",
        sha256="a" * 64,
        status=DocumentStatus.PROCESSED.value,
    )
    db.add(source_doc)
    db.flush()
    snapshot = PortfolioSnapshot(source_file_id=source_doc.id, reporting_currency="NOK", status=SnapshotStatus.VALIDATED.value)
    db.add(snapshot)
    db.flush()
    return snapshot


def _make_holding_with_evidence(db, snapshot, ticker: str, notes: str | None = None) -> Holding:
    """A holding with just enough on record to clear InsufficientContextError
    (one document + one chunk) — mirrors
    tests/unit/test_analysis_context.py's fixture shape. `notes` set makes
    the holding have an active thesis (context.user_notes non-empty), which
    is what triggers the reconciliation pass — see
    app.services.analysis.llm_analysis.run_two_pass_analysis."""
    holding = Holding(
        ticker=ticker, name=ticker, asset_class="EQUITY", asset_class_raw="Aksje", sector="Energy", trading_currency="NOK"
    )
    db.add(holding)
    db.flush()
    db.add(
        PortfolioPosition(
            snapshot_id=snapshot.id,
            holding_id=holding.id,
            weight_pct=Decimal("50"),
            quantity=Decimal("100"),
            notes=notes,
        )
    )
    report = Document(
        holding_id=holding.id,
        type=DocumentType.ANNUAL_REPORT.value,
        original_filename=f"{ticker}-report.pdf",
        mime_type="application/pdf",
        size_bytes=100,
        storage_path="x",
        sha256=f"{ticker.lower():0<64}"[:64],
        status=DocumentStatus.PROCESSED.value,
    )
    db.add(report)
    db.flush()
    db.add(
        DocumentChunk(
            document_id=report.id,
            page_start=1,
            page_end=1,
            section=None,
            content="Revenue grew 12% year over year driven by higher production volumes.",
            content_hash=f"{ticker}-chunk",
        )
    )
    db.commit()
    return holding


def test_second_holding_skipped_once_daily_budget_exhausted(db):
    snapshot = _make_snapshot(db)
    holding_a = _make_holding_with_evidence(db, snapshot, "AAA.OL")
    holding_b = _make_holding_with_evidence(db, snapshot, "BBB.OL")
    provider = FakeLLMProvider()

    outcome = run_analysis(db, provider, snapshot.id, [holding_a.id, holding_b.id], settings=_settings(rpd=1))

    assert len(outcome.holding_analyses) == 1
    assert len(outcome.failures) == 1
    assert outcome.failures[0].holding_id == holding_b.id
    assert "budget is exhausted" in outcome.failures[0].reason
    assert "requests/day" in outcome.failures[0].reason
    # The second holding must never have reached the provider at all.
    assert provider.calls_made == 1


def test_holding_needing_reconciliation_skipped_when_only_one_call_left(db):
    snapshot = _make_snapshot(db)
    holding = _make_holding_with_evidence(db, snapshot, "CCC.OL", notes="Long-term conviction — energy transition thesis.")
    provider = FakeLLMProvider()

    outcome = run_analysis(db, provider, snapshot.id, [holding.id], settings=_settings(rpd=1))

    assert outcome.holding_analyses == []
    assert len(outcome.failures) == 1
    assert "budget is exhausted" in outcome.failures[0].reason
    # Pre-flight: a holding that would need 2 calls is skipped before making
    # even the first one when only 1 is left in the budget.
    assert provider.calls_made == 0


def test_budget_decrements_by_two_when_reconciliation_runs(db):
    snapshot = _make_snapshot(db)
    holding_with_notes = _make_holding_with_evidence(db, snapshot, "DDD.OL", notes="Bullish thesis on file.")
    holding_without_notes = _make_holding_with_evidence(db, snapshot, "EEE.OL")
    provider = FakeLLMProvider()

    outcome = run_analysis(
        db, provider, snapshot.id, [holding_with_notes.id, holding_without_notes.id], settings=_settings(rpd=3)
    )

    assert len(outcome.holding_analyses) == 2
    assert outcome.failures == []
    # 2 calls (blind + reconciliation) for the first holding, 1 (blind only)
    # for the second — exactly exhausts the rpd=3 budget with none skipped.
    assert provider.calls_made == 3


def test_failed_call_still_consumes_budget_so_next_holding_is_skipped_not_retried(db):
    snapshot = _make_snapshot(db)
    holding_a = _make_holding_with_evidence(db, snapshot, "FFF.OL")
    holding_b = _make_holding_with_evidence(db, snapshot, "GGG.OL")
    provider = FakeLLMProvider(always_fail=True)

    outcome = run_analysis(db, provider, snapshot.id, [holding_a.id, holding_b.id], settings=_settings(rpd=1))

    assert outcome.holding_analyses == []
    assert len(outcome.failures) == 2
    assert "simulated provider outage" in outcome.failures[0].reason
    assert "budget is exhausted" in outcome.failures[1].reason
    # Only one real (failed) attempt was made — the second holding was
    # skipped on the budget check rather than retried into a second
    # guaranteed failure.
    assert provider.calls_made == 1


# --- Fallback provider (2026-09-17) --------------------------------------


def test_fallback_used_once_primary_budget_exhausted(db):
    """With no fallback configured, a second holding is skipped outright
    (test_second_holding_skipped_once_daily_budget_exhausted above) — with
    one configured, it gets a real analysis from the fallback instead."""
    snapshot = _make_snapshot(db)
    holding_a = _make_holding_with_evidence(db, snapshot, "AAA.OL")
    holding_b = _make_holding_with_evidence(db, snapshot, "BBB.OL")
    primary = FakeLLMProvider()
    fallback = FakeLLMProvider()

    outcome = run_analysis(
        db,
        primary,
        snapshot.id,
        [holding_a.id, holding_b.id],
        settings=_settings(rpd=1, fallback_provider="mistral"),
        fallback_provider=fallback,
    )

    assert len(outcome.holding_analyses) == 2
    assert outcome.failures == []
    assert primary.calls_made == 1  # holding_a only — its budget was still available
    assert fallback.calls_made == 1  # holding_b, once primary's budget was spent

    # The ledger records the fallback's own provider name for holding_b's
    # usage row, not the primary's — see runner._record_analysis_usage.
    events_by_holding = {
        e.holding_id: e for e in db.query(LLMUsageEvent).filter(LLMUsageEvent.holding_id == holding_b.id).all()
    }
    assert events_by_holding[holding_b.id].provider == "mistral"


def test_primary_used_when_budget_available_even_with_fallback_configured(db):
    """A fallback being configured doesn't change anything for the normal
    case — the primary is still used whenever its own budget covers it."""
    snapshot = _make_snapshot(db)
    holding = _make_holding_with_evidence(db, snapshot, "CCC.OL")
    primary = FakeLLMProvider()
    fallback = FakeLLMProvider()

    outcome = run_analysis(
        db,
        primary,
        snapshot.id,
        [holding.id],
        settings=_settings(rpd=5, fallback_provider="mistral"),
        fallback_provider=fallback,
    )

    assert len(outcome.holding_analyses) == 1
    assert primary.calls_made == 1
    assert fallback.calls_made == 0  # never touched — primary had plenty of budget


def test_fallback_failure_reports_both_causes(db):
    """When the fallback itself fails, the failure reason names both the
    exhausted primary budget and the fallback's own error — not just
    whichever happened last (§21: fail visibly, name the real cause)."""
    snapshot = _make_snapshot(db)
    holding = _make_holding_with_evidence(db, snapshot, "DDD.OL")
    primary = FakeLLMProvider()
    fallback = FakeLLMProvider(always_fail=True)

    outcome = run_analysis(
        db,
        primary,
        snapshot.id,
        [holding.id],
        settings=_settings(rpd=0, fallback_provider="mistral"),
        fallback_provider=fallback,
    )

    assert outcome.holding_analyses == []
    assert len(outcome.failures) == 1
    assert "budget is exhausted" in outcome.failures[0].reason
    assert "mistral" in outcome.failures[0].reason
    assert "simulated provider outage" in outcome.failures[0].reason
    assert primary.calls_made == 0  # budget was already at 0 — primary never touched
    assert fallback.calls_made == 1


def test_no_fallback_configured_still_skips_outright(db):
    """Backward compatibility: run_analysis called without a fallback_provider
    argument at all (the pre-2026-09-17 call shape) behaves exactly as
    before — this is the same assertion as
    test_second_holding_skipped_once_daily_budget_exhausted, kept here too
    so a regression in the fallback wiring can't accidentally change the
    no-fallback default."""
    snapshot = _make_snapshot(db)
    holding = _make_holding_with_evidence(db, snapshot, "EEE.OL")
    primary = FakeLLMProvider()

    outcome = run_analysis(db, primary, snapshot.id, [holding.id], settings=_settings(rpd=0))

    assert outcome.holding_analyses == []
    assert len(outcome.failures) == 1
    assert "budget is exhausted" in outcome.failures[0].reason
    assert primary.calls_made == 0


# --- Live-failure fallback (2026-09-17b) ----------------------------------
#
# Faiz's Railway logs showed Gemini returning real, live 429s while
# /usage/summary still had budget left for the day (2/20 used) — the
# pre-flight check above only predicts exhaustion from the locally-tracked
# daily count, so it kept sending holdings to Gemini, which kept failing
# live, and the fallback (configured and reachable) never got a chance to
# run. These tests cover the fix: a live failure from the primary, not just
# a predicted one, now retries the same holding against the fallback.


def test_live_primary_failure_retries_fallback_even_with_budget_available(db):
    """Budget is nowhere near exhausted (rpd=5, one holding) — the primary
    is still used first, per the pre-flight check — but when that live call
    itself fails, the same holding is retried against the fallback instead
    of being recorded as a failure outright."""
    snapshot = _make_snapshot(db)
    holding = _make_holding_with_evidence(db, snapshot, "HHH.OL")
    primary = FakeLLMProvider(always_fail=True)
    fallback = FakeLLMProvider()

    outcome = run_analysis(
        db,
        primary,
        snapshot.id,
        [holding.id],
        settings=_settings(rpd=5, fallback_provider="mistral"),
        fallback_provider=fallback,
    )

    assert len(outcome.holding_analyses) == 1
    assert outcome.failures == []
    assert primary.calls_made == 1  # attempted first, per the pre-flight check
    assert fallback.calls_made == 1  # retried immediately after the live failure

    events_by_holding = {
        e.holding_id: e for e in db.query(LLMUsageEvent).filter(LLMUsageEvent.holding_id == holding.id).all()
    }
    assert events_by_holding[holding.id].provider == "mistral"


def test_live_failure_fallback_also_fails_reports_both_causes(db):
    """When the live-retry fallback also fails, the reason names both
    causes and reads distinctly from the pre-flight-exhausted message
    (§21: fail visibly, name the real cause — and don't claim the budget
    was exhausted when it wasn't)."""
    snapshot = _make_snapshot(db)
    holding = _make_holding_with_evidence(db, snapshot, "III.OL")
    primary = FakeLLMProvider(always_fail=True)
    fallback = FakeLLMProvider(always_fail=True)

    outcome = run_analysis(
        db,
        primary,
        snapshot.id,
        [holding.id],
        settings=_settings(rpd=5, fallback_provider="mistral"),
        fallback_provider=fallback,
    )

    assert outcome.holding_analyses == []
    assert len(outcome.failures) == 1
    reason = outcome.failures[0].reason
    assert "Primary provider 'stub' failed" in reason
    assert "Fallback provider 'mistral' also failed" in reason
    assert "simulated provider outage" in reason
    assert "budget is exhausted" not in reason  # this wasn't a budget-exhaustion skip
    assert primary.calls_made == 1
    assert fallback.calls_made == 1


def test_live_failure_still_charges_primary_budget_before_next_holding(db):
    """The live-retry path doesn't give the primary's budget a free pass:
    a failed live call still costs real quota (same accounting as the
    no-fallback-configured case), so a second holding correctly falls
    straight to the fallback via the pre-flight check afterwards, without
    a second wasted attempt against the primary."""
    snapshot = _make_snapshot(db)
    holding_a = _make_holding_with_evidence(db, snapshot, "JJJ.OL")
    holding_b = _make_holding_with_evidence(db, snapshot, "KKK.OL")
    primary = FakeLLMProvider(always_fail=True)
    fallback = FakeLLMProvider()

    outcome = run_analysis(
        db,
        primary,
        snapshot.id,
        [holding_a.id, holding_b.id],
        settings=_settings(rpd=1, fallback_provider="mistral"),
        fallback_provider=fallback,
    )

    assert len(outcome.holding_analyses) == 2
    assert outcome.failures == []
    # holding_a: primary attempted (live failure, budget spent), retried on
    # fallback. holding_b: budget already 0 — pre-flight sends it straight
    # to the fallback, primary never touched again.
    assert primary.calls_made == 1
    assert fallback.calls_made == 2
