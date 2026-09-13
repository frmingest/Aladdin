# 5. Phase 3 — Google AI Studio as the LLM provider

## Status

Accepted

## Context

The architecture's tech stack table (§4) recommended the Anthropic Claude
API for AI, and Phase 0/2's `AnthropicLLMProvider`/`anthropic_api_key`
settings scaffolding assumed it. Ahead of building Phase 3 (§26), Faiz asked
to build against Google AI Studio's free tier instead, providing an API key
when needed. Like the market-data provider decision (ADR 0004), this is
exactly the kind of implementation-level choice §29 calls out as not a
reason to block on the architecture: `LLMProvider` (app.providers.base) is
already the seam that isolates this choice from the rest of the
application, the same way `MarketDataProvider` isolated the yfinance choice.

## Decisions

- **`GoogleAIStudioProvider` (app/providers/google_ai_studio_provider.py)
  replaces the unimplemented `AnthropicLLMProvider` stub.** Uses the
  `google-genai` SDK's `client.models.generate_content(...,
  config=types.GenerateContentConfig(response_mime_type="application/json",
  response_schema=<pydantic model>))` — the SDK converts a pydantic model
  class into the vendor's schema format itself, so the app never hand-writes
  a Gemini-specific schema.
- **`LLMProvider.analyze(prompt, prompt_version)` was replaced with
  `generate_structured(system_prompt, user_content, response_schema,
  prompt_version)`.** The original single-string-prompt shape didn't have a
  place for a JSON-schema-constrained response, which every Phase 3 call
  needs (§12: "a stable output schema"). `response_schema` is typed as
  `type[BaseModel]` rather than a raw JSON-schema dict specifically so this
  interface stays reusable if Anthropic (which also supports schema-
  constrained tool-use output) is ever added back as a second provider —
  the provider implementation converts the pydantic model however its own
  SDK expects, the interface doesn't assume Gemini's dialect.
- **Default model: `gemini-2.5-flash`.** Chosen over a newer Gemini 3.x
  flash variant (which appeared to exist as of this decision, per Google's
  own docs, but whose exact model-ID string could not be independently
  confirmed from this build environment) because it is a model ID this
  session could positively confirm works with the `google-genai` SDK's
  documented structured-output example. `settings.llm_model_name` is a
  plain config value (§4: "exact model IDs live in configuration") —
  revisit this default as free-tier model availability changes; it is not
  meant to be the permanently-correct choice.
- **Settings renamed**: `llm_provider` default changed from `"anthropic"`
  to `"google_ai_studio"`; `anthropic_api_key`/`anthropic_model` replaced
  with `google_ai_studio_api_key`/`llm_model_name`, plus new
  `llm_max_output_tokens`, `llm_temperature`, and `llm_excerpt_char_budget`
  (the last one is unrelated to the provider choice — see ADR 0006).
- **`requirements.txt`**: `anthropic==0.34.2` (never actually used — the
  Phase 0/2 stub never called it) replaced with `google-genai==2.23.0`,
  plus `pyyaml==6.0.2` for scoring config (ADR 0006) unrelated to this
  provider swap but landing in the same dependency-file change.
- **Dependency-version bumps forced by `google-genai`**: it requires
  `pydantic>=2.12.5` (bumped from the pinned `2.9.2`) and
  `httpx>=0.28.1,<1.0.0` (bumped from the pinned `0.27.2`, used by
  `TestClient`). `pydantic-settings` was bumped alongside pydantic to
  `2.12.0` for compatibility. All 89 pre-existing tests were re-run and
  pass unchanged after these bumps — nothing in the Phase 0-2 codebase
  depended on pydantic/httpx behavior specific to the older pins.

## Consequences

- This session's sandbox has no network path to the Gemini API (same
  egress restriction ADR 0004 hit for Yahoo Finance), so
  `GoogleAIStudioProvider` is verified only against the `google-genai`
  SDK's documented request/response shapes (confirmed by introspecting the
  installed SDK — `client.models.generate_content` signature,
  `GenerateContentConfig.response_schema` accepting a pydantic model class,
  `GenerateContentResponse.text`/`.usage_metadata` fields all checked
  directly against the installed 2.23.0 package) — not against a live call.
  A manual smoke test with a real API key is a recommended follow-up, same
  caveat as ADR 0004's yfinance provider.
- The provider's exception handling catches `Exception` broadly rather than
  the SDK's specific `ClientError`/`ServerError` types (confirmed to exist
  in `google.genai.errors`), because this session could not verify their
  exact attributes/behavior against a live failure. This is a deliberately
  conservative choice — it still converts every failure into
  `LLMUnavailableError` (§28 rule 8), it just doesn't yet distinguish
  4xx-vs-5xx-vs-network-error cases in the error message. Narrowing this is
  a safe follow-up once real API responses have been observed.
- Free-tier rate limits are not modeled anywhere in the application (no
  backoff/retry). At single-user, on-demand analysis-run volume this
  wasn't judged worth the complexity yet — a `LLMUnavailableError` simply
  surfaces as a per-holding analysis failure (§21), which is the same
  fail-visibly behavior any other transient provider issue gets.
