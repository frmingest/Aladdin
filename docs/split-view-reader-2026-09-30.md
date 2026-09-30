# Split-view document reader — 2026-09-30

**Ask (Faiz):** open a financial report on one side of the screen with the statements stored from it on the other — and does the PDF viewer support XHTML?

**Status:** step 1 (split view + page jump) committed as `cca6169`. **Step 2 (exact-number highlight) written and tested, not committed, not deployed, not seen in a browser.** No migration.

## Answer to "does the PDF viewer support XHTML?"
No, and it doesn't need to. PDFs use the browser's own PDF viewer. XHTML filings were already shown separately, as sandboxed HTML in an iframe. Both open in the same reader; the new split view works for both.
Stored XHTML has embedded images stripped at upload (Sprint 10), so pictures/charts are missing; text and tables are intact.

## What it does
| Piece | Detail |
|---|---|
| Layout | Filing on the left, **figures pane** on the right. Draggable divider (also ←/→ when focused), **Hide figures** button. Below `lg` the two become **Filing / Figures** tabs |
| Figures pane | The figures stored from that file (`GET /documents/{id}`), grouped into Income statement / Balance sheet / Cash flow / Other, one column per fiscal year. `≈` marks derived or proxy figures |
| Jump | Press a figure → XHTML: the filing scrolls to **that exact number, highlighted in amber** (derived figures: the page is outlined). PDF: opens at `#page=N` |
| From Metrics | The eye next to a figure in Metrics opens the filing at that exact number, with its row emphasised |
| Highlight | Exact number: amber background + outline via CSS `:target`, scrolled to the middle of the view. Page fallback: orange page outline via `:target` + `:has()` (scrolling works without `:has()`) |

## How the jump works without scripts
The iframe keeps its **empty sandbox** (CLAUDE.md rule 5). When an HTML/XHTML filing is served for reading, `services/documents/anchoring.py` inserts an empty `<a id="aladdin-page-N">` as the first child of each report page, using the **same page detection as the extractor** (`_page_containers`), so N equals `financial_line_items.source_page`. The stored original is never changed; `?download=true` returns the untouched file. On any parse error or a file without detectable pages, the original bytes are served.
Output is serialised as HTML (not XML) so empty elements like `<div/>` are not misread as open tags in `text/html`.

## Step 2 — how the exact number is found
The stored figure has `metric`, `period`, `value`, `source_page` but not *which* tagged number it came from. When the file is served, `anchoring.py` looks on the figure's own page for the non-dimensional annual `ix:nonFraction` with the same fiscal year and the same magnitude — using the extractor's own helpers (`_parse_contexts`, `_fy_label`, `_ix_number`) so period labels and scaling can't drift. A match is wrapped in `<span class="aladdin-fact" id="aladdin-fact-<metric>-<period>">` (text around it is untouched; two figures with the same number nest). No match → an empty `<a class="aladdin-fact-page" id=…>` at the top of the page, so **every** stored figure with a page has a link target and the frontend never needs to know which kind. The reader builds the same id (`factFragment`, sanitising to `[A-Za-z0-9_-]`).

## Limits
- PDFs: no figure extraction exists (text only), so most PDFs have no figures pane. A PDF figure with a page would jump.
- CSV/XLSX-sourced figures have no page, so they are listed but not clickable.
- First open of a big XHTML re-parses it: a 27 MB synthetic file took ~4 s. Browser caches the response for 5 min. A real 36 MB Vår Energi file was not timed.
- Derived figures (total debt = long + short-term borrowings, EBITDA, capex sums …) are not one tagged number, so they outline the page instead of one number.
- A number is matched by page + fiscal year + magnitude; if a page shows the same number twice for the same year (e.g. a highlights box and the statement), the first one wins.

## Files
Backend: `services/documents/anchoring.py` (new), `api/documents.py` (passes the document's stored figures), `tests/unit/test_document_anchoring.py` (14 tests), `tests/integration/test_documents_api.py` (+1).
Frontend: `components/DocumentReader.tsx`, `components/StatementsPane.tsx` (new), `lib/statements.ts` (+ test, new), `lib/documents.ts` (`pageFragment`, `factFragment`, + test), `lib/api.ts` (`getDocument`), `lib/types.ts` (`DocumentFact`, `DocumentDetail`), `pages/HoldingDetailPage.tsx`.

## Verified / not verified
- ✅ Backend: 60 pass across the documents API integration tests (incl. the 4 Read-button tests that had not been run before, and 1 new), anchoring, iXBRL extraction, viewing and ingestion. A 27 MB synthetic filing still anchors in ~4 s.
- ✅ Frontend: tsc clean, eslint clean, vitest 35/35 (14 new across both steps).
- ❌ Not seen in a browser: layout, divider drag, tabs, animation, the amber highlight and scroll position, the `#page=N` jump inside Chrome's PDF viewer, `:has()` outline.
- ❌ Not run against a real ESEF file.
