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
    "fund_factsheet",
    "fund_kid",
    "fund_report",
    "fund_commentary",
    "fund_holdings",
    "other",
)

# Sprint 8 (F9): fund / ETF documents. A fund has no financial statements
# of its own; these carry its facts instead. fund_factsheet, fund_kid,
# fund_report (annual/semi-annual report of the fund or its umbrella) and
# fund_commentary (the manager's monthly letter — marketing material, the
# weakest evidence tier) are text sources for excerpts and the documents
# typed fund figures cite. fund_holdings is a provider holdings file
# (CSV/XLSX) imported by app/services/funds/holdings_import.py: never
# promoted to financial facts, never used as excerpt text.
FUND_DOCUMENT_TYPES: tuple[str, ...] = (
    "fund_factsheet",
    "fund_kid",
    "fund_report",
    "fund_commentary",
    "fund_holdings",
)
DOCUMENT_TYPE_FUND_HOLDINGS = "fund_holdings"

DOCUMENT_STATUS_UPLOADED = "uploaded"
DOCUMENT_STATUS_PROCESSING = "processing"
DOCUMENT_STATUS_PROCESSED = "processed"
DOCUMENT_STATUS_FAILED = "failed"

ALLOWED_UPLOAD_EXTENSIONS: tuple[str, ...] = (".pdf", ".pptx", ".xlsx", ".csv", ".xhtml", ".html", ".htm")

# System-created (never user-uploadable, so deliberately not in
# DOCUMENT_TYPES): the verbatim SEC EDGAR company-facts JSON an EDGAR import
# was built from — app/services/filings/sec_edgar.py. Every
# FinancialLineItem it produces FKs to this row, so an imported number is
# always traceable to the exact payload (and, via quality_flags["provenance"],
# the exact filing accession number) it came from.
DOCUMENT_TYPE_SEC_XBRL = "sec_xbrl_facts"
