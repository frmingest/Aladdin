# 17. Local LLM migration — Ollama replacing Google AI Studio / Mistral as the analysis provider

## Status

Accepted, with the two structural questions below now decided (2026-09-17). What's still open is
purely empirical: the validation plan (quality bake-off) hasn't been run yet, so `OllamaProvider`
stays built-and-inert (`LLM_PROVIDER` default unchanged) until that concludes "good enough." The
retirement checklist at the bottom executes only after that.

- **Deployment topology — decided: (a), run analysis locally.** Faiz deferred to Claude's
  recommendation. Recommendation: run the backend locally (against the same Supabase DB) for
  analysis sessions, keep Railway for everything else (dashboard, portfolio browsing, valuation).
  Rationale: zero new infrastructure or security surface for a pipeline that handles real financial
  documents, no new "is my PC on and reachable" failure mode for the always-on deployed app, and
  consistent with this project's own stated bias against premature infrastructure
  (`docs/architecture.md` §2.9). The real trade-off accepted: analysis can no longer be triggered
  from the deployed app away from Faiz's desktop (e.g. from a phone) — acceptable for a deliberate,
  occasional action like "analyze my portfolio," not something that needs to work from anywhere.
  Revisit toward option (b) (Tailscale-bridged Railway) later only if that trade-off turns out to
  actually bite in practice.
- **Research-provider scope — decided: keep minimal Gemini usage for research only** (option 1 under
  "What this ADR does not yet solve," confirmed by Faiz). Google AI Studio does not fully leave the
  codebase in this pass — `gemini_research_provider.py`/`gemini_retry.py` and their settings stay,
  scoped down to research-only. A full local/alternative replacement for Gemini's Search-grounded
  research is explicitly deferred to its own future ADR, not part of this migration.

## Context

Both of ADR 0005's free-tier LLM choices have now failed operationally for this workload:

- **Google AI Studio (`gemini-3.6-flash`)**: 20 requests/day, 5/minute (ADR 0005, ADR 0013). The
  2026-09-15 retry/pacing fix and 2026-09-16 daily-budget guard made hitting this ceiling graceful,
  but never raised it — a batch of more than ~10-20 holdings (each 1-2 calls) always runs out.
- **Mistral (fallback, added 2026-09-17)**: intended to absorb the overflow once Gemini's budget was
  spent. Diagnosed 2026-09-17 (`claude/mistral-fallback-still-429-2026-09-17.md`): Mistral's own
  Free-tier account limits (RPS, TPM, and a **tokens/month** ceiling — all org-level, and per
  Mistral's own docs, "adding credits does not raise your rate limits, only actual billed spend
  does") mean the fallback itself now 429s on every call, non-transiently. Every analysis run since
  has failed end-to-end: both providers exhausted, no path to a successful holding.

Faiz asked to stop patching around cloud free-tier ceilings and instead move the analysis LLM to a
model running on his own hardware (RTX 3060, 12GB VRAM) — no vendor account, no rate limit, no
recurring cost — and to retire Google AI Studio and Mistral from the codebase once that's validated.

### Model research (2026-09-17)

Requirement, unchanged from ADR 0005/0006: real schema-constrained structured output (`LLMProvider.
generate_structured`, `app/providers/base.py`) — every analysis pass calls `response_schema.
model_validate_json()` directly on the raw response; a malformed response raises, it doesn't degrade
gracefully. Ollama's `format=<json schema>` (grammar-constrained decoding, confirmed against Ollama's
own docs, ollama.com/blog/structured-outputs) gives the same category of guarantee Gemini's
`response_schema` and Mistral's `response_format` gave — this is a hard requirement any candidate
model must clear via the *serving layer* (Ollama), independent of which model is loaded.

Candidates evaluated for a 12GB VRAM ceiling (confirmed against Ollama's own library, not secondary
"best local LLM" roundups, several of which gave inconsistent or unverifiable claims for 2026-era
model names):

| Model | Disk size (default quant) | Context | Notes |
|---|---|---|---|
| **Qwen3 14B** | 9.3GB | 40K (native) | Purpose-built reasoning/tool-use generation; Apache 2.0. ~2.7GB headroom left in 12GB for KV cache + OS/other GPU use. Direct successor to Qwen2.5 14B, which a prior session (`claude/llm-provider-alternatives-2026-09-17.md`) already identified as the best all-around reasoning/extraction pick at this size. |
| Qwen3 8B | 5.2GB | 40K | Faster, more VRAM headroom, shallower reasoning — fallback if 14B proves too slow in practice. |
| Gemma3 12B | ~7GB (QAT Q4) | 128K | Multimodal (unused here), 128K context is well beyond what this app needs (largest real prompt is roughly persona/synthesis text + a 12K-character evidence excerpt, `llm_excerpt_char_budget` — a few thousand tokens). Worth a bake-off entry; no explicit tool-calling design the way Qwen3 has. |
| GPT-OSS 20B | MoE, MXFP4, stated 16GB minimum | not confirmed | OpenAI's own open-weight model, native structured-output/tool-calling design (strong fit on paper) — but 12GB is below its stated comfortable minimum; likely partial CPU offload and reduced context on this card. Worth an experimental bake-off entry, not a safe default. |

**Recommendation: Qwen3 14B** (`ollama pull qwen3:14b`) as the default to validate first — best
reasoning-per-VRAM fit confirmed for this card, comfortable headroom, permissive license, and the
same model family a prior session already favored at the previous generation. This is a
**starting point for the validation plan below, not a final decision** — quality on Aladdin's actual
financial filings is what decides it, not benchmark tables (financial-document reasoning isn't
represented in any of the general benchmarks these models are marketed against).

## Decisions

- **New `OllamaProvider`** (`app/providers/ollama_provider.py`) implementing the existing
  `LLMProvider` interface — no service-layer change (`app/services/analysis` is unaware which
  provider it's calling, exactly as ADR 0005 designed). Uses the `ollama` Python client's `chat(...,
  format=<pydantic model_json_schema()>)` for structured output, matching `LLMResponse`'s existing
  shape (raw JSON string in `.content`; schema validation stays in `app.services.analysis.
  llm_analysis`, never in the provider — §28 rule 8).
- **New `app/providers/ollama_retry.py`** — deliberately *not* a copy of `gemini_retry.py`/
  `mistral_retry.py`'s pacing design. Those exist to stay under a vendor's requests-per-minute quota;
  a local server has no such quota, only a GPU that serves one request at a time, and
  `run_analysis` already calls holdings strictly sequentially. What a local server does fail on
  transiently is a cold model load or a momentary link drop to wherever it's running — a short
  retry-with-backoff (no RPM pacing) covers that.
- **New settings** (`app/config/settings.py`): `ollama_base_url` (default
  `http://localhost:11434`), `ollama_model_name` (default `qwen3:14b`), `ollama_context_window`
  (default `8192` — KV-cache size, not model size; sized to this app's actual prompts, not the
  model's native max), `ollama_keep_alive_minutes` (default `30`, keeps the model resident in VRAM
  between holdings in the same run rather than reloading it from disk each time).
- **`llm_provider` gains a third value**: `"ollama"`, alongside the existing `"google_ai_studio"` and
  `"stub"`. **Default unchanged** (`"google_ai_studio"`) — this is additive and inert until Faiz
  flips it, same pattern as every other provider option in this file.
- **Verified**: 9 new unit tests (`tests/unit/test_ollama_provider.py`) against the real installed
  `ollama==0.6.2` client's actual response/error classes (`ollama.ChatResponse`, `ollama.Message`,
  `ollama.RequestError`, `ollama.ResponseError` — introspected directly, not guessed) — successful
  call, schema/options passed through correctly, connection-error retry-then-succeed, retryable
  server-error retry, retries-exhausted, a permanent error (404 model not pulled) failing on the
  first attempt with no retry, empty-content handling, missing-config errors. Full backend suite:
  **425 passed, the same 3 pre-existing unrelated failures** every session hits (missing
  `prompts/synthesis/v3.md`), **0 regressions**. `ruff check` and `mypy` both clean on every new/
  changed file.

## What this ADR does NOT yet solve

**The research provider is a separate dependency on Gemini that this migration does not touch.**
`research_provider="gemini_search"` (`app/providers/gemini_research_provider.py`) doesn't just call
an LLM — it uses Gemini's built-in Google Search grounding tool to produce macro/sector *narrative*
research with real, current web sources (`app/services/research/macro.py`/`sector.py`). A local
Ollama model has no equivalent: it can reason over text handed to it, but it cannot search the live
web on its own. Retiring Gemini/Mistral **only from the analysis path** (this ADR's actual scope)
leaves this dependency in place; retiring it **everywhere**, as Faiz asked, additionally needs one of:

1. **Keep a minimal Gemini usage for research only.** Research volume is tiny compared to what was
   actually breaking analysis runs — one macro call/day plus one call per distinct sector/week
   (`macro_refresh_interval_hours`, `sector_research_refresh_interval_days`), a small fraction of the
   20/day cap that per-holding analysis calls were actually exhausting. This is the pragmatic,
   low-effort option: it doesn't fully retire Google AI Studio, but it removes the part that was
   actually failing (analysis) while keeping the part that was never really the problem (research).
2. **Build a new research provider** on a real web-search API (e.g., Tavily, Brave Search, SerpAPI —
   most have a free tier) plus a local model to synthesize the results, or a self-hosted search
   layer (SearxNG). This is new scope, not a swap — a new `ResearchProvider` implementation, a new
   ADR of its own, and its own free-tier-limits research, not something to fold into this migration.

**Decided: option 1** (2026-09-17, confirmed by Faiz) — full analysis-path migration to Ollama now;
the research-provider question is deferred to its own follow-up ADR once/if Faiz wants to pursue a
local or alternative replacement for Gemini's Search grounding. Google AI Studio does not fully
leave the codebase in this pass — see the Status section and the refined retirement checklist below.

## Consequences

**Positive:**
- No more rate limits, daily budgets, or fallback-cascade logic for analysis — `run_analysis`'s
  pre-flight daily-budget guard, `calls_remaining_today` bookkeeping, and the live-failure fallback
  branch (all added 2026-09-16/17 specifically to cope with Gemini's/Mistral's ceilings) become dead
  code once Ollama is the only analysis provider, and can be deleted — a real simplification back
  toward `runner.py`'s original Phase 3 shape.
- No recurring cost, no API key to rotate or leak, no vendor deprecating a model out from under the
  app (ADR 0005's Gemini-2.5-flash retirement already happened once).
- Full control over model choice/quality going forward — swapping in a better model as local
  releases improve is a config change (`OLLAMA_MODEL_NAME`) plus `ollama pull`, not a new provider.

**Negative / accepted trade-offs:**
- **Deployment topology (decided — see Status): the deployed Railway app can no longer run an
  analysis by itself.** Analysis happens by running the backend locally against the same database;
  Railway continues serving the dashboard/portfolio/valuation views, which don't need the LLM. If
  this trade-off proves more annoying in practice than expected (e.g. Faiz wants to kick off an
  analysis from his phone), option (b) — bridging Railway to the home GPU via Tailscale — is the
  documented fallback, but starts from "real new infrastructure and a new failure mode," not a quick
  toggle.
- **Quality is unverified against Aladdin's real filings.** Every model above is chosen from general
  benchmarks and VRAM-fit, not from running it against a real Vår Energi-style analysis. See the
  validation plan — this is the one remaining gate before anything in production changes.
- **Speed**: a 9GB Q4 model on a consumer GPU is slower than a cloud API call, especially on a cold
  load. `ollama_keep_alive_minutes` mitigates repeated-call latency within one run, not the first
  call of a session. Expect a multi-holding batch to take noticeably longer than it did against
  Gemini even when Gemini wasn't rate-limited.
- **Google AI Studio doesn't fully leave the codebase (decided — see Status).** `gemini_research_
  provider.py`/`gemini_retry.py` and the settings/requirements they need stay, scoped to research
  only. A reader of `requirements.txt`/`factory.py` after the retirement pass will still see
  `google-genai` and a Gemini client — that's intentional, not leftover cleanup that got missed.

## Validation plan (before flipping `LLM_PROVIDER=ollama` in production)

1. **Pull the candidate(s)** on the machine that will run Ollama: `ollama pull qwen3:14b` (primary),
   optionally `ollama pull qwen3:8b` and `ollama pull gemma3:12b` for comparison.
2. **Point a local `.env` at it**: `LLM_PROVIDER=ollama`, `OLLAMA_BASE_URL=http://localhost:11434`
   (or wherever it's running), `OLLAMA_MODEL_NAME=qwen3:14b`. Everything else (prompts, schemas,
   scoring) is untouched — this only swaps which provider answers `generate_structured`.
3. **Re-run 2-3 holdings Aladdin has already analyzed with Gemini** (Vår Energi is the obvious
   candidate — it's the baseline every prior session's numbers are pinned to) and compare, side by
   side, not just "did it return valid JSON":
   - Does the structured output actually validate against the schema on the first try (not just
     eventually, after prompt-engineering workarounds)?
   - Do the factor scores/confidences look directionally reasonable against Faiz's own read of the
     same filing?
   - Does the reasoning text cite real `evidence_id`s appropriately (not hallucinated citations) —
     this is a hard non-negotiable per `CLAUDE.md`'s guardrail rules, not just a quality nice-to-have.
   - Wall-clock latency per holding (cold vs. warm/kept-alive).
4. **Repeat for the second candidate model(s)** if the first doesn't clearly clear the bar, using the
   same holdings for a fair comparison.
5. **Decide**: good enough → proceed to the retirement checklist below (after also deciding the
   topology question and the research-provider question). Not good enough → this ADR's
   recommendation doesn't hold, and either a bigger local model (24GB+ card, out of scope for now)
   or staying on a cloud vendor at a paid tier becomes the real alternative — worth a short follow-up
   note either way so this doesn't get silently re-litigated later.

## Retirement checklist (execute only after the validation plan above concludes "good enough")

Everything below is **not yet done** — this is the plan, listed so a future session (or Faiz
directly) can execute it as one clean, reviewable change rather than piecemeal:

Scoped per the 2026-09-17 decisions: **research keeps a Gemini dependency, analysis does not.**

- [ ] Flip `llm_provider` default to `"ollama"` in `settings.py`. Keep `"google_ai_studio"` loadable
      as a value (don't delete the branch in `factory.get_llm_provider()`) purely for reproducibility
      of historical `AnalysisRun.provider` values already recorded — see ADR 0005/§2.4's precedent
      for versioned-but-retired options — but it's no longer the default and no longer documented as
      the primary path.
- [ ] Delete the **analysis-only** files: `app/providers/mistral_provider.py`,
      `app/providers/mistral_retry.py`, `backend/tests/unit/test_mistral_provider.py`. Delete
      `app/providers/google_ai_studio_provider.py` and `backend/tests/unit/
      test_google_ai_studio_provider.py` too — the analysis path no longer calls it. **Do not**
      delete `app/providers/gemini_retry.py` or `app/providers/gemini_research_provider.py` —
      research still needs both (`gemini_retry.py` is shared plumbing, not analysis-specific, per its
      own docstring).
- [ ] Remove `llm_fallback_provider` and all `mistral_*` settings; remove
      `get_llm_fallback_provider()` from `factory.py`. **Keep** `google_ai_studio_api_key`,
      `llm_model_name`, `llm_max_output_tokens`, `llm_temperature`, and `llm_rate_limit_rpm` —
      `GeminiResearchProvider` still reads all of these. **Remove** `llm_rate_limit_tpm`,
      `llm_rate_limit_rpd`, `llm_baseline_input_tokens`, `llm_baseline_output_tokens` — these existed
      specifically for the analysis daily-budget guard/usage-estimate, which goes away entirely with
      Ollama as the unrestricted analysis provider; research volume was never close to needing a
      daily-cap estimate.
- [ ] Simplify `app/services/analysis/runner.py`: remove `calls_remaining_today` bookkeeping,
      `_daily_budget_exhausted_reason`, and the live-failure-fallback branch — all dead weight once
      there's only one, unrestricted analysis provider. This is a substantial, welcome shrink of a
      file that grew specifically to cope with two vendors' rate limits. `run_analysis` no longer
      needs a `fallback_provider` parameter at all.
  - Update or retire the daily-budget-guard/live-retry-fallback unit tests in
      `tests/unit/test_analysis_runner_daily_budget.py` to match.
- [ ] `requirements.txt`: remove `mistralai`; **keep** `google-genai` (research) and `ollama`
      (analysis).
- [ ] `.env.example`: remove the `LLM_FALLBACK_PROVIDER`/`MISTRAL_*` block entirely. Keep
      `GOOGLE_AI_STUDIO_API_KEY`/`LLM_MODEL_NAME`/`RESEARCH_PROVIDER` etc., but re-comment them as
      "used by the research provider only" rather than the primary AI provider block; move
      `LLM_PROVIDER=ollama` and the `OLLAMA_*` block to where the primary-provider comment used to be.
- [ ] Dashboard "usage today" widget (`app/services/usage.py`, ADR 0013): the free-tier
      requests-remaining framing becomes misleading for analysis (no daily cap once local) but stays
      meaningful for research's continued Gemini usage — repurpose the widget to describe research
      usage specifically (or split into a small research-usage indicator) rather than deleting it.
      Not urgent, not blocking.
- [ ] Mark ADR 0005 (Google AI Studio) and this migration's own predecessor docs
      (`claude/mistral-fallback-provider-2026-09-17.md`,
      `claude/gemini-fallback-live-retry-2026-09-17.md`,
      `claude/gemini-daily-budget-guard-2026-09-16.md`,
      `claude/gemini-retry-and-rpm-pacing-2026-09-15.md`,
      `claude/mistral-fallback-still-429-2026-09-17.md`) as **superseded** (keep them — they're real
      history of what was tried and why it didn't hold up — just note the supersession at the top of
      each rather than deleting).
- [ ] Full `pytest`/`ruff`/`mypy` (backend) + `tsc`/`lint`/`build` (frontend, if the usage widget
      changes) clean before calling this done, per `CLAUDE.md`.
