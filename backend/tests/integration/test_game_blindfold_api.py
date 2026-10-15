"""GET /game/blindfold over the real route and a database (E1, 2026-10-15)."""
from __future__ import annotations

from decimal import Decimal

from app.models import Document, Holding
from app.models.financial_line_item import FinancialLineItem

D = Decimal


def _seed(db, *, years=range(2018, 2025), ticker="SECR.OL", name="Secret Co", answer_net_income="987654"):
    doc = Document(type="annual_report", original_filename=f"{ticker}-annual.pdf", mime_type="application/pdf",
                   size_bytes=1, storage_path="a.pdf", sha256=ticker.ljust(64, "b"), status="processed", quality_flags={})
    holding = Holding(ticker=ticker, name=name, trading_currency="NOK", asset_class_raw="stock", sector="Industrials")
    db.add_all([doc, holding])
    for y in years:
        net_income = answer_net_income if y == 2022 else "100"
        for metric, value in {
            "revenue": "1000", "net_income": net_income, "depreciation_and_amortization": "40",
            "capital_expenditures": "30", "operating_income": "1000000",
        }.items():
            db.add(FinancialLineItem(document=doc, holding=holding, metric=metric, value=D(value), unit="NOK",
                                     currency="NOK", period=f"FY{y}", confidence=1.0))
    db.commit()
    return holding


def test_empty_database_says_why_there_is_no_puzzle(client):
    body = client.get("/game/blindfold").json()
    assert body["puzzle"] is None and body["pool_size"] == 0 and body["empty_reason"]
    assert body["min_n"] == 8 and body["version"] == "blindfold-v1"


def test_a_puzzle_never_carries_the_answer_name_or_real_years(client, db_session):
    _seed(db_session)
    raw = client.get("/game/blindfold").text
    for secret in ("987654", "Secret Co", "SECR", "NOK", "FY20", "annual.pdf"):
        assert secret not in raw


def test_the_puzzle_has_four_relative_years_and_a_stake_range(client, db_session):
    _seed(db_session)
    body = client.get("/game/blindfold").json()
    assert body["pool_size"] == 3 and body["remaining"] == 3
    puzzle = body["puzzle"]
    assert [y["label"] for y in puzzle["years"]] == ["Year -3", "Year -2", "Year -1", "Year 0"]
    assert [r["key"] for r in puzzle["rows"]][3] == "owner_earnings"
    assert D(puzzle["stake_min"]) < D(puzzle["stake_max"])


def test_answered_puzzles_are_skipped_and_the_pool_runs_out_honestly(client, db_session):
    _seed(db_session)
    seen = []
    for expected_remaining in (3, 2, 1):
        body = client.get("/game/blindfold", params={"seen": seen}).json()
        assert body["remaining"] == expected_remaining
        seen.append(body["puzzle"]["puzzle_id"])
    done = client.get("/game/blindfold", params={"seen": seen}).json()
    assert done["puzzle"] is None and done["remaining"] == 0 and "every puzzle" in done["empty_reason"]


def test_reveal_returns_the_stored_figure_and_lifts_the_mask(client, db_session):
    _seed(db_session)
    body = client.get("/game/blindfold").json()
    pid = body["puzzle"]["puzzle_id"]
    year = int(pid.split(":")[1])
    answer_ni = D("987654") if year == 2021 else D("100")  # answer year is t+1
    expected = answer_ni + 10
    inside = client.get("/game/blindfold/reveal", params={"puzzle_id": pid, "low": str(expected - 1), "high": str(expected + 1)}).json()
    assert D(inside["actual"]) == expected and inside["inside"] is True and inside["position"] == "inside"
    assert inside["name"] == "Secret Co" and inside["ticker"] == "SECR.OL"
    assert inside["source_file"] == "SECR.OL-annual.pdf" and "restatement" in inside["note"]
    above = client.get("/game/blindfold/reveal", params={"puzzle_id": pid, "low": str(expected - 20), "high": str(expected - 10)}).json()
    assert above["inside"] is False and above["position"] == "above"


def test_reveal_rejects_a_reversed_range_a_bad_id_and_a_missing_puzzle(client, db_session):
    _seed(db_session)
    pid = client.get("/game/blindfold").json()["puzzle"]["puzzle_id"]
    assert client.get("/game/blindfold/reveal", params={"puzzle_id": pid, "low": "5", "high": "1"}).status_code == 422
    assert client.get("/game/blindfold/reveal", params={"puzzle_id": "nope", "low": "1", "high": "2"}).status_code == 422
    missing = "00000000-0000-0000-0000-000000000001:2021"
    assert client.get("/game/blindfold/reveal", params={"puzzle_id": missing, "low": "1", "high": "2"}).status_code == 404
    unoffered = pid.split(":")[0] + ":2010"
    assert client.get("/game/blindfold/reveal", params={"puzzle_id": unoffered, "low": "1", "high": "2"}).status_code == 404


def test_the_name_can_be_lifted_before_staking(client, db_session):
    _seed(db_session)
    pid = client.get("/game/blindfold").json()["puzzle"]["puzzle_id"]
    assert client.get("/game/blindfold/name", params={"puzzle_id": pid}).json() == {"name": "Secret Co", "ticker": "SECR.OL"}


def test_demo_mode_shows_no_real_filings(client, db_session):
    _seed(db_session)
    assert client.put("/settings/demo-mode", json={"enabled": True}).status_code == 200
    body = client.get("/game/blindfold").json()
    assert body["demo"] is True and body["puzzle"] is None and body["pool_size"] == 0
    assert "Secret Co" not in client.get("/game/blindfold").text
