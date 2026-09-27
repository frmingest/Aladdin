"""synthesis_v1 — the optional "where they'd argue" pass (Epic F22, story
22.8). Reads one Buffett/Munger run and one Dalio run of the same holding
and says where they agree, where they'd argue, and what evidence would
settle it. It has no verdict field on purpose: it never overwrites either
persona's verdict (ECON-F22-06).

Citations are prefixed with the run they come from — "B:EV-004" (the
Buffett/Munger run's packet) or "D:EV-011" (the Dalio run's) — because both
packets number their items from EV-001.
"""
from __future__ import annotations

from pydantic import BaseModel


class SynthesisPoint(BaseModel):
    text: str
    evidence_ids: list[str]


class SynthesisOutputV1(BaseModel):
    agreements: list[SynthesisPoint]
    disagreements: list[SynthesisPoint]
    where_they_would_argue: str
    what_would_settle_it: list[SynthesisPoint]


def cited_evidence_ids_synthesis(output: SynthesisOutputV1) -> set[str]:
    ids: set[str] = set()
    for point in (*output.agreements, *output.disagreements, *output.what_would_settle_it):
        ids.update(point.evidence_ids)
    return ids
