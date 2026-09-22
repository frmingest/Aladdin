# Primary sources: SEC EDGAR + Oslo Børs Newsweb (2026-09-22)

Faiz asked to start building the market/research sourcing from the
[free-provider research](free-market-data-research-providers-2026-09-21.md). Scope he chose:

| Question | Answer |
|---|---|
| Which sources | **Both** top picks: SEC EDGAR (US/SEC filers) + Oslo Børs Newsweb (Oslo issuers) |
| Where data goes | **Financials + evidence**: EDGAR → `financial_line_items` (so metrics/valuation/analysis use it); Newsweb → citable evidence |
| Frontend | **Backend + simple UI** on the holding detail page |

## What was built

| Piece | File(s) | Notes |
|---|---|---|
| EDGAR provider | `app/providers/sec_edgar_provider.py` | Ticker→CIK via `company_tickers.json`; facts via `companyfacts` XBRL API. Picks annual (10-K/20-F/40-F) values only, latest-filed wins (restatements), maps ~40 us-gaap / ifrs-full tags → the 16 canonical metrics. **Never computes a number** (Rule 1) — EBITDA/EBIT stay absent. |
| Newsweb provider | `app/providers/newsweb_provider.py` | Keyless `api3.oslo.oslobors.no/v1/newsreader/list?issuer=&fromDate=&toDate=`. Metadata only (title, category, date, link to `newsweb.oslobors.no/message/{id}`), no body text. Double-checks `issuerSign` client-side. |
| EDGAR import service | `app/services/filings/sec_edgar.py` | Stores verbatim JSON as a `sec_xbrl_facts` Document (sha256-dedup) + per-fact provenance (concept, form, accession, filed) in `quality_flags`. New payload supersedes older EDGAR facts (documents kept as audit trail). **Periods you uploaded yourself are never overwritten.** |
| Announcements service | `app/services/filings/announcements.py` | Reuses Sprint 2's `research_runs`/`research_items` cache under run type `ANNOUNCEMENTS` — same 24h staleness, FAILED-run recording, stale fallback. **No migration.** |
| Routing + safety guard | `app/services/filings/eligibility.py` | Newsweb for `.OL`/NOK holdings. EDGAR for any SEC ticker; an Oslo ticker whose bare sign hits an *unrelated* US filer (e.g. `VAR` → Varian) is **refused** by a name-match check. Dual-listed SEC filers (Equinor → EQNR 20-F) work. |
| API | `app/api/sources.py` | `GET /sources/holdings/{id}` (which sources apply) · `GET`/`POST …/sec-edgar[/import]` · `GET`/`POST …/announcements[/refresh]`. Failures are 422 with a readable message, never 500. |
| Evidence packet **v2** | `app/services/analysis/evidence_packet.py` | Adds `financial_sources` (the EDGAR filings behind the numbers) and `regulatory_announcements` (latest 15 Newsweb items) — both cited. Version bumped v1→v2 (Rule 3); pipeline now records the real version instead of a hard-coded "v1". |
| Frontend | `components/SourcesPanel.tsx`, `HoldingDetailPage.tsx` | New "Primary sources" section: Newsweb announcements (Oslo holdings) + "Import from SEC EDGAR" card with source-filing links. An import refreshes the metrics panel. |

## New config (`.env` + Railway)

| Variable | Default | Needed? |
|---|---|---|
| `SEC_EDGAR_USER_AGENT` | *(unset)* | **Yes, for EDGAR.** SEC requires a descriptive UA with a contact email, e.g. `Aladdin portfolio app you@example.com`. Import fails with an explicit message until set. |
| `FUNDAMENTALS_PROVIDER` | `sec_edgar` | No |
| `SEC_EDGAR_MAX_YEARS` | `10` | No |
| `ANNOUNCEMENTS_PROVIDER` | `newsweb` | No |
| `ANNOUNCEMENTS_LOOKBACK_DAYS` | `365` | No |
| `ANNOUNCEMENTS_IN_EVIDENCE_PACKET` | `15` | No |

## Verification

| Check | Result |
|---|---|
| Backend tests | **364/364 passing** (31 new: EDGAR selection logic, HTTP layer, Newsweb parsing, eligibility/name-guard, `/sources` API end-to-end, evidence packet v2) |
| ruff | Clean on every new/changed file (2 pre-existing findings in untouched files) |
| Frontend | `tsc --noEmit`, `eslint`, `vite build` all clean |
| Live API shapes | Newsweb list response and EDGAR `companyconcept` field names confirmed against the live endpoints via web fetch this session |
| **Not verified** | No end-to-end run against live SEC/Newsweb — neither this session's cloud shell nor the linked-device shell can reach those hosts. **First real signal = Faiz clicking the buttons after deploy.** |

## Known approximations

- Period label = `FY{calendar year the fiscal year ends}` (same convention as uploaded filings).
- `total_debt` = the filer's own long-term-debt tag; short-term borrowings are not added (that would be arithmetic).
- Newsweb titles are issuer-written — they reach the LLM only as data inside the packet (Rule 5).
- Oslo-only names (Vår Energi, Salmon Evolution) still get **no automatic financials** — Newsweb gives announcements, not structured numbers. Upload their reports as before.
