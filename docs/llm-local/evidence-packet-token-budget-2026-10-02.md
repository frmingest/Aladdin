# Evidence packet token budget — big holdings can no longer outgrow the local model

**Date:** 2026-10-02 · **Status:** written + tested (24 new tests, whole backend 1,357 pass, ruff clean), **not yet run on the real GPU**

## What happened

The 2026-10-01 overnight run completed everything except **Equinor (EQNR.OL)** and **Aker BP (AKRBP.OL)**:

`No model fits fully on the GPU for this call (needs ~33,664 tokens …). Tried qwen3:14b: … max context 24,576; qwen3:8b: … max context 32,768.`

## Root cause

Not the GPU, and not the document excerpts (those were already capped at 4,000 tokens). The evidence
packet had **no ceiling**: macro, sector and company research items were added in full, up to 15
announcements, five years of history, every fund holding line. A big oil and gas name simply carried
more of all of it. The planner's estimate (3 characters per token, +5%, plus an 8,192-token answer
reserve) put it ~1,000 tokens over even the 8b's 32k limit. Fixing those two holdings by hand would
only have moved the problem to the next stock, or the next upload.

## The fix (`backend/app/services/analysis/packet_budget.py`)

A deterministic size limit applied to **every** packet (equity and fund) after it is built and before
any prompt is rendered:

| Layer | What it does |
|---|---|
| **Caps (always on)** | Per-item and per-category ceilings on everything that can grow with data: announcements 2,500 tokens, macro 1,500, sector 1,500, company 2,500, document excerpts 4,500, macro indicators 2,500, fund holdings 3,500, look-through 3,000. 10 or 1,000 research items give the same packet size. |
| **Total budget** | `EVIDENCE_PACKET_TOKEN_BUDGET` (default 18,000 estimated tokens), further limited for the local model to what actually fits: largest context (40,960) − answer (8,192) − blind-pass JSON re-read by the reconciliation pass (8,192) − prompt overhead (4,000) = 20,576. **Both passes fit by construction.** |
| **Trim order under pressure** | Announcements → macro research → sector research → company research → document excerpts → macro indicators → fund lists, each squeezed toward a floor. **Never cut:** holding identity, financial history, valuation, financial sources, fund facts (the numbers the analysis stands on). |
| **Owner's notes** | Capped at 2,000 tokens in the reconciliation prompt only (the blind pass never sees notes), cut with a visible marker. |
| **Visible** | Each run stores what was kept/shortened/dropped (`evidence_packet_json.token_budget`) and adds one line to the run's evidence notes: `evidence trimmed to fit the local model (~23,900 -> ~17,900 estimated tokens …): regulatory_announcements: kept 4 of 15 items; …`. The log also prints tokens per category for every run. |
| **Stable citations** | Evidence IDs are never renumbered; a dropped item's ID just no longer appears. |

Also: `OLLAMA_FALLBACK_NUM_CTX` default **32,768 → 40,960** (qwen3's native maximum; qwen3:8b at 40k needs ~9–10 GB with the q8_0 KV cache). The planner only uses that band when a call needs it and still checks the GPU share first.

## Settings

| Setting | Default | Meaning |
|---|---|---|
| `EVIDENCE_PACKET_TOKEN_BUDGET` | `18000` | Total packet ceiling (estimated tokens, conservative: real tokens come out ~25% lower). `0` = no configured limit (caps and the derived local limit still apply) |
| `ANALYSIS_PROMPT_OVERHEAD_TOKENS` | `4000` | System prompt + wrapper text + capped notes, used to derive the local limit |
| `ANALYSIS_NOTES_MAX_TOKENS` | `2000` | Longest owner note sent to the reconciliation pass |
| `OLLAMA_FALLBACK_NUM_CTX` | `40960` | Largest context the 8b fallback may use |

**Quality trade-off, by choice:** at 18,000 the packet needs a ~27k context, which qwen3:14b cannot hold on a 12 GB card, so qwen3:8b runs those calls (as it already did). To give the 14b the calls, lower `EVIDENCE_PACKET_TOKEN_BUDGET` to ~8,000 (research and announcements shrink further). The numbers behind the valuation are never cut either way.

## Do on the PC

- `git pull` in `E:\Aladdin` after the PR is merged and deployed; restart backend and worker.
- `ollama pull qwen3:8b` if not done; `OLLAMA_FLASH_ATTENTION=1`, `OLLAMA_KV_CACHE_TYPE=q8_0` as User variables; restart Ollama.
- Re-queue **Equinor** and **Aker BP**. Expect the run to show the `evidence trimmed …` line and model `qwen3:8b`.

## Not done / limits

- Not run against the real Ollama or real packets. The category sizes in the table are caps chosen without a measurement of today's real Equinor packet; the first run's per-category token log (and `token_budget` on the run) shows exactly where the tokens were, so the caps can be tuned from data.
- If the protected numbers alone ever exceed the budget (an extreme fund with huge fact sections), the packet is left over the limit and the note says `STILL OVER`; the Ollama planner then decides as before.
- Tokens are estimated (no tokenizer); the estimate is deliberately pessimistic.
