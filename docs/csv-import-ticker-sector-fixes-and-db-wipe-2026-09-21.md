# CSV-import ticker/sector fixes, manual-edit UI, and full data wipe — 2026-09-21

Faiz uploaded 5 real Nordnet "Beholdningstabell" CSVs, hit a 500 on every one, and separately
noticed garbage tickers and duplicate holdings on the Holdings page. This session found and fixed
three distinct real bugs, added a manual-edit UI (ticker/sector/instrument type), and — at Faiz's
explicit request after being told exactly what it costs — wrote the migration that fully wipes
Supabase.

## Bug 1: `POST /portfolio/import-csv` 500ing after a successful import

**Root cause:** `Document.quality_flags` is a plain JSON column. Current ingestion code always
writes a `dict[str, bool]` to it, but at least one existing row (from before this rebuild, or an
earlier ingestion-code shape) held a `list[str]` instead. `DocumentOut.quality_flags: dict[str, bool]`
rejects a list outright under Pydantic v2 — so `_document_to_out` crashed *after* the CSV had
already been fully parsed, stored, and committed (account/document/snapshot/positions all real and
saved) — the import actually succeeded server-side every time; only the response serialization
crashed, which is why every one of Faiz's 5 uploads showed "Upload failed" in the UI despite the
data landing correctly.

**Fix:** `DocumentOut` (`backend/app/schemas/document.py`) now has a `field_validator` on
`quality_flags` that coerces a list of flag names into `{name: True, ...}` (matching exactly what
current ingestion code would have written for the same flags) and any other unexpected shape into
`{}`. Never drops information, never 500s again regardless of what's actually stored.

## Bug 2: garbage tickers + duplicate holdings on every CSV (re-)import

**Root cause:** `_find_or_create_holding` (`backend/app/services/portfolio_import/ingestion.py`)
deduped on an *exact* match between `_slugify_ticker(name)` and `Holding.ticker`. Any holding that
already existed under a different ticker — a real market ticker Faiz assigned by hand, or (before
today's wipe) a legacy pre-rebuild row whose "ticker" was literally its raw display name — was
invisible to that check, so every CSV import silently created a fresh duplicate Holding with a
slugified name as its "ticker" instead of matching the real one. That slug (e.g. `V-R-ENERGI` for
"Vår Energi" — å isn't ASCII and isn't NFKD-decomposable, so it just vanished, splitting the word)
was then getting passed straight to the market-data/valuation/research/analysis providers as if it
were a real ticker symbol (`holding.ticker` is used directly by `yfinance`-backed price/beta lookups
and by the research/analysis pipeline) — a real correctness problem for a system meant to be trusted
with real money decisions, not just a cosmetic one.

**Fix:**
- Matching is now by normalized security **name** (casefolded, diacritics-transliterated,
  punctuation-stripped) against every existing holding, independent of whatever's in `ticker`. A
  holding Faiz has already assigned a real ticker to is now found and reused correctly.
- The placeholder ticker generated for a genuinely new holding is transliterated first (æøå → ae/o/a)
  for readability (`VAR-ENERGI` instead of the broken `V-R-ENERGI`) and disambiguated with a numeric
  suffix on collision, rather than risking a UNIQUE-constraint 500.
- It's still explicitly a placeholder — the real fix is assigning the real market ticker by hand via
  the new manual-edit UI below.

## New: manual-edit UI for Ticker / Sector / Instrument Type

Faiz's request: 3 fields he can fix by hand when the importer's automatic guesses are wrong.

- **Ticker** — now editable via `PATCH /holdings/{id}` (it was explicitly excluded before, on the
  reasoning that changing it was unsafe; that reasoning was wrong — nothing in the app foreign-keys
  on `ticker`, only on the holding's `id`, so renaming it in place is a plain, safe UPDATE).
  `update_holding` now returns a 409 on a ticker collision instead of a raw `IntegrityError` 500.
- **Sector** — now a canonical dropdown (`backend/app/domain/sectors.py`, standard GICS-11), not free
  text. Both `HoldingCreate` and `HoldingUpdate` reject anything not on the list. This is also the
  fix for the mislabeling visible in Faiz's own screenshot (Xetra-Gold, a gold ETC, shown under the
  legacy free-text sector "Aksje").
- **Instrument Type** (`asset_class_raw`) — now editable and dropdown-restricted to the existing
  `INSTRUMENT_TYPES` list (stock / equity_etf / bond_fund / money_market_fund / commodity_etc). Fixes
  a wrong guess from the CSV importer's name-based classifier.
- `GET /holdings/field-options` serves the canonical sector/instrument-type lists to the frontend —
  single source of truth so the dropdown can never offer a value the backend would then reject.
- **Frontend:** `HoldingsListPage.tsx` — hover a row, click "Edit", fix Ticker/Type/Sector inline,
  Save/Cancel. The CSV-upload panel (`PortfolioPage.tsx`) now points to this page after a successful
  import ("New holdings only get a placeholder ticker... review and assign the real ones").

## Full Supabase data wipe — Faiz's explicit, in-conversation request

Editing Ticker/Sector/Type on each row doesn't merge the ~7 duplicate pairs already in the DB (two
separate rows for the same security). Before touching anything irreversible, Faiz was told plainly
what a full wipe costs — the 15 financial documents already uploaded for 6 holdings (Alfred Berg,
L&G Gold Mining, Salmon Evolution, Vår Energi, Xetra-Gold, Xtrackers), the whisky/gold/silver legacy
holdings, all 5 accounts / 7 snapshots / 124 positions per the project's own progress log, and the
Sprint 4 analysis-engine tables — and confirmed "full wipe, really everything."

**Migration:** `backend/alembic/versions/e5f6a7b8c9d0_full_data_wipe.py` (new head, revises
`b5e1a9c3d7f2`). `TRUNCATE`s every table in the `public` schema except `alembic_version` itself
(reflected live from `pg_tables` rather than hand-listed, so nothing is missed), `RESTART IDENTITY
CASCADE` in one statement. `downgrade()` is intentionally a no-op — this isn't reversible, and
pretending otherwise would be worse than saying so.

**This supersedes CLAUDE.md's "the DB is not being reset" decision, at Faiz's explicit ask this
session** — same pattern the `/portfolio/all` wipe endpoint's own docstring already used for a
narrower reset.

**Status: written and committed, NOT yet run.** Railway runs `alembic upgrade head` automatically on
container startup (confirmed from Faiz's own posted boot logs), so the wipe executes automatically
the next time this is pushed and redeployed — not before. This session could not verify the
migration's SQL end-to-end against a live Postgres connection (no network path to the Supabase host
from this session's shell, and no local Postgres available to stand one up) — verified instead by:
confirming it's syntactically correct and slots into the migration chain correctly (`alembic upgrade
head --sql` reaches and begins executing it, failing only at the point offline SQL-generation mode
can't represent a dynamic/reflective query — expected for this kind of migration, not a defect), and
by manual review of the `pg_tables`/`TRUNCATE ... CASCADE` SQL itself. **The first real signal that
this ran cleanly will be the Railway deploy logs and an empty Holdings page after redeploy.**

## Testing

- 326/326 backend tests passing (17 new/updated: quality_flags coercion — dict passthrough, list
  coercion, unexpected-shape fallback; ticker update + 409 collision; instrument-type update +
  rejection; sector-dropdown rejection; `GET /holdings/field-options`; the exact duplicate-holding
  bug reproduced and fixed — a holding under a real hand-assigned ticker now matches a same-name CSV
  row instead of spawning a duplicate; the transliterated-slug fix; slug-collision disambiguation).
- `ruff check` clean (only the same pre-existing `EXE002` file-permission noise across the whole
  repo, unrelated to this change).
- Frontend: `tsc --noEmit` clean, `eslint .` clean, `vite build` succeeds (844 modules, no errors).
- **Not run against the live Railway deployment or the real Supabase DB** — no network path to
  either from this session. First real signal is the next deploy.

## Needs from Faiz

- **Push `main`** (2 new local commits: `ac56228` CSV-import/ticker fixes, `42b8ee5` the data-wipe
  migration) — this session hit the same `could not read Username for 'https://github.com'` credential
  gap every prior session has hit (see "Known ongoing issue"), so `git push` failed and both commits
  are local-only on the device's working tree. Faiz confirmed "yes, push when ready" — the intent
  stands, only the credentials are missing. Redeploying on Railway after the push is what actually runs
  the CSV-import fixes **and** the full data wipe — neither has happened yet.
- After redeploy: re-upload the 5 CSVs clean (Holdings will be empty), then use the new inline-edit
  UI to assign real tickers/sectors as they come in, rather than leaving placeholder tickers in
  place — the market-data/valuation/research/analysis pipeline depends on `Holding.ticker` being a
  real symbol.
- Re-set `MARKET_DATA_PROVIDER`/`RESEARCH_PROVIDER` and re-confirm API keys as needed — these were
  already flagged as still-`stub` in `backend/.env` in the prior session's progress notes, unrelated
  to this session's changes but worth doing in the same pass since the DB is starting fresh anyway.
