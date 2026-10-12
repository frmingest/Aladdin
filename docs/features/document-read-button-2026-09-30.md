# "Read" button for stored documents — 2026-09-30

**Ask (Faiz):** every stored document reference should have a URL and an eye "Read" button that opens the report in the browser, with a smooth transition into read mode.

**Status:** written, not committed, not deployed, not checked live. No migration.

## What it does
| Piece | Detail |
|---|---|
| Endpoint | `GET /documents/{id}/file` — the stored original; `?download=true` forces a download |
| Inline types | PDF, HTML / XHTML. PPTX / XLSX / CSV download instead |
| Safety | HTML is served with `Content-Security-Policy: sandbox; default-src 'none'…` and `nosniff`; in the app it renders in an empty-`sandbox` iframe (no scripts) |
| Auth | Same `X-API-Key` gate; the frontend fetches with the key and shows the file from a blob |
| API fields | `DocumentOut.file_url`, `DocumentOut.viewable_in_browser` (computed) |
| Reader | Full-screen, grows out of the clicked eye; fade + blur backdrop, scale-in / scale-out, Esc or click-outside closes; reduced-motion respected |
| Where | Filings table · source under each extracted figure (Metrics) · fund "Source:" line |

## Deliberate limits
- **No "open in new tab" for HTML filings.** A blob tab runs with the app's origin (and its API key); filings are untrusted (CLAUDE.md rule 5). PDFs do get it.
- Other places that only *select* a document (fund-returns dropdowns) have no button yet.
- External links on the Primary sources card already point to the original site, so they were left alone.

## Files
Backend: `api/documents.py`, `schemas/document.py`, `services/documents/viewing.py`, tests in `tests/unit/test_document_viewing.py` and `tests/integration/test_documents_api.py`.
Frontend: `components/DocumentReader.tsx`, `lib/documents.ts` (+ test), `lib/api.ts` (`fetchDocumentFile`), `tailwind.config.js`, `HoldingDetailPage.tsx`, `FundFactsPanel.tsx`.

## Not verified
Animations not seen in a browser; 4 integration tests not run (no disk space for backend deps on the build machine).
