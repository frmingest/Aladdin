# Split-view document reader — 2026-09-30

**Ask (Faiz):** open a financial report on one side of the screen with the statements stored from it on the other — and does the PDF viewer support XHTML?

**Status:** written and tested (logic only), **not committed, not deployed, not seen in a browser.** No migration.

## Answer to "does the PDF viewer support XHTML?"
No, and it doesn't need to. PDFs use the browser's own PDF viewer. XHTML filings were already shown separately, as sandboxed HTML in an iframe. Both open in the same reader; the new split view works for both.
Stored XHTML has embedded images stripped at upload (Sprint 10), so pictures/charts are missing; text and tables are intact.

## What it does
| Piece | Detail |
|---|---|
| Layout | Filing on the left, **figures pane** on the right. Draggable divider (also ←/→ when focused), **Hide figures** button. Below `lg` the two become **Filing / Figures** tabs |
| Figures pane | The figures stored from that file (`GET /documents/{id}`), grouped into Income statement / Balance sheet / Cash flow / Other, one column per fiscal year. `≈` marks derived or proxy figures |
| Jump | Press a figure → the filing scrolls to the page it was taken from (`source_page`). XHTML: `#aladdin-page-N`. PDF: `#page=N` |
| From Metrics | The eye next to a figure in Metrics opens the filing at that figure's page, with its row emphasised |
| Highlight | Landing page gets an orange outline via CSS `:target` + `:has()` (scrolling works without `:has()`) |

## How the jump works without scripts
The iframe keeps its **empty sandbox** (CLAUDE.md rule 5). When an HTML/XHTML filing is served for reading, `services/documents/anchoring.py` inserts an empty `<a id="aladdin-page-N">` as the first child of each report page, using the **same page detection as the extractor** (`_page_containers`), so N equals `financial_line_items.source_page`. The stored original is never changed; `?download=true` returns the untouched file. On any parse error or a file without detectable pages, the original bytes are served.
Output is serialised as HTML (not XML) so empty elements like `<div/>` are not misread as open tags in `text/html`.

## Limits
- PDFs: no figure extraction exists (text only), so most PDFs have no figures pane. A PDF figure with a page would jump.
- CSV/XLSX-sourced figures have no page, so they are listed but not clickable.
- First open of a big XHTML re-parses it: a 27 MB synthetic file took ~4 s. Browser caches the response for 5 min. A real 36 MB Vår Energi file was not timed.
- Jumping is page-level, not the exact number. Exact-number highlight (tag each figure's element with an id + `:target` rule) is the planned step 2.

## Files
Backend: `services/documents/anchoring.py` (new), `api/documents.py`, `tests/unit/test_document_anchoring.py` (6 tests).
Frontend: `components/DocumentReader.tsx`, `components/StatementsPane.tsx` (new), `lib/statements.ts` (+ test, new), `lib/documents.ts` (`pageFragment`, + test), `lib/api.ts` (`getDocument`), `lib/types.ts` (`DocumentFact`, `DocumentDetail`), `pages/HoldingDetailPage.tsx`.

## Verified / not verified
- ✅ Backend: 6 new tests + existing iXBRL (extraction) and viewing tests — 32 pass.
- ✅ Frontend: tsc clean, eslint clean, vitest 32/32 (11 new).
- ❌ Not seen in a browser: layout, divider drag, tabs, animation, the `#page=N` jump inside Chrome's PDF viewer, `:has()` outline.
- ❌ Not run against a real ESEF file.
