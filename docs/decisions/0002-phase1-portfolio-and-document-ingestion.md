# 2. Phase 1 — portfolio and document ingestion implementation choices

## Status

Accepted

## Context

Phase 1 (§26) needed several implementation-level decisions the architecture doc leaves open:
how to represent primary keys portably across Postgres and the SQLite database the test suite
uses, how strictly to validate the portfolio upload format, how far to take deterministic
financial-fact extraction before Phase 3's AI layer exists, and how the portfolio file itself
fits into the document/provenance model.

## Decisions

- **UUID primary keys via a cross-dialect `GUID` type** (`app/models/types.py`): a `TypeDecorator`
  that's a native `UUID` on Postgres and `CHAR(36)` on SQLite. The test suite runs against a
  temporary SQLite database (§22: tests shouldn't require external infrastructure — Docker
  wasn't installed yet when this phase was built), while production stays on Postgres per §31
  decision 1.
- **The portfolio CSV/XLSX upload is a `Document` too** (`type=PORTFOLIO_SNAPSHOT`,
  `holding_id=NULL`), not a separate table. It gets the same SHA-256 hashing, dedup, and object
  storage as holding-level reports for free, and `portfolio_snapshots.source_file_id` points at it
  — full provenance (§5.2) with no parallel code path.
- **Portfolio validation is all-or-nothing per upload**: any row error rejects the whole file with
  a 422 and a list of `{row, message}` errors, rather than silently dropping bad rows (§21 "fail
  visibly"). Weight-sum-to-100% is a warning, not a hard failure — cash sleeves and rounding make
  it a reasonable but non-binding sanity check.
- **Asset class and financial-metric labels are normalized through small explicit lookup tables**
  (`app/domain/asset_class.py`, `app/domain/financial_metrics.py`), not fuzzy matching. An
  unrecognized asset-class label maps to `OTHER` (row still accepted, raw label preserved); an
  unrecognized financial-statement row label is simply not promoted to a `FinancialLineItem` — it
  stays available as page/chunk text. Wrong guesses are worse than acknowledged gaps here (§5.1,
  §13.3).
- **Deterministic structured fact extraction is XLSX-only in Phase 1.** PDF and PPT ingestion
  captures full page/slide text and speaker notes (feeding `document_pages`/`document_chunks`),
  but table parsing and structured fact extraction from those formats is deferred — it needs
  either careful per-issuer table parsing or an LLM pass, neither of which belongs in a
  "no AI dependency" phase (§26). Nothing is lost; it just isn't promoted to `financial_line_items`
  yet.
- **Document processing failures don't fail the HTTP request.** Once a file passes basic
  readability and is stored, extraction failures mark the `Document` `FAILED` with a quality flag
  rather than raising a 500 — the upload already succeeded in the sense that matters (the source
  file is safely stored and hashed).

## Consequences

- Swapping SQLite out for a live Postgres in tests later (e.g. via testcontainers) needs no model
  changes — the `GUID` type already speaks both dialects.
- Extending recognized asset-class or financial-metric labels is a one-line addition to a lookup
  table, not a parser rewrite.
- PDF/PPT financial facts remain a Phase 3+ gap; anyone querying `financial_line_items` today will
  only find rows sourced from spreadsheets. This is intentional, not an oversight — see above.
