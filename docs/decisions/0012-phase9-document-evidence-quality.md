# 12. Phase 9 (proposed) — document evidence quality

## Status

Proposed — design only, not built. Recorded 2026-09-14 after Faiz reviewed the live Documents tab
(Vår Energi: a 208-page annual report and a 55-page quarterly report, both `PROCESSED`, both
`FACTS: 0`) and asked what value document upload is actually delivering, and what a next phase
should look like.

## Context

`FACTS: 0` on both Vår Energi documents is **expected, not a bug** — Phase 1 only ever populates
`financial_line_items` from XLSX (exact label-match extraction, `app/services/documents/extraction/
xlsx.py`); PDF/PPT were deliberately never given a structured extractor (ADR 0002, reaffirmed in
ADR 0006). That is not where PDF/PPT value comes from. The real path is: full page text is
extracted per page (`extraction/pdf.py`/`pptx.py`) and stored as `document_pages`/`document_chunks`
(one page = one chunk), then — only when an **analysis run** happens for that holding, not at
upload time — `app/services/analysis/context.py::_build_document_evidence` pulls chunks into the
evidence packet the Gemini persona reads qualitatively (moat, management quality, earnings
quality, thesis divergence, etc.).

Reviewing that function against Vår Energi's actual documents surfaces two problems ADR 0006 named
as deliberate v1 simplifications, now visibly consequential rather than hypothetical:

1. **The excerpt budget (`settings.llm_excerpt_char_budget`, default 12,000 characters) is one
   shared pool per holding, consumed in most-recently-uploaded-document-first, page-order.** Vår
   Energi's quarterly report was uploaded after the annual report, so it's read first; a financial
   report page typically runs a few thousand characters of extracted text once tables/whitespace are
   included, so the budget is plausibly exhausted within the *first several pages of the quarterly
   report alone* — before the evidence builder ever reaches the 208-page annual report. In the
   worst case, the annual report — by far the more information-dense document — contributes **zero**
   content to any analysis run for this holding. This is recorded (`excerpts_truncated: true` /
   `AnalysisContext.excerpts_truncated`, per §21 "visible, not silent"), but nothing about it shows
   on the Documents tab Faiz is looking at — there's no way to tell from that screen whether an
   upload will actually reach an analysis.
2. **Selection has no relevance ranking — page order only.** ADR 0006 flagged this explicitly as a
   "deliberate v1 simplification... a real relevance-ranking pass... is a natural Phase 4/5-era
   follow-up once there's enough document volume per holding for it to matter." One holding with a
   200+ page annual report already meets that bar in practice.

A third, related gap: because structured `financial_line_items` are XLSX-only, a holding analyzed
from PDF/PPT sources alone (like Vår Energi today) gets `financial_metrics.insufficient_data =
True` — no revenue growth/EBITDA margin/ROE in the evidence packet or deterministic scoring input —
unless someone separately uploads an XLSX with the same figures. "FACTS: 0" therefore understates
the gap: it isn't just that this document didn't produce facts, it's that no PDF-only holding can
get a structured metric at all today.

None of this is new instability — Phase 3 (§26) is done and the app works as designed. This is the
next layer of value on top of an already-working pipeline, matching PROGRESS.md's existing
"Feature gaps" line ("Evidence-packet excerpt selection has no relevance ranking, just
most-recent-first") and the fact that document upload is now something Faiz is actually using.

## Proposed scope (ordered by leverage vs. effort)

1. **Per-document evidence budget, not one shared pool.** Give each `PROCESSED`/`VALIDATED`
   document on a holding its own share of `llm_excerpt_char_budget` (even split, or a fixed
   per-document floor plus most-recent priority for what's left) instead of first-doc-consumes-all.
   Fixes the "large annual report gets zero content" failure mode outright, no new dependencies, no
   schema change — a rewrite of `_build_document_evidence`'s allocation loop.
2. **Surface evidence usage on the Documents tab.** Extend `DocumentOut`/the documents list with
   something like `pages_used_in_last_analysis` or an included-vs-total ratio, so a PDF with
   `FACTS: 0` doesn't read as "nothing happened" — it should show, e.g., "12 of 208 pages used as
   evidence (truncated)" or "not yet analyzed." This is the most direct answer to "what value are we
   getting here": make the pipeline's actual behavior visible where Faiz is already looking, instead
   of only inferable from an analysis run's citations.
3. **Section-aware chunk prioritization** — a cheap step before real embeddings. Financial reports
   have predictable structural markers ("Management's Discussion", "Consolidated Statement of...",
   "Risk Factors", chairman's letter, notes to the financial statements). A keyword/regex classifier
   run once at ingestion time, stored as a new `DocumentChunk.section_hint` column, lets evidence
   selection prefer financially load-bearing pages over cover pages and legal boilerplate — most of
   the practical benefit of relevance ranking, shippable in days without embeddings infrastructure.
4. **Real relevance ranking** — the item ADR 0006 already named as the eventual follow-up.
   Embeddings-based chunk retrieval: embed each `DocumentChunk` once at ingestion (cacheable, one-time
   cost), embed a short query derived from the holding/sector/prior thesis, select top-K chunks by
   similarity within budget. Heavier build (new dependency, new column, a batch backfill step for
   already-ingested chunks) — worth scoping once 1-3 are in and it's clear from real analysis runs
   whether the cheaper steps were enough.
5. **Close the PDF financial-metrics gap**, so a PDF-only holding isn't permanently
   `insufficient_data`. Two options, escalating in effort and risk to §2.2's "LLM doesn't do the
   arithmetic" principle:
   - (a) Have the existing analysis pass also emit a small set of "reported figures" (revenue/
     EBITDA/net income by period) as structured output, persisted into a **new**, explicitly
     lower-confidence, LLM-derived table — never written into `financial_line_items` (which stays
     tier-1/2 deterministic-only per ADR 0006) — that the scoring engine can optionally use and the
     UI always labels as LLM-derived, not extracted.
   - (b) A real PDF table extractor (pdfplumber/camelot) targeted at income-statement/balance-sheet
     pages, feasible once (3) can reliably locate those pages. Properly deterministic, matches the
     existing tier-1 bar, but the harder build — probably not worth it before (3) exists to point it
     at the right pages.
6. **Persist per-run evidence provenance.** Store which `evidence_id`s/chunk IDs were actually
   *included* in a given `AnalysisRun`'s packet (today only inferable from `excerpts_truncated` plus
   whatever the LLM chose to cite) so a completed run is auditable after the fact — "what did the
   model actually see" — not just "was something truncated."

## Suggested sequencing

1 and 2 first — no new dependencies, directly fix the concrete Vår Energi failure mode, and make
the pipeline's value visible on the screen Faiz is already using to judge it. 3 is a reasonable
next step before reaching for embeddings. 4 and 5 are the heavier, genuinely-new-capability items —
worth scoping once 1-3 are shipped and real analysis runs show whether they're still needed.

## Recommended verification before building

None of the specific numbers above (12,000-char budget consumed within N pages) are confirmed
against Vår Energi's real documents — they're a reasoned estimate from typical financial-report
page density, not a measurement. Before investing in a fix, the cheap verification step is: run
`POST /analysis/snapshots/{id}/runs` for Vår Energi on the live deploy (already an open item in
PROGRESS.md — "AI analysis (Gemini)... no confirmed run against the live deploy yet") and inspect
the persisted `AnalysisContext`/evidence payload for that run — specifically `excerpts_truncated`
and how many of the annual report's chunks appear among the cited `evidence_id`s. That single run
would confirm or correct the estimate above and is worth doing either way, since it's also the
first live check of the whole Phase 3 pipeline post-deployment.

## Consequences

- No schema migration is required for items 1-2; item 3 adds one nullable `DocumentChunk` column;
  item 4 adds an embedding-storage column/table and a backfill job for existing chunks; item 5(a)
  adds one new table, clearly separated from the deterministic `financial_line_items` tier.
- This phase doesn't touch `financial_line_items`, XLSX extraction, or the deterministic scoring
  weights — it only changes what evidence reaches the LLM and what the UI shows about that, so the
  existing confirmation-bias guardrail and scoring determinism (ADR 0006) are unaffected.
- Doesn't block or get blocked by Phase 8 (precious metals/whisky) — different part of the system,
  can be sequenced independently.
