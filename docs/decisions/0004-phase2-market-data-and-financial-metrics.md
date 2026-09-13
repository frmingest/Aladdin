# 4. Phase 2 — market data, FX, and deterministic financial metrics

## Status

Accepted

## Context

Phase 2 (§26) resolves the market-data provider open question (§29) and builds the deterministic
layer the architecture requires before any AI analysis happens (§2.2): market data + FX, financial
metrics, portfolio market value, P&L, and concentration/exposure. Several implementation-level
decisions weren't settled by the architecture doc.

## Decisions

- **yfinance as the initial `MarketDataProvider`.** Free, no API key, and — the deciding factor for
  this portfolio — decent coverage of Oslo Børs (`.OL`) tickers via Yahoo Finance. It's an
  unofficial wrapper around undocumented Yahoo endpoints with no SLA and no authentication; it can
  change or break without notice. That's an accepted tradeoff of "free/low-cost first" (§2.9), not
  a claim of production-grade reliability. Because application/service code depends only on the
  `MarketDataProvider` interface (§3), swapping providers later (e.g. to a paid API with a real SLA)
  is a new file behind the existing factory plus a settings flip — no service-layer changes.
- **Every yfinance observation is marked `"delayed"`, never `"current"`.** Yahoo's quote data has no
  documented real-time guarantee. §8.3 requires the application to distinguish real-time from
  delayed data rather than overstate freshness we can't verify, so this provider never claims
  `"current"` regardless of how recent the underlying data actually is.
- **`Holding.market_ticker` is a new, separate field from `Holding.ticker`.** For a canonical-schema
  upload (§7), `ticker` is already a real exchange ticker, so the parser copies it into
  `market_ticker` automatically. For a Nordnet export (decision 0003), `ticker` is the instrument
  name (no ticker column exists in that export) — using it as a market-data symbol would either
  fail outright or, worse, silently resolve to the wrong instrument. `market_ticker` stays `NULL`
  for those holdings until set explicitly via the new `PATCH /portfolio/holdings/{id}` endpoint
  (§21: never guess). A re-upload of the same holding never clobbers a manually-set `market_ticker`
  back to `NULL`.
- **Market data provider interface completed to the full §8.1 shape.** `get_dividends` and
  `get_market_metadata` were added alongside the three methods already stubbed in Phase 0
  (`get_latest_price`, `get_historical_prices`, `get_fx_rate`), since dividend yield and
  currency/shares-outstanding metadata are needed for the financial-metrics layer and cost little to
  add now. `StubMarketDataProvider` implements all five, consistently raising `NotImplementedError`.
- **`MarketDataUnavailableError` lives in `app/providers/base.py`**, not `app/domain/errors.py` —
  it's a provider-contract error every `MarketDataProvider` implementation raises, not an
  ingestion-flow error mapped straight to an HTTP status the way `app/domain/errors.py`'s exceptions
  are. It's caught internally by the valuation service, not surfaced as a raw 5xx.
- **A holding failing to price never fails the whole refresh.** Missing `market_ticker`, a delisted
  ticker, an unavailable FX pair — each is recorded as a per-holding `data_warning` and excluded
  from totals/weights, with that exclusion also surfaced in a portfolio-level `warnings` list. This
  mirrors the Phase 1 precedent for document extraction failures (§21: fail visibly, not silently —
  and "visibly" here means an explicit flag, not an opaque 500 for one bad ticker among many).
- **Portfolio valuation is computed on demand, not persisted as a new snapshot table this phase.**
  `POST /portfolio/snapshots/{id}/valuation` fetches live data, persists the underlying
  `MarketObservation`/`FxObservation` rows (the actual evidence, §5.2/§8.3), and returns a computed
  view — but doesn't write a `portfolio_risk_snapshots`-style row of its own. That table belongs to
  the analysis-run world of Phase 5 (§10). Historical valuations remain reconstructable later by
  replaying the persisted observations for a point in time, so nothing is lost by deferring it.
- **Concentration uses HHI (Herfindahl-Hirschman Index) plus largest-single-name weight**, computed
  for single-name, sector, currency, and asset-class groupings (§15/§19). A holding excluded from
  valuation is also excluded from concentration figures, with that exclusion stated explicitly
  rather than silently skewing the remaining weights to still sum to 100%.
- **Monetary and percentage outputs are rounded once, at the display/API boundary**
  (`app.domain.calculations.quantize`) — 2 decimal places for money, 4 for percentages (matching
  `portfolio_positions.weight_pct`'s existing `Numeric(9,4)`). Decimal arithmetic naturally grows its
  scale on multiplication (a 6-decimal price times an 8-decimal FX rate produces 14 decimals);
  displaying that raw is itself a form of false precision (§13.3), not genuine accuracy.
- **FX rates are cached per (from, to) pair within a single refresh call**, and the trivial
  same-currency case (e.g. NOK→NOK) is never round-tripped through the provider or persisted as an
  observation — it carries no information. This is the per-run instance of §2.7's "cache
  aggressively" principle; provider-level/cross-request caching is a natural follow-up, not built
  yet.
- **Fixed a Phase 1 bug surfaced by this work**: `check_basic_readability` (§6.1) only tried
  UTF-8 for `.csv` uploads, so a real Nordnet export — UTF-16 with a BOM despite its `.csv`
  extension (decision 0003) — was rejected as "unreadable" *before* the portfolio parser (which
  already handled UTF-16) ever got a chance to read it. This was never caught earlier because the
  existing Nordnet tests called `parse_and_validate` directly, bypassing the upload endpoint's
  readability check entirely. Now fixed to try UTF-8 then UTF-16, matching the parser's own
  tolerance, with a regression test added at the API level.

## Consequences

- Faiz's actual Nordnet holdings (Vår Energi, Salmon Evolution, L&G Gold Mining ETF) will price as
  `"unavailable"` until their `market_ticker` is set manually — a one-time step per holding, not
  per upload, since the value now survives re-uploads.
- yfinance's real-network behavior could not be verified from this build environment (its sandbox
  blocks outbound access to Yahoo Finance domains); provider-mapping logic is covered by unit tests
  against fakes shaped like the real 1.7.0 API, but a live smoke test on an unrestricted network
  is a recommended manual follow-up.
- A "view latest valuation without refreshing" endpoint (reading the most recent persisted
  `MarketObservation`/`FxObservation` per holding instead of calling the provider) is a natural
  near-term addition once a dashboard (Phase 6) needs to render a valuation without triggering a
  live refresh on every page load — not built this phase to keep scope to what §26 actually asks
  for.
- `yfinance` joins `pandas`/`openpyxl`/`fitz` as a dependency with no type stubs; `mypy` needs
  `--ignore-missing-imports` (or a per-module override) to stay clean, consistent with how the
  existing document-parsing dependencies are already handled — no project-wide mypy config exists
  yet to formalize this.
- Running `black` against the full codebase (not just Phase 2's new files) reformats nearly every
  file, including ones untouched by this phase — the project has apparently never been formatted to
  black's default line length. This is a pre-existing gap, not a Phase 2 regression; worth a
  dedicated cleanup pass (and a committed `pyproject.toml` pinning the intended line length) rather
  than folding an unrelated whole-repo reformat into this phase's diff.
