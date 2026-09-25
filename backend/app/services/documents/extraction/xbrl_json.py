"""xBRL-JSON (OIM) report -> the tagged facts the iXBRL parser works with
(Sprint 10, 2026-09-25).

filings.xbrl.org publishes every ESEF filing it indexes as xBRL-JSON: one
object per fact with ``dimensions`` (concept, entity, period, unit and any
axes) and a ``value`` already in full units with its sign. Feeding those
facts through ``map_tagged_facts`` means a year imported from the index is
mapped by exactly the code an uploaded .xhtml is (same concept priorities,
owner's-view outflows, hybrid capital, integrity checks).

Conversions (the OIM rules, nothing inferred):
* period ``start/end`` and instants are datetimes with an EXCLUSIVE end:
  ``2025-01-01T00:00:00`` is the end of 31 Dec 2024. A time of 00:00:00 is
  moved back one day; ``T24:00:00`` or a bare date is that date.
* unit ``iso4217:NOK`` -> ``NOK``; ``iso4217:NOK/xbrli:shares`` ->
  ``NOK/shares``; ``xbrli:shares`` -> ``shares`` (as the iXBRL parser).
* a fact with any dimension besides concept/entity/period/unit/language is
  dimensional (a segment or equity component), so never a group total.
* non-numeric facts (text blocks, dates) have no unit and are skipped.
"""
from __future__ import annotations

import json
import re
from datetime import date, timedelta
from decimal import Decimal, InvalidOperation
from typing import Any

from app.services.documents.extraction.ixbrl import (
    MappedFacts,
    TaggedFact,
    _Context,
    map_tagged_facts,
)

_CORE_DIMENSIONS = {"concept", "entity", "period", "unit", "language", "noteId"}
_LEI_IN_ENTITY = re.compile(r"([A-Z0-9]{18}[0-9]{2})$")


def _period_end(text: str) -> date | None:
    text = text.strip()
    try:
        day = date.fromisoformat(text[:10])
    except ValueError:
        return None
    if "T" in text and text[11:19] == "00:00:00":
        return day - timedelta(days=1)
    return day


def _period_start(text: str) -> date | None:
    try:
        return date.fromisoformat(text.strip()[:10])
    except ValueError:
        return None


def _unit(raw: str) -> str:
    return "/".join(part.split(":")[-1] for part in raw.split("/"))


def entity_leis(data: dict[str, Any]) -> set[str]:
    """Every LEI the report's facts are reported for (normally one)."""
    found: set[str] = set()
    for fact in (data.get("facts") or {}).values():
        entity = ((fact or {}).get("dimensions") or {}).get("entity")
        if isinstance(entity, str):
            match = _LEI_IN_ENTITY.search(entity.strip().upper())
            if match:
                found.add(match.group(1))
    return found


def tagged_facts_from_xbrl_json(data: dict[str, Any]) -> tuple[list[TaggedFact], dict[str, _Context]]:
    tagged: list[TaggedFact] = []
    contexts: dict[str, _Context] = {}
    for fact in (data.get("facts") or {}).values():
        if not isinstance(fact, dict):
            continue
        dims = fact.get("dimensions") or {}
        concept, period, unit = dims.get("concept"), dims.get("period"), dims.get("unit")
        value = fact.get("value")
        if not concept or not isinstance(period, str) or not isinstance(unit, str) or value is None:
            continue
        try:
            number = Decimal(str(value))
        except InvalidOperation:
            continue
        if not number.is_finite():
            continue
        extra = {k: v for k, v in dims.items() if k not in _CORE_DIMENSIONS}
        context_id = period + ("|" + json.dumps(extra, sort_keys=True) if extra else "")
        if context_id not in contexts:
            if "/" in period:
                start_text, end_text = period.split("/", 1)
                start, end = _period_start(start_text), _period_end(end_text)
                if start is None or end is None:
                    continue
                contexts[context_id] = _Context(start, end, False, bool(extra))
            else:
                end = _period_end(period)
                if end is None:
                    continue
                contexts[context_id] = _Context(None, end, True, bool(extra))
        decimals = fact.get("decimals")
        tagged.append(
            TaggedFact(
                concept=str(concept),
                context_id=context_id,
                # Canonical values carry a trailing ".0"; normalise so the
                # conflict check compares numbers, not spellings.
                value=Decimal(format(number.normalize(), "f")),
                unit=_unit(unit),
                page=0,
                decimals=None if decimals is None else str(decimals),
            )
        )
    return tagged, contexts


def map_xbrl_json(data: dict[str, Any]) -> MappedFacts:
    tagged, contexts = tagged_facts_from_xbrl_json(data)
    return map_tagged_facts(tagged, contexts)
