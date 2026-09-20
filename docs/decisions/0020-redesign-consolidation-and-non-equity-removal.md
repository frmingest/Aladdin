# 20. Redesign consolidation: continue incrementally, remove non-equity entirely, preserve equity data

## Status

Accepted. Recorded 2026-09-20, same day as and directly following ADR 0019, in a later session.

## Context

Faiz re-opened the Buffett/Munger redesign request in stronger terms -- "delete everything and start
from scratch... reuse the configuration we have today for github, railway, supabase" -- and asked for
"a complete redesign sprint plan," supplying the full "Brain" prompt text again. ADR 0019 (this same
day, earlier session) had already scoped this exact transformation and Sprint 0 (stabilization) plus
the first slice of Sprint 1 (deterministic financial primitives) were already built, tested, and
committed to `main` (`41cedc6`).

"Delete everything and start from scratch" directly conflicts with ADR 0019's incremental approach
and with CLAUDE.md's git-discipline and destructive-operations rules, so three follow-up scope
questions were put to Faiz before writing any new plan, rather than guessed at:

1. Literal fresh repo (discard Sprint 0-1's committed, tested work and rebuild the evidence-first
   pipeline / deterministic calc engine / prompt-injection guardrails from zero), a big-bang rewrite
   of just the analysis core, or continue and consolidate the existing incremental plan?
2. ADR 0019 explicitly left "what does descope mean operationally for non-equity holdings" open
   (hide from dashboard? stop pricing? remove entirely?) -- which one?
3. Does the rebuild touch the real Supabase data (real brokerage holdings, real analysis history)?

Faiz answered: **continue and consolidate** the existing plan; **remove non-equity holdings
entirely** (code and data); **keep all existing equity data** -- only non-equity data is affected by
decision 2.

## Decisions

- **No literal rebuild.** ADR 0019's architecture, Sprint 0/1's committed work, and the existing
  sprint sequence (Sprints 2-7) stand. "Complete redesign" is delivered as the already-scoped
  incremental rework -- reusing the tested evidence-first pipeline, deterministic calculation engine,
  and prompt-injection guardrails rather than discarding them -- not as a from-zero rebuild. This ADR
  exists specifically so a future session doesn't read "delete everything and start from scratch" in
  the conversation history and act on it literally.
- **Non-equity holdings (whisky, precious metals, coins/collectibles) are removed entirely** -- code
  paths and data -- not hidden or frozen. This closes ADR 0019's open checkpoint and unblocks
  Sprint 5. Concrete removal scope identified this session (backend, via `AssetClass.COMMODITY` /
  `AssetClass.COLLECTIBLE`, ADR 0011):
  - `backend/app/providers/gold_metal_provider.py` (whole file)
  - `backend/app/domain/asset_class.py` -- drop `COMMODITY`/`COLLECTIBLE` members once nothing
    references them
  - `backend/app/services/portfolio/parser.py` -- Whiskybase CSV parsing path
  - `backend/app/services/portfolio/manual_entry.py`, `.../reset.py` -- non-equity manual-entry and
    reset handling
  - `backend/app/services/market_data/valuation.py`, `.../valuation/dcf.py` -- collectible-at-cost /
    commodity valuation branches
  - `backend/app/services/portfolio_risk/builder.py`, `.../executive_summary/builder.py` -- liquidity
    and composition handling for these asset classes
  - `backend/app/providers/composite_market_provider.py`, `.../factory.py` -- provider wiring
  - `backend/app/api/portfolio.py`, `backend/app/schemas/{portfolio,valuation,executive_summary}.py`,
    `backend/app/models/portfolio.py`, `backend/app/config/settings.py`
  - Frontend: `CollectionFilter.tsx`, `Dashboard.tsx`, `PortfolioUpload.tsx`,
    `dashboard/{CompositionSection,HoldingDetailSection,MacroSection,RiskSection}.tsx`,
    `services/api.ts`, `types/{dcf,executive_summary,market_valuation,portfolio,portfolio_risk}.ts`
  - Test fixtures/suites referencing whisky/coin/metal (13 backend test files, `whiskybase_collection.csv`)
  - A new Alembic migration to remove non-equity rows from the live Supabase database and drop any
    columns/tables that only exist to support them, once the code paths above are gone -- this is the
    one part of this redesign that touches production data, and per CLAUDE.md's destructive-operations
    rule it runs only when Faiz explicitly asks for it in a session, with the deletion scope stated
    before it runs, not after.
- **Real equity portfolio data and analysis history are untouched.** No rebuild step resets or
  re-imports existing holdings, documents, or analysis runs. The Supabase project, GitHub repo, and
  Railway deployment are all reused as-is -- only application code and (for non-equity rows only)
  data are changed, never the infrastructure itself.

## Consequences

- Sprint 5 (`claude/buffett-munger-redesign-sprint-plan-2026-09-20.md`) is now fully scoped and no
  longer blocked on a Faiz checkpoint -- see that doc for the up-to-date task breakdown.
- The next session touching Sprint 5 should confirm the file list above against the repo's actual
  state at that time (files move; this list is a snapshot from this session's `grep`), write the
  removal as its own reviewed change (tests updated/removed alongside, not left red), and treat the
  Alembic migration as a separate, explicitly-confirmed step per CLAUDE.md's destructive-operations
  rule -- not bundled silently into a larger commit.
- This ADR does not reopen or change any other ADR 0019 decision (company-research capability,
  6-factor schema, new persona/schema/scoring versions) -- those stand as written.
