# Sprint 10: ESEF history import + large .xhtml uploads (2026-09-25)

Two things, built together:

1. **Large ESEF uploads.** `Orklaasa-2025-12-31-1-no.xhtml` (98.6 MB) was rejected: *"exceeding the 83886080-byte limit"* (80 MB).
2. **Sprint 9 layer D.** Import FY2020–FY2024 figures for an Oslo holding from **filings.xbrl.org** by LEI, so only the latest annual report has to be uploaded by hand.

**Status:** written and tested, **not committed, not deployed**. filings.xbrl.org could not be reached from this session (blocked by the network allowlist), so the import is tested against a fake index only. The first real run is on your side (see §5).

---

## 1. Large `.xhtml` uploads

### What was wrong

An ESEF annual report is one self-contained file. Every photo, chart and font is embedded as base64 text (`data:image/jpeg;base64,…`). In a report with many images, that is nearly the whole file. None of it is a tagged figure or report text.

The 80 MB limit caught Orkla. Raising only the limit would have caused two more problems:

| Problem | Why |
|---|---|
| Object storage | Supabase Storage's default per-file limit (50 MB on the free plan) would reject the stored file |
| Parser memory | lxml would build a tree of ~100 MB of image text on Railway |

### What changed

| Change | Detail |
|---|---|
| **Embedded media stripped on upload** | New `extraction/ixbrl_slim.py` empties each base64 payload of 1 KB or more (in `src`, `href` and CSS `url(...)`). The URI stays (`data:image/png;base64,`), so the file is still valid XML |
| Figures and text unchanged | Every `ix:` tag, context, unit and text node is untouched. A test checks that facts, page text and details are **identical** before and after stripping |
| Stored file = slim file | Stored, parsed and chunked from the slim copy (usually a few MB) |
| Duplicate check | Still on the hash of the file **as uploaded**, so re-uploading the same report is recognised |
| Recorded | `quality_flags.embedded_media_removed` = items, bytes removed, original and stored size. The documents list shows *"N embedded images/fonts removed on upload (99.1 MB → 3.2 MB); figures and text unchanged"* |
| Limit | `MAX_IXBRL_UPLOAD_SIZE_MB` default **80 → 250** (the file as uploaded). Other files stay 25 MB |
| Error text | Now in MB: *"'x.xhtml' is 260.3 MB, over the 250 MB limit for this file type"* |
| Speed | Synthetic 93 MB file: stripping 0.15 s, then parsing 0.01 s |

**Existing uploads are not changed.** Only new uploads are slimmed.

**Possible remaining limit:** if an upload over ~100 MB still fails *before* reaching the app (an error that doesn't come from Aladdin, e.g. a bare 413), Railway's proxy has a request-size cap. I couldn't confirm this from here. Run the backend locally for that one upload, or tell me the exact error.

---

## 2. ESEF history import (filings.xbrl.org)

### How it works

| Step | What happens |
|---|---|
| 1. LEI | Taken from, in order: the LEI typed on the card → the LEI **read from an uploaded .xhtml** (new: `entity_lei`, from the filing's contexts) → an LEI in an uploaded file name (`549300…-2025-12-31-0-no.xhtml`) → the previous import |
| 2. Filing list | `GET https://filings.xbrl.org/api/entities/{LEI}/filings`. One filing per period end: fewest validation errors, then the newest (the index lists some filings twice: NO + LU, or en + no) |
| 3. Fetch | The newest **5** filings (`ESEF_INDEX_MAX_FILINGS`) as xBRL-JSON |
| 4. Company check | Every fact must be reported for that LEI, otherwise the import is refused |
| 5. Map | `xbrl_json.py` turns xBRL-JSON facts into the same tagged facts the `.xhtml` parser produces. Mapping is now one shared function, `map_tagged_facts()`, so both routes use the same concept priorities, owner's-view outflows, hybrid capital and integrity checks |
| 6. Pick one filing per year | A year comes from **its own** filing. The year before the first ESEF filing comes from the next filing's comparative column (FY2020 from the FY2021 report) |
| 7. Store | Each filing becomes an `esef_index_facts` Document (JSON stored, sha256-deduplicated) with LEI, filing id, report + viewer URL and integrity result. Every figure points at its filing |

### Rules

| Rule | Why |
|---|---|
| **Years already on file are skipped** (from an upload or SEC EDGAR), and listed as skipped | One source per year, as with EDGAR |
| **Re-import replaces the previous import's figures** (Documents stay) | Same as EDGAR |
| A filing that can't be fetched → a warning; the others still import | That year may still come from a comparative column |
| Statement checks that fail, or index validation errors → warnings on the card | Fail visibly |
| Not an LLM anywhere | CLAUDE.md Rule 1 |

The index runs about a year behind for Norway (newest filings: FY2024). **Upload the latest report as usual.** Order doesn't matter: whichever source stores a year first keeps it.

### Where it shows

| Place | What |
|---|---|
| Holding → **Primary sources** | New card **Earlier annual reports (ESEF index)** for Oslo/NOK holdings: LEI field (pre-filled when found, with where it came from; checks the LEI's check digits), **Import history**, years imported, years skipped, warnings, one link per filing (opens the XBRL viewer) → years used |
| Metrics, valuation, margin of safety, analysis | Read the imported years like any others (tested: ROE on average equity uses the imported prior year) |
| Evidence packet **v7** | New `financial_sources` item: which years came from which ESEF filing, with the report URL as citation |
| System status | New row *ESEF history import (filings.xbrl.org)* |
| Documents list | Note on each imported filing: *"ESEF filing from filings.xbrl.org, years …"* |

### API

| Endpoint | |
|---|---|
| `GET /sources/holdings/{id}/esef-index` | Last import + the LEI found on file (`suggested_lei`, `suggested_lei_source`) |
| `POST /sources/holdings/{id}/esef-index/import` | Body `{"lei": "…"}` optional. Errors come back as 422 with a message for the UI |

New settings (all optional): `ESEF_INDEX_PROVIDER=filings_xbrl_org` (or `none`), `ESEF_INDEX_MAX_FILINGS=5`, `ESEF_INDEX_TIMEOUT_SECONDS=60`. No migration: `documents.type` is a string column.

---

## 3. Also fixed

Ruff flagged 3 lint errors that came in with Sprint 9 (`models/__init__.py` `__all__` order, an import order in `evidence_packet.py`, `Decimal("30")` in a test). CI would have failed on them. Auto-fixed, no behaviour change.

---

## 4. Tests

| Suite | Result |
|---|---|
| Backend pytest | **744 passed** (19 new: 6 upload slimming, 12 xBRL-JSON + import rules + provider, 1 API) |
| ruff | clean |
| Frontend | tsc, eslint clean; vitest **19** (3 new: LEI check digits); build OK |
| Migrations | none |

Key tests: the same filing as `.xhtml` and as xBRL-JSON gives **identical** metrics; stripping media leaves facts and text identical; uploaded years are kept; a filing for another LEI is refused.

**Not verified live:** filings.xbrl.org (blocked from this session), Railway, a real 99 MB Orkla file.

---

## 5. What Faiz needs to do

| # | Action |
|---|---|
| 1 | Commit + push from GitHub Desktop, redeploy Railway |
| 2 | Upload `Orklaasa-2025-12-31-1-no.xhtml` again. Expected: accepted, with a note like *"… images/fonts removed on upload (94 MB → x MB)"* |
| 3 | On Vår Energi (after re-uploading its FY2025 `.xhtml`): Primary sources → **Import history**. Expected: FY2023–FY2021 (+FY2020) imported, FY2024 skipped (it's in the FY2025 upload's comparatives) |
| 4 | Same for Salmon Evolution and Orkla. Tell me the warnings shown, if any |
| 5 | If Railway (or Yahoo-style blocking) stops the fetch, run the import once from the local backend |

---

## Suggested git commit message

```
Sprint 10: ESEF history import from filings.xbrl.org + large .xhtml uploads

Large ESEF uploads: base64 images/fonts are stripped before the file is
stored and parsed (facts and text identical, tested); duplicate check
still on the original hash; iXBRL limit 80 -> 250 MB; size errors in MB.
Fixes Orkla 2025 (98.6 MB) being rejected.

ESEF history (Sprint 9 layer D): import earlier annual reports by LEI
from filings.xbrl.org as xBRL-JSON, mapped by the same code as uploads
(new map_tagged_facts). One filing per year, comparative column for the
year before the first filing, years already on file skipped, re-import
replaces, LEI mismatch refused. LEI read from uploaded .xhtml contexts.
New GET/POST /sources/holdings/{id}/esef-index, Primary sources card,
System status row, evidence packet v7. No migration.

Also: ruff fixes for 3 lint errors from Sprint 9.
744 backend tests (19 new), 19 vitest (3 new).
```
