"""Pydantic schemas for the primary-source filings API (app/api/sources.py)."""
from __future__ import annotations

from datetime import date, datetime
from uuid import UUID

from pydantic import BaseModel

from app.schemas.research import ResearchItemOut


class SourceEligibilityOut(BaseModel):
    holding_id: UUID
    ticker: str
    sec_edgar: bool
    sec_edgar_reason: str | None = None
    newsweb: bool
    newsweb_reason: str | None = None
    esef_index: bool = False
    esef_index_reason: str | None = None
    newsweb_annual_report: bool = False
    newsweb_annual_report_reason: str | None = None
    newsweb_interim_report: bool = False
    newsweb_interim_report_reason: str | None = None


class EdgarFilingOut(BaseModel):
    accession_number: str
    form: str
    filed: str
    url: str


class EdgarImportOut(BaseModel):
    holding_id: UUID
    imported: bool  # False = nothing stored yet for this holding
    cik: str | None = None
    entity_name: str | None = None
    source_url: str | None = None
    document_id: str | None = None
    was_duplicate: bool = False
    periods_imported: list[str] = []
    periods_skipped_manual: list[str] = []
    facts_imported: int = 0
    metrics_by_period: dict[str, list[str]] = {}
    filings: list[EdgarFilingOut] = []
    retrieved_at: datetime | None = None
    warnings: list[str] = []


class EsefFilingOut(BaseModel):
    period_end: str
    fxo_id: str
    report_url: str
    viewer_url: str
    error_count: int
    years_used: list[str] = []
    integrity_failed: list[str] = []


class EsefImportIn(BaseModel):
    # Optional: without it the LEI is read from the holding's uploaded
    # ESEF files (contents or file name) or a previous import.
    lei: str | None = None


class EsefImportOut(BaseModel):
    holding_id: UUID
    imported: bool  # False = never imported for this holding
    suggested_lei: str | None = None  # found on file, for the form
    suggested_lei_source: str | None = None
    lei: str | None = None
    lei_source: str | None = None
    imported_at: datetime | None = None
    periods_imported: list[str] = []
    periods_skipped_existing: list[str] = []
    facts_imported: int = 0
    metrics_by_period: dict[str, list[str]] = {}
    filings: list[EsefFilingOut] = []
    latest_period_in_index: str | None = None
    warnings: list[str] = []


class AnnouncementsOut(BaseModel):
    available: bool
    holding_id: UUID
    ticker: str
    as_of: datetime | None
    items: list[ResearchItemOut]
    reason: str | None = None


class NewswebAnnualReportOut(BaseModel):
    """One report fetched straight from Newsweb (Sprint 15,
    app/services/filings/newsweb_annual_report.py) — the ESEF .xhtml is
    unzipped if needed and run through the same extractor an upload uses.
    Reused as-is (same shape) for the interim/half-year report endpoint
    added 2026-09-26 — a PDF-only interim report still uses this schema,
    just with facts_imported=0 and a warning explaining why."""

    message_id: str
    message_url: str
    title: str
    published_at: datetime | None = None
    attachment_name: str
    document_id: str
    was_duplicate: bool = False
    imported_at: datetime | None = None
    facts_imported: int = 0
    periods_imported: list[str] = []
    metrics_by_period: dict[str, list[str]] = {}
    warnings: list[str] = []


class NewswebAnnualReportsOut(BaseModel):
    """Every report fetched from Newsweb for this holding so far (annual
    or interim, depending on which endpoint returned this). Extended
    2026-09-26 (Faiz's follow-up ask) to fetch every available year back
    to ``history_since``, not just the newest one — a POST also reports
    what this particular run skipped or couldn't process. Extended again
    2026-09-26 to also serve the interim/half-year report endpoint (same
    shape, reused as-is)."""

    holding_id: UUID
    history_since: date  # the earliest year this fetch looked for
    reports: list[NewswebAnnualReportOut] = []  # every year on file, newest first
    newly_imported_this_run: int = 0
    already_on_file_this_run: list[str] = []  # titles skipped — already fetched in an earlier run
    no_esef_file_this_run: list[str] = []  # titles Newsweb has, but only as a PDF (no ESEF to extract) — annual only
    failed_this_run: list[str] = []  # "title: reason" for a report that couldn't be processed
