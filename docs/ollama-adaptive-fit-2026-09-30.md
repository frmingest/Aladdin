# Local LLM: adaptive fit — no more "only 78% on the GPU" failures

**Date:** 2026-09-30 · **Status:** written + unit-tested (33 tests in `test_ollama_provider.py`), **not yet run on the real GPU**

## What happened

The 2026-09-29 overnight batch failed for **every** holding (Storebrand, Sparebanken Øst, SpareBank 1 Sør-Norge, Salmon Evolution, Orkla, ETLX …) with
`Stopped early (model=qwen3:14b): only 78% of the model is on the GPU (OLLAMA_MIN_GPU_SHARE=95%)`.

## Root cause

`qwen3:14b` weighs ~9.3 GB. A fixed `OLLAMA_NUM_CTX=24576` adds a KV cache of roughly 2 GB (q8_0) to 4 GB (fp16) plus ~1 GB of working memory. On a 12 GB RTX 3060 that shared with Windows is more than fits, so Ollama put ~22% of the model on the CPU. The guard from 09-29 correctly refused to crawl — but it only checked **after the first token** (a wasted model load + prompt read), and it could only fail, never adapt. Same settings every night → same failure for every holding.

## The fix (backend/app/providers/ollama_provider.py)

Before each pass the provider now **plans**:

1. Estimate the call's need: prompt (chars ÷ 3, +5%) + output budget → smallest context band that holds it (8k / 12k / 16k / 20k / 24k, capped by `OLLAMA_NUM_CTX`).
2. Load the main model at that context (empty `/api/generate`, no tokens spent) and read the GPU share from `/api/ps`.
3. ≥ `OLLAMA_MIN_GPU_SHARE` → run. Otherwise try `OLLAMA_FALLBACK_MODEL_NAME` (default `qwen3:8b`, ~5 GB, fits with room to spare) at the same context.
4. A (model, context) that did not fit is remembered for 10 minutes, so the rest of the batch skips the reload.
5. Nothing fits → one clear error listing what was tried; `OLLAMA_MIN_GPU_SHARE=0` still runs anyway.

The model that actually ran is what the usage ledger and the run record (`self._model`), so a fallback is visible, not silent. Short calls use a small context, so they run **faster and with more headroom** than before.

## Update (2026-09-30, same day): "needs ~34,700 tokens but OLLAMA_NUM_CTX is 24,576"

First real run: every holding failed the new planner's own size check. Two causes: (1) it reserved the whole output *cap* (8k equity / 16k fund) inside the context although real answers are ~6-7k at most, and (2) the fallback model was capped at the same 24k as the 14b. Fixed: output reserve is now at most 8,192 tokens; the fallback model may use up to `OLLAMA_FALLBACK_NUM_CTX` (32,768; qwen3:8b at 32k needs ~8 GB incl. q8 KV cache); the chars-per-token estimate is learned from each real response instead of a fixed 3.0. Consequence: most big evidence packets (~20-26k tokens) will run on qwen3:8b, since the 14b cannot hold them on a 12 GB card. To keep the 14b for them, the evidence packet has to shrink.

## Settings

| Setting | Default | Meaning |
|---|---|---|
| `OLLAMA_ADAPTIVE_FIT` | `true` | Turn the preflight planner on/off |
| `OLLAMA_FALLBACK_MODEL_NAME` | `qwen3:8b` | Smaller model used when the main one spills. Empty = no fallback |
| `OLLAMA_FALLBACK_NUM_CTX` | `32768` | Largest context the fallback model may use |
| `OLLAMA_MIN_GPU_SHARE` | `0.95` | Unchanged |

## Do on the PC

- `ollama pull qwen3:8b` (5.2 GB) — the fallback must be installed (if it is not, it is skipped and the error says so).
- Confirm `OLLAMA_FLASH_ATTENTION=1` and `OLLAMA_KV_CACHE_TYPE=q8_0` are set as **User environment variables** and Ollama was restarted (tray → Quit → start). Without them the KV cache is 2× bigger.
- Close GPU-heavy apps overnight (browsers with hardware acceleration, games).
- After the next run: `ollama ps` should show `100% GPU`; the Analysis queue shows which model ran.

## Not done / limits

- Not exercised against a real Ollama (the cloud/VM sandbox cannot reach the PC's GPU) — first real run is the check.
- If most evidence packets need > ~12k tokens, the 14b will rarely fit and the 8b does most of the work. If you prefer 14b quality, lower the evidence budget or `LLM_MAX_OUTPUT_TOKENS` rather than the guard.
- The readiness card still reports the GPU share of a *loaded* model only.
