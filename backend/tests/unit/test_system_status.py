"""Unit tests for app.services.system_status (feature F4)."""
from __future__ import annotations

import json
from dataclasses import asdict
from datetime import datetime, timedelta, timezone

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import Session

from app.config.settings import Settings
from app.models import Base, Holding
from app.models.analysis import EquityAnalysisRun
from app.models.market import MarketObservation
from app.providers.budget import DailyBudgetGuard
from app.services import system_status as module
from app.services.system_status import build_system_status, migration_head

NOW = datetime(2026, 9, 23, 12, tzinfo=timezone.utc)


@pytest.fixture()
def db():
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(engine)
    with Session(engine) as session:
        yield session


def _settings(**overrides) -> Settings:
    base = {"_env_file": None, "google_ai_studio_api_key": "sk-very-secret", "fred_api_key": "fred-secret",
            "sec_edgar_user_agent": "Aladdin test@example.com"}
    base.update(overrides)
    return Settings(**base)


def _by_key(items):
    return {i.key: i for i in items}


def test_secrets_are_never_returned(db):
    status = build_system_status(db, _settings(), DailyBudgetGuard(daily_limit=20), now=NOW)
    dumped = json.dumps(asdict(status), default=str)
    assert "sk-very-secret" not in dumped
    assert "fred-secret" not in dumped
    assert _by_key(status.providers)["llm"].detail == "API key set"
    assert status.issues == []


def test_missing_key_and_unknown_provider_are_errors(db):
    status = build_system_status(
        db, _settings(google_ai_studio_api_key=None, market_data_provider="stub"),
        DailyBudgetGuard(daily_limit=20), now=NOW,
    )
    providers = _by_key(status.providers)
    assert providers["llm"].status == "error"
    assert providers["market_data"].status == "error"
    assert any("Prices" in issue for issue in status.issues)


def test_localhost_ollama_on_deployed_server_warns(db):
    status = build_system_status(db, _settings(llm_provider="ollama", environment="production"),
                                 DailyBudgetGuard(daily_limit=20), now=NOW)
    assert _by_key(status.providers)["llm"].status == "warn"


def test_freshness_and_stuck_runs(db):
    h = Holding(ticker="A.OL", name="A", trading_currency="NOK")
    db.add(h)
    db.flush()
    db.add(MarketObservation(holding_id=h.id, observed_at=NOW - timedelta(days=3), price=1, currency="NOK",
                             provider="yfinance"))
    db.add(EquityAnalysisRun(holding_id=h.id, status="RUNNING", schema_version="v1", blind_prompt_version="v1",
                             evidence_packet_version="v3", evidence_packet_json=[], evidence_unavailable_reasons=[],
                             started_at=NOW - timedelta(hours=3)))
    db.add(EquityAnalysisRun(holding_id=h.id, status="FAILED", schema_version="v1", blind_prompt_version="v1",
                             evidence_packet_version="v3", evidence_packet_json=[], evidence_unavailable_reasons=[],
                             started_at=NOW - timedelta(days=1), error_message="429 quota"))
    db.commit()
    status = build_system_status(db, _settings(), DailyBudgetGuard(daily_limit=20), now=NOW)
    fresh = _by_key(status.freshness)
    assert fresh["prices"].status == "warn"  # 3 days > 24 h window
    assert fresh["macro"].last_at is None
    analysis = _by_key(status.analysis)
    assert analysis["stuck"].value == "1"
    assert analysis["failed_7d"].value == "1"
    assert status.counts["holdings"] == 1
    assert any("Stuck" in issue for issue in status.issues)


def test_migration_mismatch_is_an_issue(db, monkeypatch):
    monkeypatch.setattr(module, "_migration_current", lambda _db: "old123")
    status = build_system_status(db, _settings(), DailyBudgetGuard(daily_limit=20), now=NOW)
    assert any("alembic upgrade head" in issue for issue in status.issues)


def test_migration_head_reads_the_code():
    assert migration_head()  # a real revision id from alembic/versions


def test_local_worker_and_queue_are_reported(db):
    from app.services.analysis import queue

    holding = Holding(ticker="AAPL", name="Apple", trading_currency="USD", asset_class_raw="stock")
    db.add(holding)
    db.commit()
    queue.enqueue_local_run(db, holding, settings=_settings(), now=NOW)

    status = build_system_status(db, _settings(), DailyBudgetGuard(daily_limit=20), now=NOW)
    items = _by_key(status.analysis)
    assert items["queued_local"].value == "1"
    assert items["local_worker"].value == "never started" and items["local_worker"].status == "warn"

    queue.record_heartbeat(db, "pc-1", state="idle", model_name="qwen3:14b", now=NOW - timedelta(seconds=20))
    items = _by_key(build_system_status(db, _settings(), DailyBudgetGuard(daily_limit=20), now=NOW).analysis)
    assert items["local_worker"].status == "ok" and items["local_worker"].value == "pc-1: idle"

    items = _by_key(build_system_status(
        db, _settings(), DailyBudgetGuard(daily_limit=20), now=NOW + timedelta(hours=1)).analysis)
    assert items["local_worker"].value == "pc-1: offline" and items["local_worker"].status == "warn"
