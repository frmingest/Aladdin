# LLM prompt log (System status) — 2026-10-13

**Status: written, not yet deployed.** Branch `feature/llm-prompt-log`.

## What it does

System status has a new **Prompt log** card. Every call the app makes to an LLM leaves one row holding the exact system prompt, the exact user prompt (the evidence packet the model was given), the model's raw reply, the outcome, token counts and latency. Click a row to read it in full; each block has a Copy button. Filters: provider, outcome, free-text search in the prompt.

## What is logged

| Path | Provider | Rows |
|---|---|---|
| Structured analysis passes (blind pass, reconciliation) | Gemini (`GoogleAIStudioProvider`) | one per logical call; Gemini's 429/503 retry ladder is **one** row, the real attempts stay in the usage ledger |
| Structured analysis passes | Ollama / Mistral (`LedgerRecordingMixin`) | one per call, success or failure |
| Grounded research (macro, sector, company) | Gemini (`GeminiResearchProvider`) | one per call; reply text is the model's prose, the parsed items are not duplicated |

A call refused before sending (daily budget spent) is logged as a failed row with the reason.

## Rules it keeps

- **Fails soft.** A database problem never fails or slows an LLM call (same as the usage ledger).
- **Blind pass.** The log only records what was sent, so it is the way to verify that no user notes reach the blind pass (Rule 4). Nothing about the blind pass changed.
- **Private.** Rows contain real evidence built from brokerage data and documents. The list and detail endpoints return nothing in demo mode.
- **Retention.** `LLM_PROMPT_LOG_RETENTION_DAYS` (default 30; 0 keeps forever). Old rows are purged opportunistically, at most once an hour per process. `LLM_PROMPT_LOG_ENABLED=false` switches logging off; existing rows stay readable.

## Code

- Table `llm_prompt_logs`: model `app/models/llm_prompt_log.py`, migration `u1a2b3c4d5e6` (additive; no legacy table touched).
- Service `app/services/llm_prompt_log.py`; endpoints `GET /system/prompt-log` and `GET /system/prompt-log/{id}` in `app/api/system.py`.
- Hooks: `providers/ledger_recording.py`, `providers/google_ai_studio_provider.py`, `providers/gemini_research_provider.py`; the factory injects the session factory.
- UI: `frontend/src/components/PromptLogCard.tsx` on `SystemStatusPage`.
- Tests: `backend/tests/unit/test_llm_prompt_log.py`, `frontend/src/components/PromptLogCard.test.tsx`.

## Not done

- No foreign key to `llm_usage_events` (the two tables are matched by time and provider); the ledger stays untouched.
- Only calls made after the deploy appear; nothing is back-filled.
- The Tavily research provider and other non-LLM providers are not logged.
