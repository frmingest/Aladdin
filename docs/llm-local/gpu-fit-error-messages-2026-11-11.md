# Local LLM: the "evidence too large" message was hiding a GPU-fit failure

**Date:** 2026-11-11 · **Status:** written + tested (backend 2,091 pass, ruff clean), not deployed, not run on the real GPU

## What happened

The 2026-11-11 queue run failed every holding on the blind pass with "The evidence was too large for the
model's context window. Lower the evidence budget...". The packets were in budget (about 8k to 15k estimated
tokens against 18,000). The hover text showed the real error:

- XDEF: `No model fits fully on the GPU (needs ~18,637 tokens). Tried qwen3:14b@20480 (skipped, did not fit a moment ago)`. `ollama ps` showed qwen3:14b at 20480 context on 93% GPU / 7% CPU, under `OLLAMA_MIN_GPU_SHARE` (95%), with 11.6 of 12 GB VRAM in use (Edge, Discord, Steam, VS Code, Claude app).
- SALME: `needs ~24,868 tokens ... qwen3:14b: max context 24,576`.
- In both, only qwen3:14b was tried. The planner adds the `qwen3:8b` fallback only when Ollama lists it as installed, and did so silently, so the fallback was almost certainly not installed (to confirm with `ollama list`).

## Why the message was wrong

`services/llm_errors.py` maps any text containing `num_ctx`, "context window" or "context length" to the
"evidence too large" sentence. The GPU-fit and GPU-share errors mention `OLLAMA_FALLBACK_NUM_CTX` and
`OLLAMA_NUM_CTX`, so they matched it.

## Changes

- `llm_errors.py`: a GPU rule ahead of the context rule ("does not fit on your GPU ... `ollama pull qwen3:8b` ...").
- `ollama_provider.py`: the "No model fits" error now lists `qwen3:8b (not installed -- run: ollama pull qwen3:8b)` when the fallback is missing.
- Tests in `test_llm_errors.py` and `test_ollama_provider.py`.

## Do on the PC

1. `ollama list`; if `qwen3:8b` is missing, `ollama pull qwen3:8b`, and check `OLLAMA_FALLBACK_MODEL_NAME` in `backend/.env`.
2. Close Edge, Discord and Steam while the queue runs; `ollama ps` should show 100% GPU for whichever model runs.
3. To keep the 14b for these packets instead, set `EVIDENCE_PACKET_TOKEN_BUDGET=8000`.
4. Re-queue the failed holdings.
