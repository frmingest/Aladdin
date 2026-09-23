"""Versioned financial-extraction schema registry (CLAUDE.md Rule 3).
A future v2 adds a module and a dict entry; facts saved under v1 keep their
provenance via the document's quality_flags["financials_extraction"]."""
from __future__ import annotations

from pydantic import BaseModel

from app.domain.extraction_schema.v1 import FinancialsExtractionV1, StatementFactV1

_SCHEMAS: dict[str, type[BaseModel]] = {"v1": FinancialsExtractionV1}


def get_extraction_schema(version: str) -> type[BaseModel]:
    try:
        return _SCHEMAS[version]
    except KeyError as exc:
        raise ValueError(f"unknown financial-extraction schema version {version!r}") from exc


__all__ = ["FinancialsExtractionV1", "StatementFactV1", "get_extraction_schema"]
