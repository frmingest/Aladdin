# Local LLM data scaling — will more holdings/documents break Ollama? (2026-09-27)

Faiz asked for an analysis of current holdings/watchlist volume vs. the local Ollama setup, and
whether growing document counts will cause more failures over time. **Research only — no code
changed.**

---

## 1. Bottom line

| Question | Answer |
|---|---|
| Will more **documents per holding** overflow the context window? | **No, by design.** Evidence selection is already capped (see §3) — document count doesn't feed the prompt directly |
| Will more **holdings/watchlist items** cause failures? | Not context failures. The real cost is **queue time** — everything runs one at a time on one GPU (§4) |
| What actually caused today's real failure (XDEF.DE)? | **Schema size**, not document volume — a fund's extra output section, fixed this session (see [doc](local-llm-fund-output-limit-fix-2026-09-27.md)) |
| What's the actual scaling ceiling? | The **12GB VRAM / 24k-token context** combination on the RTX 3060, shared by prompt + output. That's fixed regardless of how much is in the database |

**In short:** the system was already built with a scaling guard for document volume (a fixed
~4,000-token excerpt budget, newest-4-documents-only). The failure you hit was a different kind —
the model's *own answer* (JSON schema output) outgrowing its budget, which just recurred once as
funds were added and is now fixed with headroom. The thing that *will* visibly get worse as the
portfolio grows is **how long the overnight queue takes**, not the LLM failing mid-run.

---

## 2. Portfolio size right now

No live database query was run for this (would need the Supabase credentials, which are already
flagged for rotation in progress.md §2). Counting from what's named across the project's own docs:

| Type | Named holdings |
|---|---|
| Oslo Børs equities (get full Newsweb annual + interim report automation) | Vår Energi, Salmon Evolution, Orkla, Kongsberg Gruppen — **4** |
| Funds / ETFs / ETCs | Xtrackers Europe Defence Tech (XDEF.DE), Xetra-Gold, L&G Gold Mining, Heimdal Utbytte A, Heimdal Utbytte N, Heimdal Høyrente Pluss B, Alfred Berg Nordic High Yield II R — **7** |
| Watchlist items | Feature exists (F7); none named in the docs reviewed |
| Precious metal coins | Tracked separately (F15) — priced from a spot API, not analyzed by the LLM at all |

So **~11 LLM-analyzable holdings today**. That's a small enough number that none of the scaling
concerns below are currently biting — this is about what happens if that grows to 30, 50, 100.

---

## 3. Why document *count* is already bounded (the good news)

Sprint 6 (evidence quality) deliberately built a hard ceiling, independent of how many documents
are on file for a holding:

| Guard | Value | Effect as documents pile up |
|---|---|---|
| Document excerpt budget | **4,000 tokens total**, fixed | Adding a 5th, 10th, 20th filing never grows the prompt |
| Documents considered | **Newest 4 only** (`EVIDENCE_DOCUMENTS_MAX`) | Older filings are stored and still contribute extracted *figures*, but their prose is never re-read once 4 newer documents exist |
| Per-document share | Max 60% of the budget when 2+ documents | One huge report can't crowd out everything else |
| Per-excerpt length | 1,600 chars, cut at a sentence | Keeps 8–12 short passages instead of 2–3 long ones |
| Selection method | Deterministic keyword/section scoring (no embeddings — decision 22) | Cheap, no extra LLM/embedding call, same cost at 4 documents or 400 |

This means the Newsweb bulk-fetch features (F17 annual reports back to ~2022, F19 half-year
reports) can keep adding documents indefinitely per holding — 4 years of annuals + ~8 half-years
per equity is a realistic 12+ documents per holding within two years — **without** growing the
per-run prompt at all. The only cost is storage (see §6) and that older narrative text stops being
read once newer filings exist (a completeness trade-off, not a failure).

---

## 4. What actually gets worse: queue time, not context

Ollama on the 3060 runs **one model, one request at a time** (`OLLAMA_NUM_PARALLEL=1` — a second
parallel slot would spill the model to slow system RAM on a 12GB card). The worker also processes
the queue **serially**, one holding after another, each taking a few minutes for two passes
(blind + reconciliation).

| Holdings queued | Rough overnight queue time (2–5 min/holding, serial) |
|---|---|
| 11 (today) | ~20–55 min |
| 30 | ~1–2.5 hours |
| 50 | ~1.5–4 hours |
| 100 | ~3–8 hours |

At 11 holdings this is a non-issue. It becomes one as the watchlist grows, especially since the
queue only runs when Ollama, the backend and the worker are all left running, and a run whose
worker goes silent for 30 min gets re-queued (failing outright after 2 attempts) — a queue that's
still working through last night's backlog when new items get added compounds rather than resets.

This is a **throughput** ceiling, not a **correctness** one: a bigger queue means results arrive
later, not that any individual run is more likely to fail.

---

## 5. The failure mode that *can* recur: schema/output growth

The XDEF.DE failure ("stopped at the output limit") had nothing to do with how many documents
existed — it was that a **fund's answer shape** (`fund_v1`, 7 narrative sections) is bigger than an
equity's (`v1`, 6 sections), and the shared 8,192-token output cap didn't account for that. Fixed
today with a schema-aware budget (`LLM_MAX_OUTPUT_TOKENS_FUND=16384`) and a wider combined window
(`OLLAMA_NUM_CTX` 16384 → 24576) — see [doc](local-llm-fund-output-limit-fix-2026-09-27.md).

The pattern to watch: **any future schema growth** (a new analysis section, a longer prompt
template, a bigger evidence category) eats into the same fixed 24,576-token ceiling, split between
prompt and output. This is the one class of failure that isn't self-limiting the way document count
is — it needs a person (or a future session) to notice and re-tune the budgets, the same way this
one did. A couple of concrete numbers to keep in mind:

- Reconciliation pass's *prompt* embeds the blind pass's full JSON output — for a fund, that's
  up to 16,384 tokens of prior output becoming this pass's input, on top of the evidence packet again.
  That's the tightest point in the pipeline today.
- 24,576 tokens total, on a 12GB card with `q8_0` KV-cache quantization, is already a reasonably
  tuned ceiling for `qwen3:14b`. Raising it much further risks spilling to CPU (the exact problem
  the setup guide's Step 2 tuning avoids).

---

## 6. Where "more data" *does* cost something: object storage, not the LLM

Separate from anything Ollama sees, the raw uploaded/fetched files (ESEF `.xhtml`, PDFs) are stored
in object storage, and that volume grows in direct proportion to documents fetched:

- Already investigated 2026-09-27: Supabase Storage's 1 GB free tier is close to its limit —
  see [doc](object-storage-free-tier-alternatives-2026-09-27.md). Recommended move: Cloudflare R2
  (10 GB free, unlimited free egress), not yet built.
- Mitigating factor already in place: large ESEF files have embedded images/fonts stripped on
  upload (Orkla's went 98.6 MB → 3.2 MB) — see [doc](esef-history-import-large-uploads-sprint10-2026-09-25.md).
- As F17/F19's bulk multi-year fetch runs across more holdings, this is the resource that scales
  linearly with document count and will need the R2 move sooner rather than later if it hasn't
  happened yet.

This is a capacity/cost question, not a local-LLM reliability one — but it's the part of "too many
documents" that's real and currently unaddressed.

---

## 7. Recommendations, in priority order

| # | Recommendation | Addresses |
|---|---|---|
| 1 | **Build the move to Cloudflare R2** (already scoped, zero app-code change) | Object storage headroom as document volume grows — the actual near-term limit |
| 2 | **Build the LLM usage ledger** (already a backlog item in progress.md §3c) | Turns "will this be a problem?" from a guess into a number — tracks actual tokens/run over time so a schema-growth regression like §5 is caught before it fails, not after |
| 3 | **Watch queue depth, not context, as the watchlist grows** — the System status / Analysis queue pages already show pending count and worker state; if the nightly queue starts running past a useful window, that's the signal to act, not a context error | Throughput ceiling (§4) |
| 4 | **If the queue does become the bottleneck**, options in increasing effort: stagger analysis cadence (not every holding every night), let low-priority watchlist items fall back to Gemini (`LLM_FALLBACK_PROVIDER`, already wired) instead of competing for the one local GPU slot, or add a second local worker on another machine (the queue's compare-and-set claiming already supports multiple workers safely — tested with 4 in Sprint 5B) | Throughput ceiling (§4) |
| 5 | **Any time a new analysis section or evidence category is added**, re-check `OLLAMA_NUM_CTX` and the output-token budgets against it the way this session did for funds, rather than waiting for a live failure to surface it | Schema-growth failure mode (§5) |
| 6 | **Not recommended right now:** moving to embeddings/semantic search for document excerpts (deferred as decision 22) — the current deterministic scoring already caps cost regardless of document count; this would only be worth revisiting if excerpt *quality* (not volume/failures) becomes the complaint | Document selection quality, not scaling |

---

## 8. What this doesn't cover

- No live query was run against the real holdings/watchlist tables or the object storage bucket's
  actual size — the counts in §2 are as named in existing project docs, not a live count.
- Portfolio-level features (correlation matrix, performance reindexing) scale with holdings count
  too, but run in Python, not through Ollama — not a local-LLM concern, just worth knowing they're
  a separate scaling axis.
