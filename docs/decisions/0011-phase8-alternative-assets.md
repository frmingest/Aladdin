# 11. Phase 8 (proposed) — alternative/physical assets: precious metals and collectibles

## Status

Proposed — design only, not built. Recorded now (2026-09-14) because Faiz asked for both of these
during a status/planning review, and the reasoning for *how* each should fit the existing model is
worth capturing before either is built, same as every other phase's ADR.

## Context

Faiz's portfolio isn't only brokerage-held securities. He also holds:

1. Physical 1oz gold and silver coins, bought in one-off purchases (not a periodic brokerage
   snapshot) at their own dates and prices, in NOK or USD.
2. A whisky collection, currently tracked via his The Whisky Exchange account.

Both are real holdings that belong in the same portfolio-composition, concentration, and risk
picture as everything else (§7, §15) — but neither fits the assumptions Phases 0-7 were built
around: a periodic multi-row brokerage export (canonical schema or Nordnet, decision 0003) with a
resolvable market-data ticker (Phase 2). Two separate questions follow: how does each asset type
enter the system, and how (if at all) does it get priced.

## Decisions

### Precious metals (gold/silver coins)

- **New `AssetClass.COMMODITY` value** in `app.domain.asset_class`. `OTHER` would technically work
  but throws away the distinction §15.1's systemic-risk dimension already assumes exists (commodity
  exposure, gold custody type) — cheap to add now, and every downstream consumer (concentration,
  risk) already groups by `asset_class` so this is additive, not a schema break.
- **`Holding.custody_type` already covers "physically allocated"** (architecture.md line 862 — this
  field was added in Phase 5 for exactly this distinction: allocated bullion vs. an
  issuer-backed/paper commodity structure). No new field needed there; coins would simply set
  `custody_type = "allocated_physical"` (or similar — exact enum value TBD when this is built).
- **New optional `PortfolioPosition.acquired_at` (date).** Every existing position's "when" is
  implicitly the snapshot's `uploaded_at` — fine for a brokerage holding that's continuously held
  and merges forward across uploads, wrong for a coin bought on a specific date and never re-priced
  by re-upload. Nullable, defaults to unset for brokerage-sourced positions; populated explicitly
  for manually-entered physical-asset lots. This also means two purchases of the same coin type at
  different times/prices become two distinct `PortfolioPosition` rows (each its own cost basis and
  date) rather than colliding — the same lesson decision 0003's account-scoping regression already
  taught this codebase once, for a different reason.
- **A manual single-holding entry path.** Every existing way to get a holding into the system is a
  bulk CSV/XLSX upload (canonical schema or Nordnet). For "I bought one coin today," that's the
  wrong shape — either a minimal one-row canonical-schema CSV through the *existing* upload endpoint
  (zero new backend code, works once `COMMODITY` exists) or a proper `POST /portfolio/holdings` +
  `POST /portfolio/positions` manual-entry endpoint/form. Recommend starting with the CSV route to
  validate the model cheaply, add the manual-entry form once the shape is proven — consistent with
  §2.9 "free/low-cost first."
- **New `MetalPriceProvider`, wired in behind the existing `MarketDataProvider` abstraction** —
  reusing the same composite-provider pattern Phase 4 already established for macro data
  (`CompositeMacroDataProvider`, routing FRED vs. Norges Bank by series key). A holding whose
  `market_ticker` is `"XAU"`/`"XAG"` routes to the new metals provider instead of yfinance.
  **gold-api.com** is the recommended backing API: free, no API key, no documented rate limit,
  returns live XAU/XAG spot in USD, CORS-enabled. (Alternatives surveyed: metals-api.com has no free
  tier at all — paid plans start at $19.99/mo; goldapi.io's free-tier terms weren't confirmable from
  its docs. yfinance itself already carries gold/silver futures tickers (`GC=F`/`SI=F`) and could be
  a zero-new-code fallback, but futures-contract pricing carries roll/contango quirks a dedicated
  spot API avoids.) FX conversion to NOK reuses Phase 2's existing `FxObservation`/conversion
  machinery unchanged; spot observations land in the existing `market_observations` table
  (`provider="gold_api"`) — no new table.
- **Spot value and cost basis stay two separate, explicitly-labeled numbers.** A coin's dealer
  premium over spot means `quantity × spot_price` will not equal what Faiz paid — showing only one
  of those as "the value" would be false precision (§13.3). Mark-to-market uses spot; unrealized
  P&L against `cost_basis` will honestly reflect premium-to-spot compression/expansion, not just
  spot movement.

### Whisky collection (collectibles)

- **No automatable personal-collection feed exists from either source Faiz might use.** The Whisky
  Exchange is a retailer — no public API, and no "my collection" feature was found, only order
  tracking/support pages. Whiskybase (a separate whisky-cataloguing community site, distinct from
  The Whisky Exchange) does publish a real API, but its own docs state it explicitly excludes
  personal/customer collection data ("Whiskybase does not sell customer data or any
  customer-identifying data") and access is partner-scoped, not free/self-serve.
- **Recommended path: a manual CSV data dump**, same "schema-flexible but validated against a
  canonical schema" pattern used for the Nordnet importer (decision 0003) — built from a real sample
  the same way that was. Whiskybase does offer a free "export your collection" feature (CSV/Excel,
  available to all members) if Faiz catalogs bottles there; otherwise a simple template covering
  bottle name, distillery, vintage/age statement, ABV, bottle size, quantity, purchase date, and
  purchase price + currency would do.
- **New `AssetClass.COLLECTIBLE` value** (alongside `COMMODITY` above), and again `custody_type`
  (already generic on `Holding`) covers "where it physically sits" if that's ever useful.
- **No live pricing feed** — unlike gold/silver, there is no free, reliable secondary-market pricing
  API for whisky (Whiskybase's own commercial data and indices like Rare Whisky 101 are paid,
  specialist products, not a fit for §2.9's free-first stance). Carrying value defaults to cost
  basis; an optional user-editable "current estimated value" field lets Faiz update it by hand when
  he has a reason to (an auction result, a Whiskybase community valuation he's seen), always shown
  as explicitly self-reported rather than market-derived (§21: never silently invent a market price
  that doesn't exist).

## Consequences

- Neither asset type is built yet. This ADR exists to settle the *shape* of the eventual build
  (which fields are new vs. reused, which provider, what's explicitly out of scope) before code is
  written, per this project's usual ADR-before/alongside-build convention.
- Before building, Faiz needs to: (1) confirm the coin-purchase CSV/manual-entry shape works for how
  he actually wants to log purchases, and (2) provide a real whisky-collection sample (a Whiskybase
  export, a filled-in template, or a description of what he already tracks) — building the
  whisky-import parser against assumptions instead of a real sample is exactly the mistake decision
  0003 corrected for Nordnet.
- Building the `MetalPriceProvider` needs a live smoke test against `api.gold-api.com` from an
  unrestricted network — like every other external provider in this codebase (yfinance, Gemini,
  FRED, Norges Bank; see ADRs 0004/0005/0007), this design was researched via web search from a
  sandboxed build environment with no outbound path to verify the API live.
- Two new `AssetClass` values (`COMMODITY`, `COLLECTIBLE`) are additive to an enum every existing
  concentration/risk computation already switches on by iterating known values — worth checking
  those call sites don't assume the historical six-value set is exhaustive (e.g. an unguarded
  dict keyed by all `AssetClass` members) before shipping either.
