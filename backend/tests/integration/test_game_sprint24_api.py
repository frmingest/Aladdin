"""Sprint 24 over the real routes and a database: G14a nightly frame, G14
Chronicle, G15 Ravens, G16 Night Watch (2026-10-04). Read-only, demo mode
wins, unknown stays unknown."""
from __future__ import annotations

from datetime import date, datetime, timedelta, timezone
from decimal import Decimal

from app.models import Document, Holding
from app.models.account import Account
from app.models.app_setting import AppSetting
from app.models.financial_line_item import FinancialLineItem
from app.models.portfolio import PortfolioPosition, PortfolioSnapshot
from app.models.snapshot import ComputedSnapshot
from app.models.thesis import ThesisTripwire
from app.services.game import history
from app.services.game.state import get_game_state
from tests.integration.test_game_api import _seed

D = Decimal
NOW = datetime.now(timezone.utc)


def _holding(db, ticker):
    return db.query(Holding).filter_by(ticker=ticker).one()


# --- G14a --------------------------------------------------------------------


def test_run_if_due_stores_one_frame_per_day_and_not_before_the_hour(db_session):
    _seed(db_session)
    early = NOW.replace(hour=2, minute=0)
    late = NOW.replace(hour=6, minute=0)
    kwargs = {"hour_utc": 5, "version": "v1"}
    assert history.run_if_due(db_session, now=early, **kwargs) is False
    assert history.stored_days(db_session) == []
    assert history.run_if_due(db_session, now=late, **kwargs) is True
    assert history.stored_days(db_session) == [late.date()]
    # already stored today: nothing to do, the stored row is left alone
    row = db_session.get(ComputedSnapshot, history.frame_key(late.date()))
    stamp = row.computed_at
    assert history.run_if_due(db_session, now=late + timedelta(hours=1), **kwargs) is False
    db_session.expire_all()
    assert db_session.get(ComputedSnapshot, history.frame_key(late.date())).computed_at == stamp
    assert row.fingerprint == history.FINGERPRINT


def test_stored_frame_round_trips_the_real_state(db_session):
    _seed(db_session)
    state = get_game_state(db_session, "v1", now=NOW)
    assert history.store_frame(db_session, state, day=NOW.date(), now=NOW)
    ((day, _, loaded),) = history.load_frames(db_session)
    assert day == NOW.date() and {t.ticker for t in loaded.towers} == {t.ticker for t in state.towers}


def test_old_frames_are_thinned_not_cut_off_and_unreadable_ones_skipped(db_session):
    _seed(db_session)
    state = get_game_state(db_session, "v1", now=NOW)
    today = date(2026, 10, 9)  # fixed: week and month boundaries must not depend on the clock
    # 600 days old: past any daily/weekly need but alone in its month, so kept for ever.
    # 200 and 199 days old fall in one ISO week and month (2026-03-23/24): only the later survives.
    for age in (0, 10, 600, 200, 199):
        history.store_frame(db_session, state, day=today - timedelta(days=age), now=NOW)
    db_session.add(ComputedSnapshot(key=history.frame_key(today - timedelta(days=5)), payload="{not json",
                                    fingerprint="x", computed_at=NOW))
    db_session.commit()
    assert history.prune(db_session, today=today) == 1
    assert history.prune(db_session, today=today) == 0  # idempotent
    assert history.stored_days(db_session) == [
        today - timedelta(days=600), today - timedelta(days=199), today - timedelta(days=10),
        today - timedelta(days=5), today,
    ]
    # the unreadable frame is kept on disk but never replayed
    assert [d for d, _, _ in history.load_frames(db_session)] == [
        today - timedelta(days=600), today - timedelta(days=199), today - timedelta(days=10), today,
    ]


def test_demo_mode_is_never_stored(client, db_session):
    _seed(db_session)
    assert client.put("/settings/demo-mode", json={"enabled": True}).status_code == 200
    assert history.run_if_due(db_session, now=NOW.replace(hour=6), hour_utc=5, version="v1") is False
    assert history.stored_days(db_session) == []


# --- G14 ---------------------------------------------------------------------


def test_empty_chronicle(client):
    body = client.get("/game/chronicle").json()
    assert body["frames"] == [] and "no portfolio snapshot" in " ".join(body["notes"])


def test_chronicle_replays_imports_then_stored_frames(client, db_session):
    account = _seed(db_session)
    # An older import (30 days ago) with only two of today's holdings.
    old_doc = Document(type="portfolio_export", original_filename="b.csv", mime_type="text/csv", size_bytes=1,
                       storage_path="b.csv", sha256="b" * 64, status="processed", quality_flags={})
    old = PortfolioSnapshot(source_file=old_doc, reporting_currency="NOK", status="processed", account=account,
                            uploaded_at=NOW - timedelta(days=30))
    db_session.add_all([old_doc, old])
    db_session.add_all([
        PortfolioPosition(snapshot=old, holding=_holding(db_session, "CASH.OL"), market_value_nok=D(600)),
        PortfolioPosition(snapshot=old, holding=_holding(db_session, "GEAR.OL"), market_value_nok=D(400)),
    ])
    db_session.commit()

    body = client.get("/game/chronicle").json()
    assert [f["source"] for f in body["frames"]] == ["positions_only", "positions_only"]
    first = body["frames"][0]
    assert {t["ticker"] for t in first["towers"]} == {"CASH.OL", "GEAR.OL"}
    weights = {t["ticker"]: D(t["weight_pct"]) for t in first["towers"]}
    assert weights == {"CASH.OL": D(60), "GEAR.OL": D(40)}
    assert all(t["wall"] == "unsurveyed" and t["land"] == "fog" for t in first["towers"])
    assert first["weather"] == "unsurveyed"
    kinds = {c["kind"] for c in body["changes"]}
    assert kinds == {"tower_added", "tower_resized"}                       # no wall / weather claims
    assert body["stored_frames"] == 0 and "No nightly frame" in " ".join(body["notes"])

    # Two stored frames: the second has a fired tripwire, so the breach shows.
    holding = _holding(db_session, "CASH.OL")
    state = get_game_state(db_session, "v1", now=NOW)
    history.store_frame(db_session, state, day=NOW.date() - timedelta(days=1), now=NOW)
    db_session.add(ThesisTripwire(holding_id=holding.id, metric="roic", operator="below", threshold=D("0.5"),
                                  label="ROIC below 50%", active=True, fired_at=NOW))
    db_session.commit()
    history.store_frame(db_session, get_game_state(db_session, "v1", now=NOW), day=NOW.date(), now=NOW)

    body = client.get("/game/chronicle").json()
    assert body["stored_frames"] == 2
    assert [f["source"] for f in body["frames"]] == ["positions_only", "stored", "stored"]
    assert body["first_stored_day"] == (NOW.date() - timedelta(days=1)).isoformat()
    assert any(c["kind"] == "thesis_changed" and c["text"] == "A tripwire fired on Cash Rich." for c in body["changes"])


def test_chronicle_is_read_only(client, db_session):
    _seed(db_session)
    before = (db_session.query(ComputedSnapshot).count(), db_session.query(AppSetting).count())
    client.get("/game/chronicle")
    client.get("/game/ravens")
    client.get("/game/night-watch")
    db_session.expire_all()
    assert (db_session.query(ComputedSnapshot).count(), db_session.query(AppSetting).count()) == before


# --- G15 ---------------------------------------------------------------------


def _clear_seed_facts(db):
    """_seed stores FY2025 facts "just now", which would raise ravens of their own."""
    db.query(FinancialLineItem).delete()
    db.commit()


def _period(db, holding, doc, period, *, created, **values):
    for metric, value in values.items():
        db.add(FinancialLineItem(document=doc, holding=holding, metric=metric, value=D(value), unit="NOK",
                                 currency="NOK", period=period, confidence=1.0, created_at=created))


def _report_doc(db, name, *, sha, doc_type="annual_report", holding=None, uploaded=None, period=None):
    doc = Document(type=doc_type, original_filename=name, mime_type="application/xhtml+xml", size_bytes=1,
                   storage_path=name, sha256=sha * 64, status="processed", quality_flags={}, holding=holding,
                   reporting_period=period, uploaded_at=uploaded or NOW)
    db.add(doc)
    return doc


def test_a_new_period_raises_a_raven_with_the_changes(client, db_session):
    _seed(db_session)
    _clear_seed_facts(db_session)
    holding = _holding(db_session, "GEAR.OL")
    old_doc = _report_doc(db_session, "fy24.xhtml", sha="c", holding=holding, uploaded=NOW - timedelta(days=400))
    new_doc = _report_doc(db_session, "fy25.xhtml", sha="d", holding=holding, uploaded=NOW - timedelta(days=2))
    # FY2024: ebit 200, ebitda 600, debt 600, revenue 2000, net income 100
    _period(db_session, holding, old_doc, "FY2024", created=NOW - timedelta(days=400), revenue="2000", operating_income="200", ebit="200",
            ebitda="600", total_debt="600", cash_and_equivalents="0", net_income="100")
    # FY2025: more profit, more debt
    _period(db_session, holding, new_doc, "FY2025", created=NOW - timedelta(days=2), revenue="2000", operating_income="500", ebit="500",
            ebitda="900", total_debt="2700", cash_and_equivalents="0", net_income="300")
    db_session.commit()

    body = client.get("/game/ravens").json()
    (raven,) = [r for r in body["ravens"] if r["ticker"] == "GEAR.OL"]
    assert raven["kind"] == "figures" and raven["period"] == "FY2025" and raven["previous_period"] == "FY2024"
    assert raven["id"] == f"fig:{holding.id}:FY2025" and raven["in_portfolio"] is True
    assert raven["document_id"] == str(new_doc.id) and raven["age_days"] == 2
    # G31: the raven carries what the reader needs to open its report
    assert raven["document_filename"] == "fy25.xhtml" and raven["document_type"] == new_doc.type
    by_metric = {line["metric"]: line for line in raven["lines"]}
    assert by_metric["operating_margin"]["direction"] == "better"      # 10% -> 25%
    assert "rose from 10.0% to 25.0%" in by_metric["operating_margin"]["text"]
    assert by_metric["net_debt_to_ebitda"]["direction"] == "worse"     # 1.0x -> 3.0x
    assert raven["better"] >= 1 and raven["worse"] >= 1
    assert raven["summary"].startswith("Against FY2024:")


def test_an_old_capture_and_a_backfill_raise_no_raven(client, db_session):
    _seed(db_session)
    _clear_seed_facts(db_session)
    holding = _holding(db_session, "GEAR.OL")
    doc = _report_doc(db_session, "fy25.xhtml", sha="e", holding=holding, uploaded=NOW - timedelta(days=100))
    _period(db_session, holding, doc, "FY2025", created=NOW - timedelta(days=100), ebit="500", ebitda="900")
    # an older year back-filled today does not make the newest period "new"
    back = _report_doc(db_session, "fy23.xhtml", sha="f", holding=holding, uploaded=NOW)
    _period(db_session, holding, back, "FY2023", created=NOW, ebit="100", ebitda="500")
    db_session.commit()
    body = client.get("/game/ravens").json()
    assert body["ravens"] == [] and "No report has been captured" in " ".join(body["notes"])


def test_first_report_on_file_has_nothing_to_compare(client, db_session):
    _seed(db_session)
    _clear_seed_facts(db_session)
    holding = _holding(db_session, "BARE.OL")
    doc = _report_doc(db_session, "fy25.xhtml", sha="1", holding=holding, uploaded=NOW)
    _period(db_session, holding, doc, "FY2025", created=NOW, ebit="500", ebitda="900")
    db_session.commit()
    (raven,) = client.get("/game/ravens").json()["ravens"]
    assert raven["previous_period"] is None and raven["lines"] == []
    assert raven["summary"] == "First report on file for this tower: nothing to compare with yet."


def test_a_report_without_figures_is_a_text_only_raven(client, db_session):
    _seed(db_session)
    _clear_seed_facts(db_session)
    holding = _holding(db_session, "CASH.OL")
    _report_doc(db_session, "h1.pdf", sha="2", doc_type="quarterly_report", holding=holding, uploaded=NOW - timedelta(days=3))
    _report_doc(db_session, "ar.pdf", sha="3", doc_type="annual_report", holding=holding, uploaded=NOW - timedelta(days=90))
    _report_doc(db_session, "x.csv", sha="4", doc_type="portfolio_export", holding=holding, uploaded=NOW)
    db_session.commit()
    (raven,) = client.get("/game/ravens").json()["ravens"]
    assert raven["kind"] == "text_only" and raven["lines"] == [] and raven["period"] is None
    assert "No figures were extracted" in raven["summary"] and "half-year or interim" in raven["summary"]
    assert raven["document_filename"] == "h1.pdf" and raven["document_type"] == "quarterly_report"


def test_a_bank_is_not_compared_on_industrial_measures(client, db_session):
    _seed(db_session)
    _clear_seed_facts(db_session)
    bank = _holding(db_session, "BANK.OL")
    d1 = _report_doc(db_session, "b24.xhtml", sha="5", holding=bank, uploaded=NOW - timedelta(days=400))
    d2 = _report_doc(db_session, "b25.xhtml", sha="6", holding=bank, uploaded=NOW)
    _period(db_session, bank, d1, "FY2024", created=NOW - timedelta(days=400), net_income="80", total_equity="800",
            revenue="400", ebitda="300", total_debt="1", cash_and_equivalents="0")
    _period(db_session, bank, d2, "FY2025", created=NOW, net_income="120", total_equity="850", revenue="420",
            ebitda="200", total_debt="9", cash_and_equivalents="0")
    db_session.commit()
    (raven,) = [r for r in client.get("/game/ravens").json()["ravens"] if r["ticker"] == "BANK.OL"]
    metrics = {line["metric"] for line in raven["lines"]}
    assert "net_debt_to_ebitda" not in metrics and "roic" not in metrics
    assert "roe" in metrics or "net_margin" in metrics


# --- G16 ---------------------------------------------------------------------


def test_night_watch_with_no_check_ever_run_is_unknown(client, db_session):
    _seed(db_session)
    body = client.get("/game/night-watch").json()
    assert body["status"] == "unknown" and body["watch_state"] == "never"
    assert body["frames_stored"] == 0 and body["lines"][0]["tone"] == "warning"


def test_night_watch_reports_overnight_fires_and_changes(client, db_session):
    _seed(db_session)
    holding = _holding(db_session, "GEAR.OL")
    db_session.add(AppSetting(key="tripwire_check_last_run", value=(NOW - timedelta(hours=4)).isoformat()))
    db_session.add(AppSetting(key="tripwire_check_last_summary", value="2 tripwire(s) on 1 holding(s), 1 newly fired, 0 cleared"))
    db_session.add(ThesisTripwire(holding_id=holding.id, metric="net_debt_to_ebitda", operator="above", threshold=D(2),
                                  label="Net debt / EBITDA above 2x", active=True, fired_at=NOW - timedelta(hours=3)))
    db_session.add(ThesisTripwire(holding_id=_holding(db_session, "CASH.OL").id, metric="roic", operator="below",
                                  threshold=D("0.01"), label="old firing", active=True, fired_at=NOW - timedelta(days=9)))
    db_session.add(ThesisTripwire(holding_id=holding.id, metric="roe", operator="below", threshold=D("0.01"),
                                  label="paused", active=False, fired_at=NOW - timedelta(hours=1)))
    db_session.commit()
    day1, day2 = NOW.date() - timedelta(days=1), NOW.date()
    history.store_frame(db_session, get_game_state(db_session, "v1", now=NOW), day=day1, now=NOW)
    db_session.add(PortfolioPosition(snapshot=db_session.query(PortfolioSnapshot).one(),
                                     holding=_holding(db_session, "FUND"), market_value_nok=D(100)))  # no-op duplicate holding guard
    db_session.rollback()
    history.store_frame(db_session, get_game_state(db_session, "v1", now=NOW), day=day2, now=NOW)

    body = client.get("/game/night-watch").json()
    assert body["status"] == "attention" and body["watch_state"] == "ok" and body["watch_age_hours"] == 4
    assert body["tripwires_firing"] == 2                                # the paused tripwire is not counted
    assert [f["ticker"] for f in body["fired_overnight"]] == ["GEAR.OL"]
    assert body["frames_stored"] == 2 and body["last_frame_day"] == day2.isoformat()
    texts = [line["text"] for line in body["lines"]]
    assert "A tripwire fired on Geared: Net debt / EBITDA above 2x." in texts
    assert body["lines"][0]["tone"] == "warning"


def test_demo_mode_shows_invented_data_on_all_three_routes(client, db_session):
    _seed(db_session)
    assert client.put("/settings/demo-mode", json={"enabled": True}).status_code == 200
    real = {"CASH.OL", "GEAR.OL", "BANK.OL", "FUND", "BARE.OL"}
    chronicle = client.get("/game/chronicle").json()
    assert chronicle["demo"] is True and len(chronicle["frames"]) == 3 and chronicle["changes"]
    assert not {t["ticker"] for f in chronicle["frames"] for t in f["towers"]} & real
    ravens = client.get("/game/ravens").json()
    assert ravens["demo"] is True and {r["kind"] for r in ravens["ravens"]} == {"figures", "text_only"}
    assert not {r["ticker"] for r in ravens["ravens"]} & real
    watch = client.get("/game/night-watch").json()
    assert watch["demo"] is True and watch["fired_overnight"] and watch["status"] == "attention"


def test_account_is_untouched_by_the_three_reads(client, db_session):
    _seed(db_session)
    before = db_session.query(Account).one().cash_as_of
    for route in ("chronicle", "ravens", "night-watch"):
        assert client.get(f"/game/{route}").status_code == 200
    db_session.expire_all()
    assert db_session.query(Account).one().cash_as_of == before
