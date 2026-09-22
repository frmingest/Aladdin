# Account name, lost position data, and Macro page slowness — 2026-09-22

Faiz raised three issues in one message. All three are backend + frontend changes, written and
tested this session, **not yet deployed** (see "Status" at the bottom).

## 1. Account name field

**What was actually true:** `Account.name` already existed end-to-end on the backend (model,
`AccountCreate`/`AccountUpdate` schemas, `PATCH /accounts/{id}`) — nothing there was missing. The
gap was entirely in the frontend: CSV import never asked for a name (so a new account is always
auto-named `"Account <number>"`), and the Accounts table on the Portfolio page had no rename
control at all, just a name column with no way to edit it.

**Fix (frontend only, no backend change needed):**

| Change | Where |
|---|---|
| Optional "Account name" field on the upload form, applied when a brand-new account is created from a single-file upload | `PortfolioPage.tsx`'s `UploadPanel` |
| Inline rename on every row of the Accounts table ("Rename" button → edit → Save/Cancel, same pattern as the Holdings page's ticker/sector editing) | `PortfolioPage.tsx`'s new `AccountRow` |
| `api.updateAccount()`, `AccountUpdateInput` type | `lib/api.ts`, `lib/types.ts` |

## 2. CSV upload losing quantity/price/GAV data

Faiz's report was actually two separate things, confirmed by reading the importer:

**a) Genuinely lost (a real bug):** `csv_parser.py` has always parsed `siste kurs` (last traded
price) and `Verdi NOK` (total position market value) out of every CSV row into
`ParsedPosition.last_price` / `.value_nok`. Neither was ever persisted — `last_price` was parsed
and then simply never read again; `value_nok` was read only transiently to compute `weight_pct`
before being discarded. This data does not exist anywhere in the database for any position
imported before this session's fix, and can't be backfilled (the raw per-row values weren't kept).

**b) Stored but never shown (a UI gap, not a data gap):** `quantity` and `cost_basis` (= GAV ×
quantity) *were* being saved correctly on every import — they just had zero UI. No page anywhere
in the frontend rendered `PortfolioPosition.quantity` or `.cost_basis`, even though the API already
returned them.

**Fix:**

| Change | Where |
|---|---|
| New columns `last_price`, `market_value_nok` on `portfolio_positions` | Migration `a2b4c6d8e0f1` (new head, off `e5f6a7b8c9d0`) |
| Both populated on every CSV import from here on | `services/portfolio_import/ingestion.py` |
| Both round-trip through `PortfolioPositionIn`/`Out` and `POST /portfolio/snapshots`, `POST .../positions` | `schemas/portfolio.py`, `api/portfolio.py` |
| New expandable positions table — click a Snapshot row to see every position's quantity, avg. cost (GAV), cost basis, last price, market value (NOK), and weight — the first UI anywhere that shows position-level data at all | `PortfolioPage.tsx`'s new `SnapshotRow`/`PositionsTable`, `api.getSnapshot()` |

**Real consequence for Faiz:** every position imported *before* this migration ships and a fresh
CSV re-import happens will have `last_price`/`market_value_nok` = `NULL` in the positions table —
re-uploading the same CSVs after deploying will backfill them (a re-upload creates a new snapshot,
it doesn't touch old ones).

## 3. Macro page loading slowly

**Root cause found (not fixed by frontend tuning — this is a real backend bug):**
`app/providers/budget.py`'s `DailyBudgetGuard` — built specifically to stop a burned-through daily
Gemini quota from being retried into more real 429s (see `gemini-daily-budget-guard-2026-09-16.md`)
— was constructed by `factory.get_primary_budget_guard()` but **never actually consulted anywhere**
in the real call path. Confirmed by grep: no call site anywhere in `app/` ever called
`.would_exceed()` or `.record_usage()`.

Both Gemini-calling providers (`GoogleAIStudioProvider` for analysis, `GeminiResearchProvider` for
macro/sector/company research) share one Google AI Studio account and its real free-tier cap —
20 requests/day, `LLM_RATE_LIMIT_RPD`. Macro research, every sector's research, every company's
research, and every analysis run all draw from that same 20/day. Once it's spent (easy to do with
124 real holdings), **every further call still paid the full cost of finding that out the hard
way**: the shared RPM pacer's wait (12s at the configured `RPM=5`), a real network call, and — on
the 429 that call gets back — three more retries with exponential backoff, each preceded by another
12s pacing wait. That's on the order of 45-60+ seconds of hanging for a call that was actually
knowable-in-advance to fail, and it's exactly what "Macro page loading really slow" looks like from
the browser: `GET /research/macro` just sits there.

**Fix:** `gemini_retry.call_with_retry()` now takes an optional `budget_guard`. When given one and
the daily quota is already spent, it raises immediately — no pacing wait, no network call, no
retries. Both providers now receive `factory.get_primary_budget_guard()` (the same `@lru_cache`d
instance, since they share the same account) and translate that into their own
`LLMUnavailableError`/`ResearchUnavailableError`. Every real attempt (success or failure) still
records against the guard, same as `DailyBudgetGuard`'s own docstring always asked callers to do.

This doesn't make Gemini itself faster — a real grounded-search call still takes however long it
takes, and RPM pacing still applies when there's real budget left. What it fixes is the case that
was actually making the page feel broken: once the quota's gone, failure is now near-instant and
clearly labeled ("daily request budget exhausted") instead of a ~minute-long hang.

**Also worth flagging to Faiz directly:** `LLM_RATE_LIMIT_RPD=20` shared across macro + every
sector + every company + every analysis run is a very tight budget for 124 real holdings — this
session didn't change that number, only how it fails once it's spent. If real usage still feels
budget-starved after this fix (fast, clear failures instead of slow hangs, but still frequent
failures), the next lever is either a higher daily cap (if the real Google AI Studio account
supports one) or spacing out research/analysis runs across days — worth a decision from Faiz, not
guessed at here.

## Testing

333 backend tests passing (333 = 326 before this session + 7 new: 2 for the position
last_price/market_value persistence + round-trip, 4 for the budget-guard fast-fail behavior in
`call_with_retry` and both providers, 1 confirming both providers share one guard instance), ruff
clean on every file this session touched (pre-existing `EXE002`/unrelated-file noise untouched).
Migration `a2b4c6d8e0f1` verified upgrade+downgrade against the Postgres dialect offline (no live DB
reachable from this session — same limitation every session has hit). Frontend: `tsc --noEmit`
clean, `eslint .` clean, `vite build` succeeds (601 kB main bundle, pre-existing size warning,
unrelated to this session's changes).

**Not run against a live Gemini call, real market data, or Faiz's real 124 holdings** — same
caveat every session's write-up has carried; this session only had this repo's own test suite and
an offline Postgres-dialect check available.

## Status

**Committed locally, not pushed, not deployed.** Railway only picks this up once it's pushed and
redeployed — none of today's fixes (account rename, last_price/market_value_nok persistence, or the
budget-guard fast-fail) are live until that happens. After a redeploy, migration `a2b4c6d8e0f1` runs
automatically (`alembic upgrade head` on container startup) — it's additive (two new nullable
columns), so it's safe against the real Supabase data with no downtime or backfill step.
