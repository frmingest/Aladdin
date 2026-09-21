"""Allowed values for Document.type / Document.status.

Plain string constants, not a DB enum — `documents.type` and
`documents.status` are String columns on the already-migrated table (see
alembic/versions/a0f4172c5989_phase1_portfolio_and_document_ingestion.py),
so validation happens here in application code rather than by widening the
schema (CLAUDE.md: don't alter the legacy/already-migrated tables without
an explicit ask).

"portfolio_export" is a document with no single `holding_id` (a brokerage
export covering many holdings at once) — see app/api/documents.py, where
`holding_id` is optional for exactly this reason, and app/api/portfolio.py,
which requires a snapshot's source_file_id to point at a real uploaded
document (Faiz's explicit choice, 2026-09-21: portfolio positions stay
traceable to real evidence, no manual-entry shortcut).
"""

DOCUMENT_TYPES: tuple[str, ...] = (
    "annual_report",
    "quarterly_report",
    "presentation",
    "prospectus",
    "transcript",
    "portfolio_export",
    "other",
)

DOCUMENT_STATUS_UPLOADED = "uploaded"
DOCUMENT_STATUS_PROCESSING = "processing"
DOCUMENT_STATUS_PROCESSED = "processed"
DOCUMENT_STATUS_FAILED = "failed"

ALLOWED_UPLOAD_EXTENSIONS: tuple[str, ...] = (".pdf", ".pptx", ".xlsx")
