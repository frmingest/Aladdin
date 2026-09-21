"""Unit tests for app.services.analysis.notes — CRUD for the portfolio
owner's per-holding thesis notes (CLAUDE.md Rule 4: only ever read by the
reconciliation pass; this module itself is content-agnostic)."""
from __future__ import annotations

from sqlalchemy import create_engine
from sqlalchemy.orm import Session

from app.models import Base, Holding
from app.services.analysis.notes import get_holding_note, set_holding_note


def _session() -> Session:
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(engine)
    return Session(engine)


def test_get_returns_none_when_no_note_exists():
    db = _session()
    holding = Holding(ticker="AAPL", name="Apple Inc.", trading_currency="USD")
    db.add(holding)
    db.commit()

    assert get_holding_note(db, holding.id) is None


def test_set_creates_then_updates_in_place():
    db = _session()
    holding = Holding(ticker="AAPL", name="Apple Inc.", trading_currency="USD")
    db.add(holding)
    db.commit()

    note = set_holding_note(db, holding.id, "Initial thesis.")
    assert note.content == "Initial thesis."
    first_id = note.id

    updated = set_holding_note(db, holding.id, "Revised thesis.")
    assert updated.id == first_id
    assert updated.content == "Revised thesis."

    fetched = get_holding_note(db, holding.id)
    assert fetched.content == "Revised thesis."
