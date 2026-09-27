"""Epic F22 — the Dalio persona through the real pipeline, queue and
side-by-side auto-queue, against in-memory SQLite and fakes.

Guards the plan's non-negotiables:
- the Dalio blind pass never sees the owner's notes (Rule 4) or any
  Buffett/Munger run's output (§2 blind-pass isolation);
- persona tagging: latest-run lookups default to Buffett/Munger, so a
  Dalio run never shows up as a Buffett verdict;
- any instrument type is Dalio-analyzable; a gold ETC gets no price target;
- auto-queue: side-by-side only, local engine, dedupe, nightly cap.
"""
from __future__ import annotations

from datetime import datetime, timedelta, timezone
from decimal import Decimal

from sqlalchemy import create_engine
from sqlalchemy.orm import Session

from app.config.settings import get_settings
from app.domain.analysis_schema import (
    DalioBlindPassOutputV1,
    DalioReconciliationOutputV1,
)
from app.models import Base, Document, Holding, PortfolioPosition, PortfolioSnapshot
from app.models.analysis import EquityAnalysisRun
from app.providers.base import LLMResponse, LLMUsageMetrics, PricePoint
from app.services.analysis import auto_queue, queue
from app.services.analysis.latest import latest_runs_by_holding, run_portfolio_role
from app.services.analysis.notes import set_holding_note
from app.services.analysis.pipeline import run_full_analysis
from app.services.analysis.side_by_side import compare_runs
from app.services.settings.analyst_mode import set_analyst_mode

D = Decimal
SETTINGS = get_settings()
SECRET_NOTE = "MY-PRIVATE-THESIS-7731"
BUFFETT_MARKER = "BUFFETT-OUTPUT-MARKER-4410"


def _session() -> Session:
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(engine)
    return Session(engine)


class _Market:
    name = "fake"

    def get_daily_price_history(self, ticker, *, days=400, currency_hint=None):
        start = datetime.now(timezone.utc) - timedelta(days=days)
        return [
            PricePoint(price=D(100) + D(i % 17), currency=currency_hint or "USD",
                       observed_at=start + timedelta(days=i), provider="fake")
            for i in range(0, days, 3)
        ]

    def get_current_price(self, ticker, *, currency_hint=None):  # pragma: no cover
        raise NotImplementedError


class _Research:
    name = "fake"

    def get_macro_research(self):
        return []


_VERDICT = {
    "rating": "Sell", "portfolio_role": "redundant", "thesis_bullets": ["a"], "top_risks": ["r"],
    "metrics_to_monitor": ["m"], "invalidation_triggers": ["t"], "evidence_ids": ["EV-001"],
}
_SECTION = {"summary": "s", "evidence_ids": ["EV-001"]}


class _DalioLLM:
    name = "dalio_fake"

    def __init__(self):
        self.calls = []

    def generate_structured(self, *, system_prompt, user_prompt, response_schema, max_output_tokens=None):
        self.calls.append((system_prompt, user_prompt, response_schema, max_output_tokens))
        if response_schema is DalioBlindPassOutputV1:
            content = DalioBlindPassOutputV1(
                debt_cycle={"short_term_phase": "late_expansion", "long_term_phase": "late_leveraging",
                            "summary": "s", "evidence_ids": ["EV-001"]},
                quadrant_fit={"favoured_environments": ["rising_inflation"], "summary": "s", "evidence_ids": ["EV-001"]},
                currency_risk=_SECTION, country_risk=_SECTION, internal_external_order=_SECTION,
                portfolio_role_and_diversification=_SECTION, verdict=_VERDICT,
            ).model_dump_json()
        else:
            assert response_schema is DalioReconciliationOutputV1
            content = DalioReconciliationOutputV1(
                verdict=_VERDICT, reconciliation_narrative="n", changed_from_blind=False, evidence_ids=["EV-002"]
            ).model_dump_json()
        return LLMResponse(content=content, usage=LLMUsageMetrics(provider=self.name, model="m", input_tokens=1,
                                                                   output_tokens=1, total_tokens=2))


def _own(db: Session, holdings: list[Holding]) -> None:
    doc = Document(type="portfolio_csv", original_filename="p.csv", mime_type="text/csv", size_bytes=1,
                   storage_path="p.csv", sha256="c" * 64, status="processed", quality_flags={})
    db.add(doc)
    db.flush()
    snap = PortfolioSnapshot(source_file=doc, reporting_currency="NOK", status="processed")
    db.add(snap)
    db.flush()
    for h in holdings:
        db.add(PortfolioPosition(snapshot_id=snap.id, holding_id=h.id, quantity=D(1)))
    db.commit()


def _gold(db: Session) -> Holding:
    h = Holding(ticker="4GLD.DE", name="Xetra-Gold", trading_currency="EUR", asset_class_raw="commodity_etc")
    db.add(h)
    db.commit()
    return h


def _buffett_run(db: Session, holding: Holding, *, rating: str = "Buy", when: datetime | None = None) -> EquityAnalysisRun:
    when = when or datetime.now(timezone.utc)
    run = EquityAnalysisRun(
        holding_id=holding.id, status="COMPLETED", schema_version="v1", blind_prompt_version="v2",
        evidence_packet_version="v7", evidence_packet_json={"items": [{"id": "EV-001", "content": BUFFETT_MARKER}]},
        evidence_unavailable_reasons=[], started_at=when, completed_at=when,
        blind_pass_json={"verdict": {"rating": rating}, "moat": {"overall_rating": "Wide"}, "note": BUFFETT_MARKER},
        persona="buffett_munger",
    )
    db.add(run)
    db.commit()
    return run


def _run_dalio(db, holding, llm):
    return run_full_analysis(
        db, holding, llm_provider=llm, llm_fallback_provider=None, market_data_provider=_Market(),
        risk_free_rate_provider=None, research_provider=_Research(), persona="dalio",
    )


def test_dalio_run_on_a_gold_etc_completes_with_no_price_target():
    db = _session()
    gold = _gold(db)
    _own(db, [gold])
    run = _run_dalio(db, gold, _DalioLLM())
    assert run.status == "COMPLETED"
    assert run.persona == "dalio"
    assert run.schema_version == "dalio_v1"
    assert run.evidence_packet_version == "dalio-v1"
    assert run.price_target_low is None and run.price_target_high is None
    assert run_portfolio_role(run) == "redundant"
    assert any("price target: n/a" in r for r in run.evidence_unavailable_reasons)
    categories = {i["category"] for i in run.evidence_packet_json["items"]}
    assert {"quadrant", "rates", "diversification", "currency", "country_risk", "gold", "regime"} <= categories


def test_dalio_blind_pass_sees_neither_notes_nor_buffett_output():
    db = _session()
    gold = _gold(db)
    _own(db, [gold])
    _buffett_run(db, gold)
    set_holding_note(db, gold.id, SECRET_NOTE)
    llm = _DalioLLM()
    _run_dalio(db, gold, llm)
    blind = next(c for c in llm.calls if c[2] is DalioBlindPassOutputV1)
    recon = next(c for c in llm.calls if c[2] is DalioReconciliationOutputV1)
    assert SECRET_NOTE not in blind[0] + blind[1]
    assert BUFFETT_MARKER not in blind[0] + blind[1]
    assert BUFFETT_MARKER not in recon[1]
    assert SECRET_NOTE in recon[1]  # the reconciliation pass is where notes belong
    assert blind[3] == SETTINGS.llm_max_output_tokens_dalio


def test_latest_run_lookups_default_to_buffett():
    db = _session()
    gold = _gold(db)
    _own(db, [gold])
    _run_dalio(db, gold, _DalioLLM())
    assert latest_runs_by_holding(db, [gold.id]) == {}
    assert gold.id in latest_runs_by_holding(db, [gold.id], persona="dalio")


def test_gold_country_risk_is_a_stated_gap_without_look_through():
    db = _session()
    gold = _gold(db)
    run = _run_dalio(db, gold, _DalioLLM())
    assert any("ECON-F22-08" in r for r in run.evidence_unavailable_reasons)


def test_queue_persona_both_queues_dalio_for_a_commodity_but_not_buffett():
    db = _session()
    gold = _gold(db)
    _own(db, [gold])
    result = queue.queue_ready_holdings(db, settings=SETTINGS, persona="both")
    assert [r.persona for r in result.queued] == ["dalio"]
    again = queue.queue_ready_holdings(db, settings=SETTINGS, persona="dalio")
    assert len(again.already_queued) == 1 and not again.queued


def test_auto_queue_does_nothing_outside_side_by_side():
    db = _session()
    gold = _gold(db)
    result = auto_queue.auto_queue_missing(db, [gold], settings=SETTINGS)
    assert result.mode == "buffett_munger" and result.actions == []


def test_auto_queue_queues_missing_partner_locally_and_dedupes():
    db = _session()
    stock = Holding(ticker="EQNR.OL", name="Equinor", trading_currency="NOK", asset_class_raw="stock")
    db.add(stock)
    db.commit()
    _buffett_run(db, stock)
    set_analyst_mode(db, "side_by_side")

    first = auto_queue.auto_queue_missing(db, [stock], settings=SETTINGS)
    queued = first.queued
    assert [(a.persona, a.action) for a in queued] == [("dalio", "queued")]
    run = db.get(EquityAnalysisRun, queued[0].run_id)
    assert run.engine == "local" and run.auto_queued and run.persona == "dalio"

    second = auto_queue.auto_queue_missing(db, [stock], settings=SETTINGS)
    assert not second.queued
    assert any(a.action == "already_pending" and a.persona == "dalio" for a in second.actions)


def test_auto_queue_respects_the_nightly_cap():
    db = _session()
    holdings = [Holding(ticker=f"T{i}.OL", name=f"T{i}", trading_currency="NOK", asset_class_raw="commodity_etc")
                for i in range(3)]
    db.add_all(holdings)
    db.commit()
    set_analyst_mode(db, "side_by_side")
    capped = SETTINGS.model_copy(update={"f22_auto_queue_nightly_cap": 2})
    result = auto_queue.auto_queue_missing(db, holdings, settings=capped)
    assert len(result.queued) == 2
    assert [a.action for a in result.actions if a.persona == "dalio"].count("cap_reached") == 1


def test_auto_queue_requeues_a_partner_older_than_the_stale_window():
    db = _session()
    stock = Holding(ticker="EQNR.OL", name="Equinor", trading_currency="NOK", asset_class_raw="stock")
    db.add(stock)
    db.commit()
    now = datetime.now(timezone.utc)
    _buffett_run(db, stock, when=now)
    old = EquityAnalysisRun(
        holding_id=stock.id, status="COMPLETED", schema_version="dalio_v1", blind_prompt_version="dalio_v1",
        evidence_packet_version="dalio-v1", evidence_packet_json={}, evidence_unavailable_reasons=[],
        started_at=now - timedelta(days=45), completed_at=now - timedelta(days=45),
        blind_pass_json={"verdict": {"rating": "Hold", "portfolio_role": "diversifier"}}, persona="dalio",
    )
    db.add(old)
    db.commit()
    wanted, why = auto_queue.needs_partner(old, latest_runs_by_holding(db, [stock.id])[stock.id], stale_days=30)
    assert wanted and "45 days older" in why


def test_compare_runs_flags_disagreement_and_role_tension():
    db = _session()
    stock = Holding(ticker="X", name="X", trading_currency="USD", asset_class_raw="stock")
    db.add(stock)
    db.commit()
    buffett = _buffett_run(db, stock, rating="Strong Buy")
    dalio = EquityAnalysisRun(
        holding_id=stock.id, status="COMPLETED", schema_version="dalio_v1", blind_prompt_version="dalio_v1",
        evidence_packet_version="dalio-v1", evidence_packet_json={}, evidence_unavailable_reasons=[],
        blind_pass_json={"verdict": {"rating": "Sell", "portfolio_role": "redundant"}}, persona="dalio",
    )
    comp = compare_runs(buffett, dalio)
    assert comp.agreement == "disagree" and comp.verdict_gap == -3
    assert any("Tension" in p for p in comp.points)
    assert compare_runs(buffett, None).agreement == "incomplete"


def test_quadrant_and_rate_betas_are_computed_from_stored_macro_history():
    from app.models.macro import MacroObservation
    from app.services.dalio.holding_analytics import cycle_profile

    db = _session()
    now = datetime.now(timezone.utc)
    # 40 months of month-end macro observations.
    for i in range(40):
        when = (now.replace(day=1) - timedelta(days=31 * (39 - i))).replace(day=28, hour=0, minute=0, second=0, microsecond=0)
        for key, value, unit in (
            ("us_cpi_yoy", D(300) + D(i) + D(i % 4), "index"),
            ("us_unemployment", D(4) + D(i % 5) / 10, "percent"),
            ("us_10y", D(4) + D(i % 3) / 10, "percent"),
        ):
            db.add(MacroObservation(series_key=key, provider="fred", region="US", value=value, unit=unit,
                                    observed_at=when, retrieved_at=now, source_series_id=key))
    db.commit()
    profile = cycle_profile(db, _Market(), ticker="SPY", trading_currency="USD")
    assert profile.growth.available and profile.rates_us.available
    assert profile.inflation.n_months >= 24  # y/y needs 12 months of index first, still enough overlap
    assert not profile.rates_no.available  # no Norway 10y stored -> stated, not guessed
