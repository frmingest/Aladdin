# Sprint 15: fetch ESEF annual reports straight from Oslo Børs Newsweb

**Built:** 2026-09-26 · **Status:** ✅ Built, tested, committed locally (`d78a118`) — not pushed

Faiz's ask: a button that finds a company's annual report on Oslo Børs Newsweb itself, unzips it if
needed, and attaches the resulting figures to the holding — instead of him downloading the ESEF file
and re-uploading it by hand.

---

## 1. What was built

| Layer | What |
|---|---|
| Provider | `app/providers/newsweb_filing_provider.py` — talks to Newsweb's own (undocumented, keyless) API: finds the newest "ANNUAL FINANCIAL REPORT" (category 1001) for an issuer, lists its attachments, downloads one, unzips an ESEF package and picks the real report file out of it (skipping any bundled iXBRL-viewer copy) |
| Service | `app/services/filings/newsweb_annual_report.py` — runs the downloaded file through the **exact same** upload pipeline (`ingest_holding_document`) a manual upload uses, then records Newsweb's own provenance (message id/url, title, published date, attachment name) on the resulting Document |
| API | `GET /sources/holdings/{id}/newsweb-annual-report` (has one been fetched already?) and `POST .../import` (fetch now) — same shape as the existing SEC EDGAR / ESEF-index endpoints |
| Frontend | New card in **Primary sources** on a holding: "Fetch from Newsweb" button, shows the report title (linked to the Newsweb message), published date, facts/periods imported, and any warnings |
| Eligibility | Same rule as the existing Newsweb announcements feed — Oslo Børs issuers only (`.OL` ticker or NOK-denominated) |

## 2. How it fetches a report

1. Derives the issuer's Newsweb "sign" from the holding's ticker (reuses the existing helper from the
   announcements feature).
2. Asks Newsweb for that issuer's newest announcement tagged **ANNUAL FINANCIAL REPORT**.
3. Looks at that announcement's attachments and prefers a `.zip` (the usual ESEF package), falling
   back to a bare `.xhtml`/`.htm` file; a PDF-only announcement is reported back as "no ESEF file
   published" rather than silently failing.
4. If it's a zip: unpacks it, skips anything that looks like a bundled viewer copy, and picks the
   largest remaining report file — that's the real filing, the viewer copy is just a display shim.
5. Hands the extracted `.xhtml` to the same ingestion function a manual upload goes through — same
   sha256 de-duplication, same 250 MB size cap, same iXBRL fact extraction, same "first source wins
   per metric/year" rule. No parallel code path.
6. Stores where it came from (Newsweb message, title, date, which attachment) alongside the Document,
   so re-checking later doesn't re-fetch — it just returns what was already imported.

## 3. What it deliberately doesn't do

- Doesn't touch anything if the company hasn't published an ESEF `.zip`/`.xhtml` on Newsweb (some
  smaller issuers only publish a PDF) — reports back clearly what's missing rather than guessing.
- Doesn't create any new kind of Document — it's a real `annual_report`, same as an upload, so it
  shows up in the documents list and can be deleted the same way.
- Doesn't re-fetch on every check — `GET` returns the stored result; only the **Fetch from Newsweb**
  button re-runs it.

## 4. Verification

| Check | Result |
|---|---|
| New unit tests (provider: list/message parsing, zip extraction, HTTP-error handling) | 18 new, all pass |
| New integration tests (full round trip with a synthetic ESEF zip; bare `.xhtml`; PDF-only → clear error; nothing found → clear error; provider failure → 422 not 500; non-Oslo holding → 422; feature switched off → 422) | 7 new, all pass |
| Full backend suite | **905 passed** — same 2 pre-existing, unrelated failures as before this change (local `.env` sets `LLM_PROVIDER=ollama`, unrelated to this feature) |
| ruff | clean |
| Frontend: `tsc --noEmit`, eslint, vitest, `vite build` | all clean |
| Live Newsweb API | **Not exercised this session** — this environment's backend can't reach `api3.oslo.oslobors.no` directly. The browser-based research that confirmed the API shape earlier *did* reach it live, and the tests use fixtures shaped exactly like those real responses, but the button itself hasn't been clicked against the real site yet |

## 5. Known limitations

- Off switch: `NEWSWEB_FILING_PROVIDER` setting (`"newsweb" | "none"`, defaults to `"newsweb"` — on).
- Looks back 2 years (`NEWSWEB_FILING_LOOKBACK_DAYS`, default 730) for the newest annual report — wide
  enough to always catch the latest one without pulling in irrelevant older history.
- If Newsweb ever changes its (undocumented) API shape, this fails the same way the existing
  announcements feature would — a clear "Newsweb returned an error" message, never a silent wrong
  answer.

## 6. What Faiz needs to do

- Commit is local only (`d78a118`) — review, then commit/push as usual.
- **Click it for real**: open a holding for an Oslo Børs company (e.g. one already carrying `.OL`),
  go to **Primary sources**, and click **Fetch from Newsweb** — this is the first live test against
  the real site.
- If a company you track only publishes a PDF on Newsweb (no ESEF file), the button will say so
  plainly — that's expected, not a bug; upload the report by hand for those as before.

## 7. Placement fix + watchlist confirmation (2026-09-26, after merge)

Faiz's feedback after using it live: the "Fetch from Newsweb" card was buried at the bottom of a
holding's page inside the collapsed **Primary sources** section — easy to miss right after opening a
position.

- **Moved to the top.** `NewswebAnnualReportCard` (now exported from `SourcesPanel.tsx`) renders in
  its own section right after the page header in `HoldingDetailPage.tsx`, before "Buffett/Munger
  analysis" — the first thing on the page for a Newsweb-eligible holding. It's gone from the bottom
  Primary sources section so it isn't shown twice; the announcements/ESEF-history/EDGAR cards stay
  there unchanged. Same eligibility check as before (`GET /sources/holdings/{id}` →
  `newsweb_annual_report`), so non-Oslo holdings still show nothing extra.
- **Confirmed it already works for watchlist items — no backend change needed.** A watched company is
  a real row in the same `Holding` table (`POST /watchlist` in `backend/app/api/watchlist.py` creates
  one with `ticker`/`trading_currency` set when it doesn't already exist), and Newsweb eligibility
  (`newsweb_applies()` in `app/services/filings/eligibility.py`) reads only `ticker` and
  `trading_currency` — nothing about portfolio ownership or position size. The fetch and import
  endpoints key off `holding_id` alone. A watchlist row links to the exact same
  `/holdings/{holding_id}` page an owned position uses, so the newly-relocated card appears there too.
- Frontend-only. `tsc --noEmit`, `eslint`, and `vitest` (19/19) all clean; no backend tests affected
  since no backend code changed. Committed and pushed (`06e519c`).

## 8. Fetch every available year, not just the newest (2026-09-26, second follow-up)

Faiz's next ask, right after confirming §7 worked live: pull **every** annual report Oslo Børs has
published on Newsweb for a holding, back to around when ESEF/iXBRL reporting started in Norway
(he said "around 2022"), instead of stopping at the newest one.

- **New setting**: `newsweb_filing_history_start_year` (default `2022`) in `backend/app/config/
  settings.py`. It's an absolute calendar year, not a rolling day-count like the existing
  `newsweb_filing_lookback_days` — the window is always `[2022-01-01, today]`, so it never drifts
  forward and stop covering 2022 no matter how many years from now this runs.
- **Provider**: `NewswebFilingProvider.list_annual_reports(issuer_sign, since=...)` — lists every
  ANNUAL FINANCIAL REPORT announcement in the window (not just the first), fetching each one's
  attachments. `find_latest_annual_report` is unchanged and still used nowhere else, kept for its own
  tests; both now share one `_list_rows()` helper internally.
- **Service**: `import_all_annual_reports_from_newsweb()` replaces the old single-report import. It
  lists every announcement since 2022, skips any whose Newsweb `message_id` is already recorded on an
  existing Document's `quality_flags` (so clicking the button again only fetches genuinely new years,
  never re-downloads what's already on file), and imports the rest one at a time through the same
  ingestion pipeline as before — one `annual_report` Document per year, same sha256 de-dup, same
  "first source wins per metric/year" rule. A single bad year (only a PDF on Newsweb, or a download/
  extraction failure) is recorded and skipped rather than aborting the whole run; the endpoint only
  fails outright if the eligibility check fails, the ticker has no issuer sign, Newsweb itself can't
  be reached, or literally nothing is found in the window at all.
- **API**: `GET`/`POST /sources/holdings/{id}/newsweb-annual-report[/import]` now return
  `NewswebAnnualReportsOut` — `reports` (every year on file, newest first) plus, on a `POST`, what
  that run did: `newly_imported_this_run`, `already_on_file_this_run`, `no_esef_file_this_run`,
  `failed_this_run`. The URLs are unchanged.
- **Frontend**: `NewswebAnnualReportCard` lists every fetched year (title linked to its Newsweb
  message, published date, facts/periods, per-report warnings) instead of just one, with the button
  reading **Fetch all annual reports** the first time and **Check for more years** afterwards, plus a
  one-line summary of what the last run found (new / already on file / no-ESEF titles).
- Tests: 3 net new backend tests (multi-year fetch, second-run skip, PDF-only-is-skipped-not-fatal
  instead of a hard 422) — 907/908 total, same 1 pre-existing, unrelated demo-mode env failure as
  before this change. Frontend: `tsc --noEmit`, `eslint`, `vitest` (19/19), production build all clean.
- Still not exercised against the real Newsweb site from this environment (same limitation as §4) —
  the next live click will be the first real multi-year test.
