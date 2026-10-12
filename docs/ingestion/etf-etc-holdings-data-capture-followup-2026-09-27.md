# Follow-up: a free, structured way to capture ETF holdings data (2026-09-27)

Faiz asked to research the best free way to further improve ETF/ETC holdings data capture,
following on from the same-day investigation into ESEF/Newsweb sourcing
([doc](etf-etc-annual-report-sources-investigation-2026-09-27.md)), which concluded no ESEF
annual report will ever exist for these instruments. This follow-up looks specifically at
**holdings/constituents data** (the input the backlog's "Fund look-through valuation" and
"Fund annual-report holdings parser" items need) rather than annual reports.

**Research only — no code changed.**

## 1. Finding: DWS (Xtrackers) publishes a free, public, structured JSON holdings feed

Confirmed live in a browser session against the real product page for the portfolio's own
Xtrackers Europe Defence Technologies UCITS ETF 1C (`XDEF.DE` / ISIN `LU3061478973`):

- The product page (`https://etf.dws.com/en-lu/LU3061478973-europe-defence-technologies-ucits-etf-1c/`)
  calls an internal API, visible in the page's own network traffic:
  `GET https://etf.dws.com/api/pdp/en-lu/etf/LU3061478973-europe-defence-technologies-ucits-etf-1c/holdings`
  → **200 OK**, no login, no API key, no cookie/session required.
- The rendered page confirms the shape of what that endpoint returns: full constituent list with
  **ISIN, name, % weight, market value, country, industry/sector, and asset class** for every
  holding (15 shown inline, "Download full securities list" for the rest), dated (24.09.2026 at
  the time of this check).
- The same page also exposes index-level breakdowns (country/sector/currency weighting) and a
  separate **"Download historical data in Excel format"** button for NAV/index history.
- URL pattern is predictable and keyed only by the fund's own ISIN + slug (`{ISIN}-{fund-name-slug}`),
  which the app already stores per holding — so this isn't a one-off scrape, it's a stable
  per-fund endpoint any Xtrackers ETF should expose the same way.

**This is materially better than the "download a PDF/CSV and re-upload it" pipeline Sprint 8
already built**: it's already-structured JSON (no parsing library, no XLSX/CSV column-mapping
fragility), free, and — because it's the exact data the DWS site itself renders — very unlikely
to disappear or require a key. It directly unblocks the backlog's **Fund look-through valuation**
item for any Xtrackers-issued fund, XDEF included, without needing a paid data vendor.

## 2. L&G (Legal & General) — no equivalent found; more friction, not less

Checked the L&G Gold Mining UCITS ETF's own fund centre
(`fundcentres.landg.com/.../ETF/Gold-Mining/IE00B3CNHG25/`): unlike DWS, this sits behind a
**click-through Terms & Conditions interstitial** before any fund data loads, and the URL is
country-gated (redirected to a `/es/` Spanish path from a generic link). No underlying JSON API
call was visible before accepting those terms. Automating past a legal T&Cs acceptance screen
isn't something to build against — that's a click a human should make once, not something to
script around. **No free structured feed confirmed for L&G positions** in this session; the
existing manual fact-sheet/holdings-file upload (Sprint 8) remains the right approach here.

## 3. Xetra-Gold ETC — not applicable

Xetra-Gold isn't a portfolio of securities to look through (it's a single-commodity, gold-backed
bearer note) — nothing to gain from a holdings feed here. Already covered in the earlier doc:
its only public document is Deutsche Börse Commodities GmbH's annual management report (PDF,
no ESEF, thin content).

## 4. What this changes on the backlog

| Backlog item | Status after this research |
|---|---|
| **Fund look-through valuation** | For **Xtrackers-issued** funds (currently: XDEF), a free structured per-ISIN JSON feed exists and was confirmed live — this is now buildable without a paid vendor. Still blocked for L&G-issued funds (no equivalent free feed found) and Xetra-Gold (not applicable) |
| **Fund annual-report holdings parser** (PDF "schedule of investments" parsing) | Still the fallback for L&G and any non-Xtrackers fund — no PDF-parsing needed for Xtrackers funds now that the JSON feed is confirmed |

Recommendation: if/when "Fund look-through valuation" is picked up, build the Xtrackers JSON
fetch first (small, deterministic, no parsing) — it's a strict subset of the eventual multi-provider
version and gives Faiz a working look-through view on one of his three real ETF/ETC holdings
immediately, with the L&G/PDF-parsing path following later as a second provider.

## 5. Status

Research-only, 2026-09-27. No code, no migration, nothing to commit. Not on the build queue —
added to the backlog table in progress.md §3c as a refinement of the existing "Fund look-through
valuation" and "Fund annual-report holdings parser" items, not a new item.
