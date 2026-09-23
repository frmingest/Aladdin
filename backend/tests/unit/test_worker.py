"""Sprint 5B (F8 + F5): the local worker loop end to end against fake
providers — a run queued by the server is claimed, executed on the same
row and completed; a stopped LLM or an empty Gemini budget leaves the
queue untouched; a crash fails the run visibly and the worker survives."""
from __future__ import annotations

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.config.settings import Settings
from app.models import Base, Holding
from app.models.analysis import AnalysisWorkerHeartbeat, EquityAnalysisRun
from app.providers.budget import DailyBudgetGuard
from app.services.analysis import queue
from app.services.analysis.notes import set_holding_note
from app.worker.runner import (
    IDLE,
    LLM_UNAVAILABLE,
    RAN,
    WAITING_QUOTA,
    AnalysisWorker,
    LLMHealth,
    WorkerProviders,
)
from tests.unit.test_analysis_pipeline import (
    _FakeMarket,
    _FakeRate,
    _FakeResearch,
    _RecordingLLM,
    _stock_holding,
    _with_two_periods,
)

SETTINGS = Settings(_env_file=None, worker_poll_seconds=0, worker_heartbeat_seconds=3600)


def _factory():
    engine = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
    Base.metadata.create_all(engine)
    return sessionmaker(bind=engine, autoflush=False, autocommit=False)


def _worker(factory, *, llm=None, health=None, budget=None) -> AnalysisWorker:
    providers = WorkerProviders(
        llm=llm or _RecordingLLM(),
        llm_fallback=None,
        market_data=_FakeMarket(),
        risk_free_rate=_FakeRate(),
        research=_FakeResearch(),
        announcements=None,
        budget_guard=budget,
    )
    return AnalysisWorker(
        session_factory=factory, settings=SETTINGS, providers=providers, worker_id="pc-1",
        hostname="DESKTOP", model_name="qwen3:14b", llm_health_check=health,
    )


def _queued_holding(factory, notes: str | None = None):
    with factory() as db:
        holding = _stock_holding()
        db.add(holding)
        db.commit()
        _with_two_periods(db, holding)
        if notes:
            set_holding_note(db, holding.id, notes)
        run, _ = queue.enqueue_local_run(db, holding, settings=SETTINGS)
        return holding.id, run.id


def test_worker_completes_the_queued_run_in_place():
    factory = _factory()
    _holding_id, run_id = _queued_holding(factory, notes="MY SECRET THESIS")
    llm = _RecordingLLM()
    worker = _worker(factory, llm=llm)

    assert worker.run_once() == RAN

    with factory() as db:
        runs = db.query(EquityAnalysisRun).all()
        assert len(runs) == 1  # the queued row itself, not a new one
        run = runs[0]
        assert run.id == run_id
        assert run.status == "COMPLETED"
        assert run.engine == "local" and run.claimed_by == "pc-1" and run.attempts == 1
        assert run.provider == "recording_llm"
        assert run.evidence_packet_json["items"]
        assert run.price_target_low is not None
    # CLAUDE.md Rule 4 still holds on the worker path.
    blind_prompt = llm.calls[0][1]
    assert "MY SECRET THESIS" not in blind_prompt
    assert "MY SECRET THESIS" in llm.calls[1][1]


def test_idle_when_queue_empty_and_heartbeat_written():
    factory = _factory()
    worker = _worker(factory)
    assert worker.run_once() == IDLE
    worker.beat()
    with factory() as db:
        beat = db.get(AnalysisWorkerHeartbeat, "pc-1")
        assert beat.state == "idle" and beat.model_name == "qwen3:14b" and beat.hostname == "DESKTOP"


def test_llm_down_leaves_the_run_queued():
    factory = _factory()
    _h, run_id = _queued_holding(factory)
    worker = _worker(factory, health=lambda: LLMHealth(False, "Ollama not reachable"))
    assert worker.run_once() == LLM_UNAVAILABLE
    with factory() as db:
        assert db.get(EquityAnalysisRun, run_id).status == "QUEUED"
        beat = db.get(AnalysisWorkerHeartbeat, "pc-1")
        assert beat.state == "llm_unavailable" and "not reachable" in beat.detail


def test_empty_gemini_budget_waits_instead_of_running_on_stale_research():
    factory = _factory()
    _h, run_id = _queued_holding(factory)
    worker = _worker(factory, budget=DailyBudgetGuard(daily_limit=0))
    assert worker.run_once() == WAITING_QUOTA
    with factory() as db:
        assert db.get(EquityAnalysisRun, run_id).status == "QUEUED"
        assert "00:00 UTC" in db.get(AnalysisWorkerHeartbeat, "pc-1").detail


class _ExplodingLLM:
    name = "exploding"

    def generate_structured(self, **_kwargs):
        raise RuntimeError("GPU on fire")


def test_crash_fails_the_run_visibly_and_worker_goes_on():
    factory = _factory()
    _h, run_id = _queued_holding(factory)
    worker = _worker(factory, llm=_ExplodingLLM())
    assert worker.run_once() == RAN
    assert worker.run_once() == IDLE
    with factory() as db:
        run = db.get(EquityAnalysisRun, run_id)
        assert run.status == "FAILED"
        assert "GPU on fire" in run.error_message


def test_holding_retagged_as_non_equity_fails_run():
    factory = _factory()
    holding_id, run_id = _queued_holding(factory)
    with factory() as db:
        db.get(Holding, holding_id).asset_class_raw = "bond_fund"
        db.commit()
    assert _worker(factory).run_once() == RAN
    with factory() as db:
        run = db.get(EquityAnalysisRun, run_id)
        assert run.status == "FAILED" and "not analyzable" in run.error_message


def test_run_forever_once_recovers_own_runs_and_marks_stopped():
    factory = _factory()
    _h, run_id = _queued_holding(factory)
    with factory() as db:
        queue.claim_next_run(db, "pc-1")  # left RUNNING by a "crashed" previous process

    _worker(factory).run_forever(once=True)

    with factory() as db:
        run = db.get(EquityAnalysisRun, run_id)
        # recovered to QUEUED on start-up, then picked up again and finished
        assert run.status == "COMPLETED" and run.attempts == 2
        assert db.get(AnalysisWorkerHeartbeat, "pc-1").state == "stopped"
