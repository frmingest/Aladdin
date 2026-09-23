"""Regression test for the CSV-import 500 Faiz hit 2026-09-21:
`POST /portfolio/import-csv` and `GET /documents` both crashed with a
Pydantic dict_type error whenever the matched Document row's
`quality_flags` wasn't already a dict — see DocumentOut's
`_coerce_quality_flags` validator in app/schemas/document.py.
"""
from __future__ import annotations

from datetime import datetime, timezone
from uuid import uuid4

from app.schemas.document import DocumentOut

_BASE_KWARGS = dict(
    id=uuid4(),
    holding_id=None,
    type="portfolio_export",
    original_filename="export.csv",
    mime_type="text/csv",
    size_bytes=123,
    uploaded_at=datetime.now(timezone.utc),
    reporting_period=None,
    sha256="a" * 64,
    status="processed",
    page_count=0,
    fact_count=0,
)


def test_quality_flags_dict_passes_through_unchanged():
    doc = DocumentOut(quality_flags={"no_pages_extracted": True}, **_BASE_KWARGS)
    assert doc.quality_flags == {"no_pages_extracted": True}


def test_quality_flags_list_is_coerced_to_dict():
    """The exact shape that used to 500 the request — a list of flag
    names, as older ingestion code (or any other stray writer) could have
    stored before `process_document` was changed to write a dict."""
    doc = DocumentOut(quality_flags=["extraction_failed", "no_pages_extracted"], **_BASE_KWARGS)
    assert doc.quality_flags == {"extraction_failed": True, "no_pages_extracted": True}


def test_quality_flags_unexpected_shape_falls_back_to_empty_dict():
    doc = DocumentOut(quality_flags=None, **_BASE_KWARGS)  # type: ignore[arg-type]
    assert doc.quality_flags == {}


def test_quality_flags_with_detail_values_validate():
    # SEC EDGAR provenance, iXBRL stats and fact conflicts are nested values;
    # as dict[str, bool] these made GET /documents 500 (fixed 2026-09-23).
    flags = {
        "source": "sec_edgar",
        "provenance": {"FY2024": {"accession": "0000"}},
        "ixbrl": {"tagged_numbers": 296, "fiscal_years": ["FY2025"]},
        "fact_conflicts": ["FY2025 revenue: 1 vs 2"],
        "low_text_pages": True,
    }
    out = DocumentOut(quality_flags=flags, **_BASE_KWARGS)
    assert out.quality_flags == flags
