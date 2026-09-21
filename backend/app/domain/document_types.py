"""Allowed values for Document.type / Document.status.

Plain string constants, not a DB enum — `documents.type` and
`documents.status` are String columns on the already-migrated table (see
alembic/versions/a0f4172c5989_phase1_portfolio_and_document_ingestion.py),
so validation happens here in application code rather than by widening the
schema (CLAUDE.md: don't alter the legacy/already-migrated tables without
an explicit ask).
"""

DOCUMENT_TYPES: tuple[str, ...] = (
    "annual_report",
    "quarterly_report",
    "presentation",
    "prospectus",
    "transcript",
    "other",
)

DOCUMENT_STATUS_UPLOADED = "uploaded"
DOCUMENT_STATUS_PROCESSING = "processing"
DOCUMENT_STATUS_PROCESSED = "processed"
DOCUMENT_STATUS_FAILED = "failed"

ALLOWED_UPLOAD_EXTENSIONS: tuple[str, ...] = (".pdf", ".pptx", ".xlsx")
