# Fix: fund/ETF blind pass truncated by the local LLM's output limit (2026-09-27)

Faiz reported the local Ollama analysis failing on his Xtrackers Europe Defence Technologies UCITS
ETF holding (`XDEF.DE`):

> blind pass failed: Ollama stopped at the output limit (8192 tokens) before finishing the JSON
> (model=qwen3:14b) — raise LLM_MAX_OUTPUT_TOKENS or OLLAMA_NUM_CTX.

## 1. Root cause

Not a crash — the app is deliberately refusing a truncated model response rather than accepting
half a JSON object (CLAUDE.md Rule 2, evidence-first). See `app/providers/ollama_provider.py`'s
`done_reason == "length"` check.

Why XDEF specifically, and not the equity holdings: it's a fund/ETF, so it answers the `fund_v1`
schema (`FundBlindPassOutputV1`, `app/domain/analysis_schema/fund_v1.py`) instead of equity's `v1`.
`fund_v1` has **7 sections** (moat, steward_and_costs, portfolio_construction, macro_stress_test,
valuation_synthesis, role_in_portfolio, verdict) against `v1`'s **6** — one extra full narrative
section (`role_in_portfolio`), each with its own summary + evidence citations. That extra section
was enough to push qwen3:14b's JSON past the shared `LLM_MAX_OUTPUT_TOKENS` cap (default `8192`),
which was a single setting used identically for every schema and every provider
(`app/providers/factory.py`) — nothing scaled the budget to the shape of what was being asked for.

## 2. Fix — schema-aware output budget, not a manual `.env` tweak

Rather than just raising the shared default (which would still be a guess, and wastes context
budget on every equity pass too), the cap is now schema-aware:

- New setting `Settings.llm_max_output_tokens_fund` (default `16384`), separate from
  `llm_max_output_tokens` (still `8192`, unchanged for equity).
- `LLMProvider.generate_structured()` (`app/providers/base.py`) gained an optional
  `max_output_tokens: int | None = None` override parameter — implemented in all three providers
  (`OllamaProvider`, `GoogleAIStudioProvider`, `MistralProvider`), so the fix isn't Ollama-only.
  `None` (the default) keeps that provider's own configured value; a caller that knows better can
  ask for more (or less) for one call.
- `app/services/analysis/blind_pass.py`'s `run_blind_pass()` now calls
  `is_fund_schema(schema_version)` (already existed in `app/domain/analysis_schema/__init__.py`)
  and passes `llm_max_output_tokens_fund` when true, `None` (provider default) otherwise. This is
  the one place that decides the budget — every provider and every call site downstream just obeys
  it.
- The reconciliation pass is unaffected: `ReconciliationOutputV1` is the same small shape for both
  equity and funds, so it never needed the bigger budget (its *prompt* is bigger for a fund, since
  it embeds the blind pass's JSON, but that's a context-window question, see below — not an
  output one).
- `OLLAMA_NUM_CTX` default raised `16384` → `24576`: it's Ollama's *combined* prompt + generation
  budget, and 16384 left too little room for a real evidence-packet prompt alongside a full-length
  fund output. Still comfortable on a 12GB card with `OLLAMA_KV_CACHE_TYPE=q8_0` (already the
  troubleshooting table's own suggested fix for a context-overflow error). Applied both to the
  code default and to Faiz's real `.env` on `E:\Aladdin`, which had explicitly pinned the old value.
- The "stopped at the output limit" error message now reports the budget actually used
  (`{output_tokens}/{output_budget} tokens`) and names `LLM_MAX_OUTPUT_TOKENS_FUND` alongside
  `LLM_MAX_OUTPUT_TOKENS`.

## 3. What changed, file by file

| File | Change |
|---|---|
| `app/config/settings.py` | New `llm_max_output_tokens_fund: int = 16384`; `ollama_num_ctx` default `16384` → `24576` |
| `app/providers/base.py` | `generate_structured()` gains optional `max_output_tokens` override |
| `app/providers/ollama_provider.py` | Honors the override (`num_predict`); output-limit error message reports budget used and both env var names |
| `app/providers/google_ai_studio_provider.py`, `app/providers/mistral_provider.py` | Honor the override the same way |
| `app/services/analysis/blind_pass.py` | Picks `llm_max_output_tokens_fund` for a fund schema via `is_fund_schema()`, otherwise leaves the provider default |
| `backend/.env.example`, `backend/.env`, `docs/local-llm-ollama-setup.md`, [setup guide](local-llm-ollama-setup.md) | Document/apply the new setting and the `OLLAMA_NUM_CTX` bump |
| Tests | `test_ollama_provider.py` (override sets `num_predict`, no-override keeps the default, error message reports the budget used); `test_analysis_pipeline.py` (equity blind pass asks for no override); `test_funds_api.py` (fund blind pass asks for exactly `llm_max_output_tokens_fund`); fake `LLMProvider`s across `test_analysis_pipeline.py`/`test_analysis_api.py`/`test_funds_api.py` updated to accept the new keyword |

## 4. Verification

Full backend suite: **932 passed**, same 2 pre-existing, unrelated, environment-only failures
(`test_factory.py`'s LLM-provider-default tests — already documented as failing whenever the local
`.env` selects `ollama`, e.g. `fund-etf-analysis-sprint8-2026-09-24.md`). 6 tests net new. Ran from
a fresh venv built against `requirements.txt` (this session's shell can't reach the Windows `.venv`
directly, same limitation as other recent sessions).

Not yet run against the real local Ollama server/GPU — that needs Faiz's PC. No migration, no
schema-version bump (CLAUDE.md Rule 3 doesn't apply here: nothing about `fund_v1`'s *shape* changed,
only how much output room the model is given to fill it).

## 5. What Faiz needs to do

1. Restart the local backend/worker (`.env` is only read at process start) so `OLLAMA_NUM_CTX=24576`
   and the new `LLM_MAX_OUTPUT_TOKENS_FUND` default take effect.
2. Re-run the analysis on XDEF.DE (or any fund/ETF holding).
3. If it still hits the output limit, the error message now says exactly how close it got
   (`N/16384 tokens`) — raise `LLM_MAX_OUTPUT_TOKENS_FUND` in `.env` further from there.
