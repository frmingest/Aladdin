"""Newsweb watch endpoints (2026-10-28): list unread, acknowledge, scheduler switch."""
from __future__ import annotations

from datetime import datetime, timezone

from app.config.database import get_db
from app.config.settings import Settings
from app.main import app
from app.models import Holding
from app.models.newsweb_announcement import NewswebAnnouncement
from app.services.filings.newsweb_watch_scheduler import NewswebWatchScheduler

NOW = datetime(2026, 10, 28, 12, 0, tzinfo=timezone.utc)


def _seed(client) -> tuple[str, str]:
    db_gen = app.dependency_overrides[get_db]()
    db = next(db_gen)
    try:
        holding = Holding(
            ticker="EQNR.OL", name="Equinor ASA", trading_currency="NOK", sector="Energy", asset_class_raw="stock"
        )
        db.add(holding)
        db.flush()
        for message_id, ack in (("1", None), ("2", NOW)):
            db.add(
                NewswebAnnouncement(
                    holding_id=holding.id,
                    message_id=message_id,
                    title=f"Announcement {message_id}",
                    summary="Regulated announcement.",
                    source_url=f"https://newsweb.oslobors.no/message/{message_id}",
                    published_at=NOW,
                    first_seen_at=NOW,
                    acknowledged_at=ack,
                )
            )
        db.commit()
        return str(holding.id), holding.ticker
    finally:
        db.close()


def test_new_announcements_lists_only_unread_and_acknowledge_clears_them(client) -> None:
    holding_id, _ = _seed(client)

    body = client.get("/sources/newsweb/new").json()
    assert body["count"] == 1
    assert body["items"][0]["ticker"] == "EQNR.OL"
    assert body["items"][0]["title"] == "Announcement 1"

    resp = client.post("/sources/newsweb/acknowledge", json={"holding_id": holding_id})
    assert resp.status_code == 200 and resp.json() == {"acknowledged": 1}
    assert client.get("/sources/newsweb/new").json()["count"] == 0


def test_acknowledge_without_body_fields_marks_everything(client) -> None:
    _seed(client)
    assert client.post("/sources/newsweb/acknowledge", json={}).json() == {"acknowledged": 1}


def test_scheduler_is_off_without_database_or_when_interval_is_zero() -> None:
    base = {"_env_file": None, "announcements_provider": "newsweb"}
    assert not NewswebWatchScheduler(Settings(**base, database_url=None)).enabled
    assert not NewswebWatchScheduler(
        Settings(**base, database_url="sqlite://", newsweb_watch_interval_minutes=0)
    ).enabled
    assert not NewswebWatchScheduler(
        Settings(_env_file=None, announcements_provider="none", database_url="sqlite://")
    ).enabled
    assert NewswebWatchScheduler(Settings(**base, database_url="sqlite://")).enabled
