"""Sprint 5B (F8 + F5): the local-worker queue — enqueue, claim, cancel,
lease expiry, restart recovery and worker status. SQLite in-memory; the
FOR UPDATE SKIP LOCKED hint is a no-op there, the compare-and-set UPDATE
is what's under test."""
from __future__ import annotations

from datetime import datetime, timedelta, timezone
from decimal import Decimal

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import Session

from app.config.settings import Settings
from app.models import Base, Document, FinancialLineItem, Holding
from app.models.analysis import EquityAnalysisRun
from app.models.portfolio import PortfolioPosition, PortfolioSnapshot
from app.services.analysis import queue
from app.services.analysis.pipeline import NotEquityAnalyzableError

NOW = datetime(2026, 9, 23, 22, 0, tzinfo=timezone.utc)
LEASE = timedelta(minutes=30)
SETTINGS = Settings(_env_file=None, worker_online_seconds=120)


def _session() -> Session:
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(engine)
    return Session(engine)


def _holding(db: Session, ticker: str = "AAPL", **kw) -> Holding:
    defaults = {"name": f"{ticker} Inc.", "trading_currency": "USD", "sector": "Technology", "asset_class_raw": "stock"}
    defaults.update(kw)
    holding = Holding(ticker=ticker, **defaults)
    db.add(holding)
    db.commit()
    return holding


def _queue(db: Session, holding: Holding, at: datetime = NOW) -> EquityAnalysisRun:
    run, created = queue.enqueue_local_run(db, holding, settings=SETTINGS, now=at)
    assert created
    return run


def test_enqueue_creates_a_queued_local_run():
    db = _session()
    run = _queue(db, _holding(db))
    assert run.status == "QUEUED"
    assert run.engine == "local"
    assert run.attempts == 0
    assert run.claimed_by is None
    assert run.evidence_packet_json == {}


def test_enqueue_twice_returns_the_existing_pending_run():
    db = _session()
    holding = _holding(db)
    first = _queue(db, holding)
    again, created = queue.enqueue_local_run(db, holding, settings=SETTINGS)
    assert not created
    assert again.id == first.id


def test_enqueue_rejects_non_equity():
    db = _session()
    bond = _holding(db, "BND", asset_class_raw="bond_fund")
    with pytest.raises(NotEquityAnalyzableError):
        queue.enqueue_local_run(db, bond, settings=SETTINGS)


def test_claim_takes_the_oldest_and_never_twice():
    db = _session()
    newer = _queue(db, _holding(db, "MSFT"), at=NOW)
    older = _queue(db, _holding(db, "AAPL"), at=NOW - timedelta(minutes=5))

    first = queue.claim_next_run(db, "pc-1", now=NOW)
    assert first is not None and first.id == older.id
    assert first.status == "RUNNING"
    assert first.claimed_by == "pc-1"
    assert first.attempts == 1

    second = queue.claim_next_run(db, "pc-2", now=NOW)
    assert second is not None and second.id == newer.id
    assert queue.claim_next_run(db, "pc-1", now=NOW) is None


def test_claim_ignores_cloud_runs():
    db = _session()
    holding = _holding(db)
    db.add(EquityAnalysisRun(
        holding_id=holding.id, status="QUEUED", engine="cloud", schema_version="v1",
        blind_prompt_version="v1", evidence_packet_version="v3", evidence_packet_json={},
        evidence_unavailable_reasons=[],
    ))
    db.commit()
    assert queue.claim_next_run(db, "pc-1") is None


def test_cancel_only_while_queued():
    db = _session()
    run = _queue(db, _holding(db))
    cancelled = queue.cancel_run(db, run)
    assert cancelled.status == "CANCELLED"
    assert queue.list_queue(db) == []

    running = _queue(db, _holding(db, "MSFT"))
    queue.claim_next_run(db, "pc-1")
    db.refresh(running)
    with pytest.raises(queue.RunNotCancellableError):
        queue.cancel_run(db, running)


def test_stale_run_is_requeued_then_failed_after_max_attempts():
    db = _session()
    run = _queue(db, _holding(db))
    queue.record_heartbeat(db, "pc-1", state="running", now=NOW - timedelta(hours=1))
    queue.claim_next_run(db, "pc-1", now=NOW - timedelta(hours=1))

    released = queue.release_stale_runs(db, lease=LEASE, max_attempts=2, now=NOW)
    assert released == [(run.id, "requeued")]
    db.refresh(run)
    assert run.status == "QUEUED" and run.claimed_by is None and run.attempts == 1
    assert "stopped responding" in run.error_message

    queue.claim_next_run(db, "pc-1", now=NOW)
    released = queue.release_stale_runs(db, lease=LEASE, max_attempts=2, now=NOW + timedelta(hours=2))
    assert released == [(run.id, "failed")]
    db.refresh(run)
    assert run.status == "FAILED"
    assert "Gave up after 2 attempt(s)" in run.error_message


def test_run_with_a_live_worker_is_not_released():
    db = _session()
    _queue(db, _holding(db))
    queue.claim_next_run(db, "pc-1", now=NOW)
    queue.record_heartbeat(db, "pc-1", state="running", now=NOW - timedelta(minutes=1))
    assert queue.release_stale_runs(db, lease=LEASE, max_attempts=2, now=NOW) == []


def test_run_claimed_by_a_worker_without_heartbeat_is_released():
    db = _session()
    run = _queue(db, _holding(db))
    queue.claim_next_run(db, "ghost", now=NOW)
    assert queue.release_stale_runs(db, lease=LEASE, max_attempts=2, now=NOW) == [(run.id, "requeued")]


def test_recover_own_runs_on_restart():
    db = _session()
    mine = _queue(db, _holding(db, "AAPL"), at=NOW - timedelta(minutes=2))
    theirs = _queue(db, _holding(db, "MSFT"), at=NOW)
    queue.claim_next_run(db, "pc-1")
    queue.claim_next_run(db, "pc-2")

    assert queue.recover_own_runs(db, "pc-1", max_attempts=2) == [(mine.id, "requeued")]
    db.refresh(mine)
    db.refresh(theirs)
    assert mine.status == "QUEUED"
    assert theirs.status == "RUNNING"


def test_requeue_interrupted_run_does_not_count_the_attempt():
    db = _session()
    run = _queue(db, _holding(db))
    queue.claim_next_run(db, "pc-1")
    queue.requeue_interrupted_run(db, run.id, reason="stopped")
    db.refresh(run)
    assert run.status == "QUEUED" and run.attempts == 0 and run.error_message == "stopped"


def test_fail_run_records_the_message():
    db = _session()
    run = _queue(db, _holding(db))
    queue.claim_next_run(db, "pc-1")
    queue.fail_run(db, run.id, message="worker error: boom")
    db.refresh(run)
    assert run.status == "FAILED" and run.error_message == "worker error: boom"


def test_worker_statuses_online_offline_and_stopped():
    db = _session()
    queue.record_heartbeat(db, "fresh", state="idle", model_name="qwen3:14b", now=NOW - timedelta(seconds=30))
    queue.record_heartbeat(db, "old", state="idle", now=NOW - timedelta(minutes=10))
    queue.record_heartbeat(db, "stopped", state="stopped", now=NOW - timedelta(seconds=5))
    by_id = {w.worker_id: w for w in queue.worker_statuses(db, settings=SETTINGS, now=NOW)}
    assert by_id["fresh"].online and by_id["fresh"].model_name == "qwen3:14b"
    assert not by_id["old"].online
    assert not by_id["stopped"].online


def test_record_heartbeat_upserts():
    db = _session()
    queue.record_heartbeat(db, "pc-1", state="idle", hostname="DESKTOP", now=NOW - timedelta(minutes=1))
    queue.record_heartbeat(db, "pc-1", state="running", now=NOW)
    statuses = queue.worker_statuses(db, settings=SETTINGS, now=NOW)
    assert len(statuses) == 1
    assert statuses[0].state == "running" and statuses[0].hostname == "DESKTOP"


def _own(db: Session, holdings: list[Holding]) -> None:
    """One snapshot (no account) holding every given position."""
    doc = Document(type="portfolio_csv", original_filename="p.csv", mime_type="text/csv", size_bytes=1,
                   storage_path="p.csv", sha256="c" * 64, status="processed", quality_flags={})
    db.add(doc)
    db.flush()
    snap = PortfolioSnapshot(source_file=doc, reporting_currency="NOK", status="processed")
    db.add(snap)
    db.flush()
    for holding in holdings:
        db.add(PortfolioPosition(snapshot_id=snap.id, holding_id=holding.id, quantity=Decimal(1)))
    db.commit()


def _three_years(db: Session, holding: Holding) -> None:
    doc = Document(holding=holding, type="filing", original_filename="10k.pdf", mime_type="application/pdf",
                   size_bytes=1, storage_path="10k.pdf", sha256=("f" + holding.ticker).ljust(64, "0")[:64],
                   status="processed", quality_flags={})
    db.add(doc)
    db.flush()
    for period in ("FY2023", "FY2024", "FY2025"):
        for metric in ("net_income", "total_equity"):
            db.add(FinancialLineItem(document=doc, holding=holding, metric=metric, value=Decimal(1),
                                     unit="USD", currency="USD", period=period, confidence=0.9))
    db.commit()


def test_queue_ready_holdings_skips_blocked_and_already_queued():
    db = _session()
    ready = _holding(db, "AAPL")
    _three_years(db, ready)
    no_financials = _holding(db, "MSFT")
    bond = _holding(db, "BND", asset_class_raw="bond_fund")
    already = _holding(db, "KO")
    _three_years(db, already)
    _own(db, [ready, no_financials, bond, already])
    existing = _queue(db, already)

    result = queue.queue_ready_holdings(db, settings=SETTINGS)

    assert [r.holding_id for r in result.queued] == [ready.id]
    assert [r.id for r in result.already_queued] == [existing.id]
    assert [h.ticker for h, _ in result.skipped] == ["MSFT"]
    assert "Financial history" in result.skipped[0][1]
