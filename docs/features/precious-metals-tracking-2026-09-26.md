# Precious metals tracking — 2026-09-26

Unplanned feature, Faiz's direct request this session: *"add the ability to update portfolio with
gold & silver coins... track their price development in some graphs connected to gold/silver price
free api service... top 15 most popular sorts."* Same category as F4/F6/F7 (built outside the
numbered sprint plan) — doesn't touch Sprint 15, which is still gated on credential rotation.

---

## 1. What was built

| Piece | What it does |
|---|---|
| **Coin catalog** (`app/domain/precious_metals.py`) | 15 gold + 15 silver 1oz coin series (Maple Leaf, Krugerrand, Kangaroo, American Eagle, Britannia, Philharmonic, Panda, Libertad, Buffalo, Lunar, and more) |
| **`PreciousMetalHolding` model** | Its own table — deliberately **not** folded into the equity-only `Holding`/`PortfolioPosition` model, which is brokerage-import/snapshot-shaped and doesn't fit a manually-entered physical asset |
| **`GoldApiProvider`** | Free, keyless spot price from gold-api.com. No free historical endpoint exists, so history accumulates one real point per day the app is used, rather than being backfilled or invented |
| **Valuation** (`app/services/precious_metals/`) | Each holding valued at today's spot × oz, converted USD→NOK via the existing FX cache; unrealized P&L against an optional purchase price |
| **API** (`app/api/precious_metals.py`) | `GET /coin-series`, `GET/POST /overview[/refresh]`, `GET /price-history/{metal}`, `POST/PATCH/DELETE` on holdings |
| **Migration** | `a74ba6a059dd` (additive, new `precious_metal_holdings` table + index) |
| **Frontend** | New **Precious metals** page (add-coin form, holdings table with inline quantity edit, stat tiles, dual-axis gold/silver price chart), nav entry, dashboard link card — same pattern as Portfolio risk / Performance |

## 2. Why its own table, not part of the portfolio

`Holding`/`PortfolioPosition`'s own docstrings say this is an "equity-only rebuild" tied to
brokerage-import account snapshots. Physical coins aren't a brokerage position — no ticker, no
CSV import, no account. Keeping them separate also matches the known backlog item flagged back in
the old Phase 10 notes ("liquidity tier for illiquid alternative assets — whisky, physical
metals — no 'sellable today at a quoted price' flag exists") and Sprint 12's own backlog line
repeating it: metals are intentionally outside `PortfolioOverview`'s concentration/HHI math, same
as Portfolio risk and Performance got their own dashboard cards rather than being merged into it.

## 3. Known limitations (stated up front, not discovered later)

- **No numismatic premium modeled.** Valued at spot only — a real coin dealer's buy/sell price
  differs from spot by a premium that varies by series, mintage and market conditions. Out of
  scope for v1; the purchase-price field lets Faiz track his own actual cost regardless.
- **No historical backfill.** gold-api.com's `/history` endpoint requires a paid key. The price
  chart starts empty and grows by one point per day from when this feature first ran — stated
  plainly in the API's own `method_note` field and in the page's chart caption, not silently
  presented as a full history.
- **Spot price, not a live streaming quote.** Same staleness-checked caching pattern as every
  other price in the app (`get_or_refresh_daily_history`) — refreshed on view if stale (>6h,
  configurable), or on demand via **Refresh prices**.
- **Not part of PortfolioOverview.** Total portfolio value, concentration and regime/risk metrics
  do not include precious metals value — see §2.

## 4. Tests

| | |
|---|---|
| Backend | 12 new tests (7 unit — CRUD validation, metal-derivation, overview valuation/P&L math, graceful handling of an unavailable spot price; 5 integration — coin-series catalog count, reject-unknown-series, full add/patch/delete lifecycle against the live API, price-history endpoint). Full suite: **863 passed**, same 2 pre-existing env-dependent `test_factory.py` failures (`LLM_PROVIDER=ollama` in local `.env`) — zero regressions |
| Ruff | Clean, aside from the same repo-wide pre-existing `EXE002` mount-permission noise every prior sprint has documented |
| Frontend | `tsc --noEmit` clean, `eslint` clean, `vitest` 19/19 (unchanged — no new pure `src/lib/*.ts` logic), `vite build` succeeds (867 modules; the normal `dist/` build hit the same pre-existing mount-permission quirk on cleanup, built instead to a scratch `--outDir` to verify — same workaround every prior sprint used) |
| Migration | `alembic upgrade head` reaches the new revision cleanly against SQLite in this sandbox (no local Postgres available here). **Not yet verified against real Postgres** — same caveat as every migration built in this kind of session; first real signal is the next deploy |

## 5. Try it (after push + redeploy + migration)

1. Open **Precious metals** in the nav.
2. Add a coin or two (pick metal → coin series → quantity; purchase price/date/storage are
   optional).
3. Check the spot prices and total value look plausible.
4. Come back on a few different days — the price-development chart fills in one point per day.

## 6. Not done / left for later

| Item | Note |
|---|---|
| Numismatic premium over spot | Would need a per-series premium source; not free/available today |
| Historical price backfill | Blocked on gold-api.com's paid `/history` endpoint, or a different free provider with real history |
| Including metals in `PortfolioOverview` totals/concentration | Deliberate scope cut — see §2; would need a decision on how to blend a non-equity asset into equity-only concentration math |
| Liquidity tier flag ("sellable today at spot" vs. not) | Same backlog item as whisky, from the old Phase 10 notes — still open |
