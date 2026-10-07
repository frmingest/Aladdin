"""Tag mapping rules promoted to code (tag review inbox, PR 3).

A rule accepted in the inbox lives in the database (PR 2). When it has proved
itself it can be *exported*: one row below, plus the pytest case that checks it
(`tests/unit/test_accepted_tag_rules.py` builds a tiny filing from each row and
requires the extractor to read the figure with **no** database rule). The repo
then stays the long-term source of truth, and a fresh database needs nothing.

A row holds concept names and one value only. No filing text, no company
statements. A standard tag (`ifrs-full:`, `us-gaap:`) is read for every
company; a filer's own extension tag (`ORK:...`) can only occur in that filer's
reports, so it is company-only by its name.

The block between the markers is rewritten by the export (see
`app/services/tag_export.py`); keep the markers and the one-row-per-line shape.
This module imports nothing from the extractor so `ixbrl.py` can read it.
"""
from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class AcceptedTagRule:
    metric: str  # canonical metric key, e.g. "total_debt"
    concept: str  # prefix:LocalName, as tagged
    value: str  # the tagged value in full units, signed as tagged (the test fixture)
    unit: str  # "NOK", "USD", "NOK/shares" or "shares"
    instant: bool  # balance-sheet (point in time) or flow (a year)
    note: str  # where it was seen, e.g. "Orkla FY2025"


ACCEPTED_TAG_RULES: tuple[AcceptedTagRule, ...] = (
    # BEGIN accepted-tag-rules
    # END accepted-tag-rules
)


def concepts_by_metric() -> dict[str, tuple[str, ...]]:
    """metric -> accepted concepts, in the order they were exported."""
    out: dict[str, list[str]] = {}
    for rule in ACCEPTED_TAG_RULES:
        bucket = out.setdefault(rule.metric, [])
        if rule.concept not in bucket:
            bucket.append(rule.concept)
    return {metric: tuple(concepts) for metric, concepts in out.items()}
