# Newsweb interim/half-year report fetch (2026-09-27)

Extends F17 (the Newsweb annual-report fetch) to also pull a holding's half-year/interim reports —
the top-priority backlog candidate from the 2026-09-26 document-sources investigation
([doc](newsweb-annual-report-fetch-sprint15-2026-09-26.md)).

---

## 1. What Faiz asked

> "First: tell me what exactly will happen to each file? PDF storage for llm? Or other plans? Then
> Start building this and keep progress documents updated, also ensure that the feature handles
> files already stored in app."

Two parts: (1) explain the file-handling pipeline before building, (2) build it — with progress
docs kept current and existing-file dedup verified, not just assumed.

## 2. What happens to each file (answered before building)

| Report type | What Newsweb actually has | What Aladdin does with it |
|---|---|---|
| **Annual report** | Almost always an ESEF `.zip` (iXBRL-tagged), sometimes a bare `.xhtml` | Unzipped if needed, run through the real iXBRL extractor → **financial facts promoted** into `FinancialLineItem`, same as a manual upload |
| **Half-year/interim report** | Almost always a **plain PDF** — EU ESEF/iXBRL tagging is an annual-only requirement, Norwegian issuers don't tag half-year reports | Text extracted page-by-page (PyMuPDF) and stored as a searchable, citable `Document` — **zero financial facts extracted or promoted**, by design (CLAUDE.md Rule 1: no arithmetic/fact extraction from PDFs; Faiz's own 2026-09-23 decision reverted the earlier attempt at LLM-based PDF figure extraction) |

So: no new PDF-storage code path was needed — it's the **same** ingestion pipeline
(`ingest_holding_document`) every manual PDF upload already goes through. The only thing that's new
is *feeding* it Newsweb's interim-report attachment automatically. A PDF becomes evidence text an
analysis can cite; it never becomes a number in the DCF, ratios, or metrics panel. The UI says this
explicitly on every interim import result (`PDF_NO_FACTS_WARNING`) and in the card's description.

If Newsweb ever does publish an ESEF-tagged interim filing (rare, but possible), it's preferred over
the PDF and run through the same iXBRL extractor an annual report gets — same fact-promotion path,
no special-casing needed.

## 3. What was built

- **Provider** (`app/providers/newsweb_filing_provider.py`): `INTERIM_REPORT_CATEGORY_ID = 1002`;
  `parse_report_list()` generalized from the old `parse_annual_report_list()` (kept as a thin
  wrapper, category 1001); new `parse_interim_report_list()` (category 1002); new
  `pick_report_attachment(attachments, *, allow_pdf_fallback)` → `(attachment, is_esef)` — prefers
  an ESEF `.zip`/`.xhtml` exactly like before, and **only** falls back to the first PDF when
  `allow_pdf_fallback=True` (interim reports only — annual imports keep their old "no ESEF → error"
  behaviour unchanged); new `NewswebFilingProvider.list_interim_reports()`, same shape as
  `list_annual_reports()` but category 1002.
- **Service** (`app/services/filings/newsweb_annual_report.py`): generalized the whole import
  pipeline with a `document_type` / `allow_pdf_fallback` / `report_label` parameter set, so annual
  and interim share one core (`_import_all_reports_from_newsweb`) instead of two copies. New
  `INTERIM_REPORT_DOCUMENT_TYPE = "quarterly_report"` (already a valid `DOCUMENT_TYPES` entry — no
  migration needed) and `PDF_NO_FACTS_WARNING` constant. `quality_flags.newsweb_source.report_kind`
  now records which kind of report a document came from.
- **API** (`app/api/sources.py`, `app/schemas/sources.py`): new
  `GET`/`POST /sources/holdings/{id}/newsweb-interim-report[/import]`, reusing the existing
  `NewswebAnnualReportOut`/`NewswebAnnualReportsOut` schemas unchanged (same shape; interim imports
  just report `facts_imported=0` plus a warning). `SourceEligibilityOut` gained
  `newsweb_interim_report` / `newsweb_interim_report_reason`.
- **Frontend** (`SourcesPanel.tsx`, `api.ts`, `types.ts`): extracted the annual-report card's body
  into a generic `NewswebFilingCard` (render-prop parameterized on title/description/labels/API
  calls/facts line) and re-exported both `NewswebAnnualReportCard` and a new
  `NewswebInterimReportCard` from it — no ~90-line duplication. The interim card sits in the Primary
  sources panel (not the top-of-page highlight, which stays annual-only) with copy that says plainly
  it adds evidence text, not new valuation numbers.

## 4. "Handles files already stored in app" — how it's actually guaranteed

Two dedup mechanisms, both inherited unchanged from the annual-report path and specifically tested
for interim reports:

1. **Content-hash dedup** (`intake_raw_file`, SHA-256): if a report fetched from Newsweb has the
   exact same bytes as something already stored — including a report Faiz uploaded by hand earlier —
   it's recognized as the same `Document` and no duplicate is created. Critically, the Newsweb
   provenance flag is still written onto that *existing* document, so a manually-uploaded half-year
   report becomes visibly "from Newsweb" the first time it's fetched, without creating a second row.
   Covered by `test_newsweb_interim_report_dedups_against_existing_document`.
2. **Message-id dedup** (per report kind): once a given Newsweb announcement has been imported, a
   repeat "Check for more reports" click won't re-download it — tracked separately from the
   annual-report list, so fetching interim reports never disturbs the annual-report state or
   vice versa.

## 5. Tests

- 6 new provider unit tests (`test_newsweb_filing_provider.py`): `parse_interim_report_list`,
  `pick_report_attachment` (ESEF preferred, PDF fallback used, PDF fallback disabled, no
  attachments), `list_interim_reports` calling category 1002.
- 7 new integration tests (`test_sources_api.py`): PDF-only succeeds as text evidence with
  `facts_imported=0` and the warning (the key behavior difference from annual, which would skip a
  PDF-only report into `no_esef_file_this_run`); a rare ESEF-tagged interim report still extracts
  facts; dedup against an existing manually-uploaded document; none-found/provider-failure/
  not-applicable/switched-off, mirroring the annual suite.
- Full backend suite: **921 total, 920 pass** (13 net new; the 1 failure is the same
  pre-existing, environment-only `test_demo_mode_api.py` failure present before this change and
  confirmed unrelated — reproduces in isolation, untouched by this work).
- Frontend: `tsc --noEmit`, `eslint .`, `vitest run` (19/19), production `build` — all clean.
- `ruff check` clean on every touched file (one `UP035` import-style fix applied to
  `newsweb_annual_report.py` along the way).

## 6. Status

Written and tested, **not yet committed or deployed** — see docs/PROGRESS.md §1 for current
git/deploy state. Not yet run against the real Newsweb API (same caveat as F17's annual fetch —
fixtures are shaped like real responses, but this is untested against live data).

## 7. Next for Faiz

- Try the new **"Fetch half-year reports"** card on an Oslo Børs holding, in Primary sources (below
  the annual-report card) — first live test against the real API.
- Nothing to configure — reuses the same `NEWSWEB_FILING_PROVIDER` toggle and
  `newsweb_filing_history_start_year` setting as the annual fetch.
