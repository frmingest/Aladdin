# 6. Phase 3 — AI analysis engine

## Status

Accepted

## Context

Phase 3 (§26) is the first phase with an AI dependency: evidence packet /
AnalysisContext, Buffett/Munger reasoning, structured LLM output, evidence
references, confidence, analysis runs, and memo generation. Several
implementation-level decisions weren't settled by the architecture doc, and
one scope question was explicitly resolved by Faiz before building: whether
PDF/PPT reports (Phase 1 deferred *structured financial-fact* extraction
from them — see ADR 0002) should get that structured extraction built out
now, or be handled differently.

**Resolution: PDF/PPT content is read and interpreted by the LLM directly,
not extracted into structured facts.** Phase 1 already extracts full page
text from PDF/PPT into `document_pages`/`document_chunks` (see
`app/services/documents/extraction/pdf.py`'s and `pptx.py`'s docstrings,
which explicitly flagged this as deferred "to Phase 3, alongside the rest
of the LLM pipeline"). Phase 3 uses that already-extracted text as
evidence-packet excerpts (§5.3) for the LLM to read qualitatively — moat,
management quality, earnings quality, and so on — rather than building a
second, PDF/PPT-specific deterministic line-item extractor. The LLM's
*output* (scores, reasoning) is what gets persisted, not a structured
restatement of the PDF's numbers. This matches §2.2 ("the LLM does the
reading and interpretation, not the arithmetic") more directly than
building a brittle PDF table-parser would have: `financial_line_items`
(deterministic, arithmetic-feeding) stays XLSX-only, exactly as ADR 0002
left it, while PDF/PPT feeds the qualitative side of the analysis only.

## Decisions

- **Evidence packet excerpt selection is naive: most-recently-uploaded
  documents first, all their chunks in page order, until a character
  budget (`settings.llm_excerpt_char_budget`, default 12,000) is
  exhausted.** No relevance ranking or embeddings yet. This is a
  deliberate v1 simplification, not an oversight — it's fully deterministic
  and cheap, and a holding with one recent, on-topic annual report will
  work well; a holding with many large, older documents will have some
  content silently outside the budget (flagged to the LLM via
  `evidence_truncated: true` in the payload, and to the run via
  `AnalysisContext.excerpts_truncated`, so this is visible, not silent —
  §21). A real relevance-ranking pass (e.g. embeddings-based chunk
  retrieval) is a natural Phase 4/5-era follow-up once there's enough
  document volume per holding for it to matter.
- **The confirmation-bias guardrail (§11.3) uses
  `portfolio_positions.notes` as the "existing thesis" input, not a
  dedicated thesis object.** The thesis ledger (§16, `investment_theses`
  table) is Phase 5 — it doesn't exist yet. Using the Notes field already
  captured at portfolio upload (§7) as the stand-in means the guardrail is
  real and working today rather than deferred alongside the ledger itself;
  when Phase 5 lands, the natural migration is to prefer a holding's
  `investment_theses` row when one exists and fall back to
  `PortfolioPosition.notes` otherwise.
- **Pass 2 (reconciliation) never touches the factor scores.** Its output
  schema (`ReconciliationOutput`) has no `business_quality`/
  `financial_strength`/`valuation` fields at all — structurally, not just
  by prompt instruction, it cannot overwrite Pass 1's scores. The merge in
  `app.services.analysis.llm_analysis.run_two_pass_analysis` always takes
  the three factor scores from the blind pass; reconciliation only
  contributes `thesis_divergence`, `additional_risks`, and
  `additional_considerations`. This was judged the more faithful reading of
  §11.3's "the analysis risks becoming a rationalization" concern than
  letting a later pass revise the independent scores.
- **When a holding has no notes for that snapshot's position, the
  reconciliation pass is skipped entirely** (no LLM call, no comparison) —
  `thesis_divergence` is filled deterministically with
  `material_disagreement: false` and an explicit "no notes on record"
  message, rather than asking the LLM to compare against nothing (§21:
  don't fabricate a comparison; §2.9: don't spend an API call producing
  nothing new).
- **`HoldingAnalysisOutput` (§12's contract) simplifies the illustrative
  shape**: one `source_references: list[str]` of cited `evidence_id`s
  stands in for §12's separate `supporting_evidence`/`contradicting_evidence`
  arrays. This still satisfies Definition of Done's "material claims have
  evidence references" (§27) while keeping the v1 schema/prompt smaller;
  splitting citations by stance is a straightforward, backward-compatible
  v2 addition (new `schemas/versions/analysis_output_v2.json`) if it proves
  valuable once real analyses are reviewed.
- **`overall_score` is a deterministic weighted average of the three
  factor scores** (`app/domain/scoring.py`, weights in
  `scoring/versions/v1.yaml`: business_quality 0.40, financial_strength
  0.30, valuation 0.30), never LLM-produced (§28 rule 4). Portfolio-level
  risk (concentration/HHI, Phase 2) is not blended in — §14 keeps it a
  separate dimension. `overall_confidence` is the minimum of the three
  factor confidences (§21: never overstate certainty via averaging away a
  low-confidence factor).
- **`EvidenceReference` rows are created only for `evidence_id`s the LLM
  actually cited** in `source_references`, filtered against the evidence
  items that genuinely existed in that run's packet — an id the model
  invents (didn't exist in what it was given) is silently dropped rather
  than persisted as a reference to nothing (§28 rule 10). This is a
  narrower reading of "material claims have evidence references" (§27) than
  auto-citing everything shown to the model; it means a factor's
  `reasoning` can currently reference evidence in prose without every such
  mention producing a formal `EvidenceReference` row unless the model
  explicitly listed that id — acceptable for v1, and something prompt
  iteration can tighten.
- **Table-shape deviations from §20's illustrative schema**:
  `evidence_references` keys off `holding_analysis_id` rather than a
  generic `analysis_id`, because Phase 3 only ever analyzes at the holding
  level — portfolio-level synthesis (and its own evidence) is Phase 5's
  `portfolio_risk_snapshots`, not built here. `valuation_cases`,
  `portfolio_risk_snapshots`, and `calibration_checks` from §20 are Phase
  5/6/22.5 concerns and are not created by this migration.
- **Analysis runs execute synchronously within the API request**, not via
  APScheduler (§4's suggested background-job library). At single-user,
  on-demand scale this is simpler and avoids the operational surface of a
  job queue (§2.9); a run over N holdings makes 1-2N Gemini calls
  sequentially. Revisit once run latency or frequency makes that
  uncomfortable.
- **Financial-metrics period comparison is a lexical sort of period
  labels** (`app/services/analysis/context.py::_build_financial_metrics`),
  inherited as a known limitation from how `financial_line_items.period` is
  stored (free-text label, Phase 1) — e.g. "FY9" would incorrectly sort
  after "FY10". Not a practical issue yet given the small number of periods
  any single holding has today; a real fix belongs with a broader look at
  how periods are normalized, not a one-off patch inside Phase 3.

## Consequences

- A holding with only an XLSX-derived financial fact and no market price
  yet (or vice versa) can still be analyzed — `InsufficientContextError` is
  raised only when a holding has *none* of documents, financial facts, or
  market data. Partial evidence is explicitly labeled as such in the
  payload (`insufficient_data`, `data_status: "unavailable"`) for the model
  to account for, rather than blocking the run outright.
- Running Phase 3 for real requires a Google AI Studio API key
  (`GOOGLE_AI_STUDIO_API_KEY` in `backend/.env`) — see ADR 0005. Until one
  is set, `POST /analysis/snapshots/{id}/runs` fails immediately with an
  explicit `LLMUnavailableError` naming the missing key, not a silent no-op.
- No caching of LLM responses across runs — every analysis run makes fresh
  API calls even if the evidence packet is identical to a prior run. At
  free-tier, on-demand volume this wasn't judged worth building yet (§2.7
  calls for caching aggressively, but there's no repeated-identical-call
  pattern to cache here the way FX rates within one valuation refresh have).
