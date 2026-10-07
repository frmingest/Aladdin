"""Reading and writing instrument facts (see app/domain/instrument_facts.py).

Rules (the API turns InstrumentFactsError into a 422):
- the holding must be a bond fund, money-market fund or commodity ETC
- the key must be one of that type's allowed keys
- numbers stay inside the registry's range; text is trimmed and bounded
- every row cites a document uploaded to this same holding
- one value per key; saving replaces the holding's whole set (the UI edits
  it as one table, like reported returns)
"""
from __future__ import annotations

import uuid
from datetime import date
from decimal import Decimal

from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from app.domain.instrument_facts import fact_spec, fact_specs_for
from app.domain.instrument_types import analysis_path
from app.models.fund import InstrumentFact
from app.models.holding import Holding
from app.services.funds.facts import FundFactsError, require_source_document

MAX_TEXT_CHARS = 600


class InstrumentFactsError(FundFactsError):
    """An instrument fact that can't be saved as given; the message says why."""


def facts_path(holding: Holding) -> str | None:
    """The analysis path whose facts this holding takes (income or commodity), else None."""
    path = analysis_path(holding.asset_class_raw)
    return path if fact_specs_for(path) else None


def list_facts(db: Session, holding_id: uuid.UUID) -> list[InstrumentFact]:
    rows = list(db.scalars(select(InstrumentFact).where(InstrumentFact.holding_id == holding_id)))
    rows.sort(key=lambda r: r.fact_key)
    return rows


def facts_by_key(db: Session, holding_id: uuid.UUID) -> dict[str, InstrumentFact]:
    return {row.fact_key: row for row in list_facts(db, holding_id)}


def replace_facts(db: Session, holding: Holding, facts: list[dict]) -> list[InstrumentFact]:
    path = facts_path(holding)
    if path is None:
        raise InstrumentFactsError(
            f"'{holding.ticker}' is tagged '{holding.asset_class_raw}'. Instrument facts are only kept for "
            "bond funds, money-market funds and commodity ETCs — change Instrument Type on the Holdings page first."
        )
    seen: set[str] = set()
    rows: list[InstrumentFact] = []
    for fact in facts:
        key = fact["fact_key"]
        spec = fact_spec(path, key)
        if spec is None:
            allowed = ", ".join(s.key for s in fact_specs_for(path))
            raise InstrumentFactsError(f"'{key}' is not a figure kept for this instrument type (allowed: {allowed})")
        if key in seen:
            raise InstrumentFactsError(f"'{key}' is given twice")
        seen.add(key)
        require_source_document(db, holding, fact["source_document_id"])
        number: Decimal | None = fact.get("value_number")
        text = (fact.get("value_text") or "").strip() or None
        if spec.kind == "number":
            if number is None:
                raise InstrumentFactsError(f"{spec.label}: a number is required")
            if text is not None:
                raise InstrumentFactsError(f"{spec.label}: this figure is a number, not text")
            if (spec.minimum is not None and number < spec.minimum) or (
                spec.maximum is not None and number > spec.maximum
            ):
                raise InstrumentFactsError(
                    f"{spec.label}: {number} is outside the plausible range {spec.minimum} to {spec.maximum} {spec.unit}"
                )
        else:
            if text is None:
                raise InstrumentFactsError(f"{spec.label}: text is required")
            if number is not None:
                raise InstrumentFactsError(f"{spec.label}: this figure is text, not a number")
            if len(text) > MAX_TEXT_CHARS:
                raise InstrumentFactsError(f"{spec.label}: keep it under {MAX_TEXT_CHARS} characters")
        as_of: date | None = fact.get("as_of_date")
        rows.append(
            InstrumentFact(
                holding_id=holding.id,
                fact_key=key,
                value_number=number,
                value_text=text,
                as_of_date=as_of,
                source_document_id=fact["source_document_id"],
                source_page=fact.get("source_page"),
            )
        )
    db.execute(delete(InstrumentFact).where(InstrumentFact.holding_id == holding.id))
    for row in rows:
        db.add(row)
    db.commit()
    return list_facts(db, holding.id)
