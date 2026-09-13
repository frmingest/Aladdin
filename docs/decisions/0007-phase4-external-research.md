# 7. Phase 4 — external research (central-bank data, macro/sector research, scheduling)

## Status

Accepted

## Context

Phase 4 (§26) resolves the last open half of the §29 "research provider" question (Phase 2/ADR 0004
resolved the market-data half): §9.1's deterministic central-bank/macro numeric series, and §9.2/§9.3's
qualitative macro-news and sector-narrative research. §9.1 also calls for this to be "a periodic job,
not a per-click API call" — the first background-job requirement in the codebase (§4: "APScheduler
initially").

Faiz made two explicit choices before this phase was built:

- Numeric central-bank/macro data: **hybrid** — FRED as the primary source, Norges Bank for
  NOK-specific series FRED doesn't carry.
- Qualitative macro/sector research: **Gemini + Google Search grounding**, reusing the Google AI
  Studio key/infrastructure from Phase 3 (ADR 0005) rather than a second vendor account.

## Decisions

- **`MacroDataProvider` and `ResearchProvider` are two separate interfaces**, not one. The
  pre-existing `ResearchProvider.get_macro_snapshot()` stub's docstring conflated "numeric series" and
  "narrative research" into one call; splitting them follows §2.2 (deterministic calculation vs. LLM
  qualitative judgment must stay separate) — `MacroDataProvider` returns `MacroSeriesPoint`s an
  application can do arithmetic on and never touches an LLM; `ResearchProvider` returns
  source-attributed `ResearchItem`s that are inherently LLM-mediated narrative. A caller (or a future
  provider swap) is never tempted to blur the two.
- **`research/versions/{version}.yaml` is a new versioned-config family**, mirroring
  `scoring/versions/` (ADR 0006) and `prompts/persona/` — the registry mapping each canonical
  `series_key` to its owning vendor (FRED vs. Norges Bank) and that vendor's own series identifier is
  data, not an `if/elif` chain (§28 rule 8). `app.providers.composite_macro_provider` reads it to route
  calls; adding a third vendor later means a new child provider plus registry entries, not a change to
  any caller. `app.domain.macro_series` mirrors `app.domain.scoring`'s load pattern (an `lru_cache`d
  loader, frozen dataclasses, "never edit a shipped version in place" — §2.4).
- **Gemini's Google Search grounding is not combined with `response_schema`-constrained generation**,
  unlike `GoogleAIStudioProvider`'s analysis calls (ADR 0005). This session has no live network path to
  the Gemini API to verify whether grounding and structured output can be requested together on the
  configured model, and public documentation has at various points described them as mutually
  exclusive. Rather than build on an unverified assumption, `GeminiResearchProvider` asks for plain
  grounded text and derives `ResearchItem`s directly from `response.candidates[0].grounding_metadata`
  instead — a shape this session *did* verify by introspecting the installed `google-genai==2.23.0`
  SDK's own pydantic models (`GroundingMetadata.grounding_chunks`/`grounding_supports`,
  `GroundingSupport.segment`/`grounding_chunk_indices`, `Segment.text`, `GroundingChunkWeb.uri`/
  `domain`/`title`), the same "introspect the real SDK, don't trust a docs fetch" discipline ADR 0005
  used. One `ResearchItem` is built per (grounding_support, grounding_chunk) pair, with same-chunk
  segments merged into one item, so every item's summary is text the model actually grounded in that
  specific source (§9.4: research must be auditable per item, not just per run).
- **A response with no `grounding_metadata` at all is `ResearchUnavailableError`** (a real failure —
  the search tool never triggered, or the call was malformed); **a response *with* grounding metadata
  but zero supports is a legitimate empty result** (the model found nothing to ground its answer in)
  and returns `[]`. `app.services.research` relies on this distinction to decide whether a "no new
  items" run should still be recorded as `COMPLETED`.
- **Three new append-only tables** (`research_runs`, `research_items`, `macro_observations`), matching
  the Phase 2 `market_observations`/`fx_observations` precedent (§28: never overwrite historical data —
  a refresh inserts new rows; "latest" is a query). `research_runs` doubles as the refresh cache itself
  (§2.7): "is a refresh due" is one query against its `completed_at`, with no separate cache layer,
  mirroring the Phase 2 valuation service's per-run `_FxCache` at a smaller scale. `ResearchRunStatus`
  adds `PARTIAL` (some series/sources failed but at least one item/observation was persisted) alongside
  `COMPLETED`/`FAILED`, so one bad series never fails an entire macro refresh (§21) — only a refresh
  where *everything* failed is `FAILED`.
- **`AnalysisContext` (Phase 3, ADR 0006) gets macro/sector research wired in with no prompt-version
  bump.** `macro_snapshot`/`sector_research` were already typed as `MacroSnapshotView |
  UnavailableSection` / `SectorResearchView | UnavailableSection` in Phase 3, with `available=False`
  until this phase built real data; `app.services.analysis.context._add_research_evidence` adds the new
  data as citable `EvidenceItem`s with `source_type="macro_observation"` / `"research_item"`, reusing
  the exact generic evidence-citation mechanism `_add_metric_evidence` already used for Phase 2 facts
  (`source_type` is a plain `String(32)` column, not an enforced enum). The persona prompt already
  describes evidence as "a numbered list of items" generically, so the model can cite `E12` for a macro
  observation exactly like it cites `E3` for a document excerpt — no schema or prompt-version change
  needed.
- **`ResearchRun.methodology_version`** records the macro-series registry version (`MacroDataProvider`
  runs) or the research-prompt version (`settings.active_research_prompt_version`, both run types) —
  independent of `active_prompt_version` (the analysis persona), since these are separate versioning
  axes for separate artifacts (§2.4 reproducibility). A dedicated `active_research_prompt_version`
  setting was added rather than reusing `active_prompt_version` for this reason.
- **Sector research is routed by `sector` (a plain string matching `Holding.sector`, §20), not by
  holding.** §9.3 caches sector research "for a rolling period" shared by every holding in that sector,
  not per-instrument — one `Energy` refresh serves every energy holding. `ResearchItem.holding_id`
  stays nullable/present for a future per-holding refinement but isn't populated this phase.
- **APScheduler runs two interval jobs** (macro every `macro_refresh_interval_hours`, sector research
  every `sector_research_refresh_interval_days` per distinct sector currently on any holding), started
  from `app.main`'s lifespan and disabled via `settings.enable_scheduler=False` in tests. Both jobs call
  the same `refresh_*` functions the manual `POST /research/*/refresh` endpoints use, with `force=False`
  — the scheduler only decides how often to *try*; the service layer's own staleness check is what
  actually prevents a redundant provider call (e.g. after a restart shortly following a manual
  refresh). Manual refresh endpoints exist alongside the scheduler for the same reason Phase 2's
  valuation refresh is on-demand: a single-user dev-run app isn't always running when an interval
  elapses (§2.9).
- **Test isolation for the scheduler: a root-level `backend/conftest.py`, not `tests/__init__.py`
  alone.** The first attempt set `ENABLE_SCHEDULER=false` only in `tests/__init__.py`, reasoning that a
  package's `__init__.py` always runs before any module inside it. That didn't hold in practice:
  instrumenting `get_settings()` showed it gets called (via `tests/integration/conftest.py`'s
  `import app.models` → `app.models.analysis` → `app.config.database`, which reads settings at *module*
  import time) before `tests/__init__.py` had run, baking `enable_scheduler=True` into the
  `lru_cache`d `Settings()` for the rest of the process — the background scheduler then started for
  real during integration tests and its jobs hit `psycopg2.OperationalError` trying to reach a
  Postgres that test fixtures never configure. A root `conftest.py` doesn't have this ordering problem:
  pytest loads it before any conftest.py or package `__init__.py` nested under it, so it's the one place
  in this repo guaranteed to run before `app.config.settings` is ever imported. `tests/__init__.py`
  keeps the same line as a harmless second line of defense for any tool that imports the `tests`
  package directly without going through pytest.
- **Two real bugs were found and fixed while writing this phase's tests, not by manual inspection**:
  (1) `research/versions/v1.yaml`'s `no_policy_rate.region: NO` was silently parsed as the boolean
  `False` by PyYAML's `safe_load` — the classic YAML 1.1 "Norway problem" (an unquoted `NO`/`no`/`yes`/
  `on`/`off` resolves to a boolean). Fixed by quoting it (`region: "NO"`), with a comment explaining
  why, and a regression test (`test_macro_series_registry.py`) asserting the loaded region is the
  string `"NO"`. (2) `FredMacroDataProvider._resolve` / `NorgesBankMacroDataProvider._resolve` /
  `CompositeMacroDataProvider._route` all called `registry.get(series_key)` directly for an
  *unregistered* key — that raises `UnknownMacroSeriesKeyError` (a domain-layer exception), not
  `MacroDataUnavailableError` (the provider-contract exception every caller, including
  `app.services.research.macro`'s per-series `except MacroDataUnavailableError` loop, actually catches).
  An unregistered `series_key` would have crashed a macro refresh outright instead of being recorded as
  a per-series warning. Fixed by catching `UnknownMacroSeriesKeyError` at each of these three call
  sites and re-raising as `MacroDataUnavailableError` (§21/§8.3, §28 rule 8: a provider's own internal
  exception types must never leak past its boundary).

## Consequences

- **Norges Bank's exact dataset/key for the policy rate series is unverified.** This build environment
  has no live network path to `data.norges-bank.no` (same egress restriction ADR 0004/0005 hit for
  Yahoo Finance and Gemini). The `IR`/`B.KPRA.SD.` dataset/key in `research/versions/v1.yaml` is a
  best-effort reading of Norges Bank's published API guide, not a value confirmed against a real
  response — flagged explicitly in that YAML file and in `norges_bank_provider.py`'s module docstring.
  `NorgesBankMacroDataProvider`'s *mechanics* (HTTP call, SDMX-CSV parsing including the
  semicolon/comma delimiter fallback, error handling) are unit-tested against canned text shaped like
  Norges Bank's documented CSV format; the dataset/key strings are a one-line config fix if verification
  turns up a different value. Verify against `https://data.norges-bank.no/api/data/IR/` before relying
  on this series.
- **FRED's API shape was fully confirmed from its own published documentation** (endpoint, required
  params, `units=pc1` for YoY transforms, the `"."` missing-value sentinel) but, same as every other
  external vendor integration in this codebase, never against a live call from this sandbox. A manual
  smoke test with a real `FRED_API_KEY` is a recommended follow-up, same caveat as ADR 0004's yfinance
  provider and ADR 0005's Gemini provider.
- **A real `FRED_API_KEY` is required before macro refresh will do anything** — get one free at
  https://fred.stlouisfed.org/docs/api/api_key.html. Until it's set, `FredMacroDataProvider`'s
  constructor raises `MacroDataUnavailableError` immediately (mirroring `GoogleAIStudioProvider`'s
  `GOOGLE_AI_STUDIO_API_KEY` check from ADR 0005), which surfaces as every FRED-backed series failing
  and the macro run recording a `PARTIAL` (Norges Bank's series still succeeds) or `FAILED` status —
  never a silent 500 or fabricated data.
- **Gemini's grounding response shape was verified only against the installed SDK's pydantic model
  definitions**, not a live call — same limitation ADR 0005 already accepted for the analysis provider,
  now extended to the research provider built on the same SDK.
- **`recent_events` on `AnalysisContext` remains unbuilt.** The macro/sector narrative items partially
  cover that need (a Fed decision or a sector headline can surface through either stream), but a
  dedicated event-detection feature (e.g. flagging holding-specific news, not just macro/sector-level)
  is a deliberate, documented follow-up, not an oversight.
- **No dedicated frontend page was built this phase** — `GET /research/macro/snapshot` and
  `GET /research/sectors/{sector}/items` exist and are usable via the API/docs, but nothing in
  `frontend/` renders them yet. Matches Phase 2's precedent (market data landed with API endpoints
  before Phase 3 added a frontend page for analysis).
- **`apscheduler` joins `yfinance`/`pandas`/`openpyxl`/`fitz` as a dependency with no type stubs** —
  `mypy` skips analyzing it (`import-untyped`), consistent with how those existing dependencies are
  already handled; no project-wide mypy config exists yet to formalize this (ADR 0004's Consequences).
- **`black` was not run against this phase's new files** — the codebase has never been run through
  `black`'s default line length (ADR 0004's Consequences), and Phase 4's files follow the same
  ~110-120-character-line convention as every existing file rather than introducing a second style.
