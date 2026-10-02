# Free market-data & research provider sources (2026-09-21)

Faiz asked for good free-to-use market-data and research sources to widen what Aladdin can pull in
automatically, alongside the DELETE /portfolio/all bug fix this session (see
`buffett-munger-rebuild-sprint-plan-2026-09-21.md` and `progress.md`'s changelog for that fix).

**Research/recommendation doc only — no code changed for this part.** This build environment can't
make live outbound calls to verify every claim below, so free-tier limits are search-confirmed as of
this session, not live-response-confirmed. Terms change — re-check before building against any of
these. (Since then SEC EDGAR, Newsweb, filings.xbrl.org, FRED, Norges Bank, SSB, gold-api.com, DWS
and LGIM feeds have been built; see progress.md "Free data sources in use".)

## Where things stood on 2026-09-21

| Data need | Source then |
|---|---|
| Share price / history / beta | `yfinance` (`app/providers/yfinance_provider.py`) — only price source, ADR 0004 |
| FX rates | Also `yfinance`, via `MarketDataProvider.get_fx_rate` |
| Risk-free rate (US) | FRED, via `fred_risk_free_rate_provider.py` |
| Macro data (US/Eurozone/China/Norway) | FRED (primary) + Norges Bank (NOK-specific), `research/versions/v2.yaml` |
| Qualitative macro/sector research | Gemini + Google Search grounding (Phase 4) |
| Company financials (income statement, balance sheet, etc.) | **Manual only** — Faiz uploads a filing/report as a document, an LLM extracts `FinancialLineItem` rows (`app/api/documents.py`) |
| Gold/silver spot | Planned via gold-api.com (ADR 0011), not yet built |
| Norwegian mutual fund NAV (Alfred Berg, Heimdal) | **No source at all** — flagged unpriced in `market-ticker-ui-fix.md` |

The one real gap worth closing with something free: **company financials are 100% manual** right
then. Everything below is organized around closing that, plus rounding out macro/news coverage —
not replacing yfinance, which is working fine for prices.

## 1. Company fundamentals — the highest-value gap

**Portfolio reality check first:** Aladdin's holdings mix US-ish tickers (test fixtures use AAPL)
with genuinely Norwegian/Oslo Børs names (Vår Energi, Salmon Evolution). No single free API covers
both worlds well, so this splits in two:

### US-listed / SEC-registered names → SEC EDGAR (top pick)

- **`data.sec.gov`'s company-facts API** (`/api/xbrl/companyfacts/CIK##########.json`) — every
  XBRL-tagged fact a company has ever filed (revenue, EPS, assets, etc.), structured JSON, no API
  key, no cost, official primary source straight from the filer. This is a near-perfect fit for
  Aladdin's evidence-first architecture (§21 — the LLM never asserts a number it didn't get from
  real data): every fact can cite the actual filing accession number and date.
- **EDGAR full-text search API** (`efts.sec.gov/LATEST/search-index`) — free, searches the text of
  every filing (10-Ks, 10-Qs, 8-Ks, proxies) — useful for qualitative evidence (risk factors,
  management discussion) beyond the numeric XBRL facts.
- **Rate limit:** 10 requests/second per the SEC's own fair-access policy, and it asks for a
  descriptive `User-Agent` header identifying the requester (an email address, per their
  convention) — trivial to stay under for Aladdin's per-holding-on-demand usage pattern.
- **Coverage gap:** only reaches SEC registrants. Vår Energi and Salmon Evolution (Oslo Børs only,
  no SEC filings) get nothing from this.
- Sources: [SEC.gov Developer Resources](https://www.sec.gov/about/developer-resources), [SEC EDGAR APIs](https://www.sec.gov/search-filings/edgar-application-programming-interfaces)

### Norwegian/Nordic names → two free official sources, less structured

- **Oslo Børs Newsweb** ([newsweb.oslobors.no](https://newsweb.oslobors.no/)) — the official
  regulated-announcement feed every Oslo Børs-listed company must publish to (quarterly reports,
  ownership notifications, insider trades, material events). Free, public, no key. Not a clean JSON
  API — it's a searchable web feed — so this is more of a research/evidence source (like the
  existing Gemini research provider) than a drop-in `MarketDataProvider`.
- **Brønnøysundregistrene (the Norwegian company register)** — `data.brreg.no`'s Enhetsregisteret
  API (basic entity data: registration status, org form, roles) is confirmed free and keyless, no
  registration needed. There's also a `regnskapsregisteret` (accounts register) API exposing key
  annual-accounts figures for Norwegian-registered entities — worth a look, but its GitHub repo was
  archived November 2025, so **verify it's still live before relying on it**.
- Sources: [Brønnøysundregistrene — Datasets and API](https://www.brreg.no/en/use-of-data-from-the-bronnoysund-register-centre/datasets-and-api/), [regnskapsregister-api docs](https://github.com/brreg/regnskapsregister-api/blob/main/docs/for-devs.md)

### General/global fallback — real, but narrow

- **Financial Modeling Prep (free tier):** 250 calls/day, but **US-only** and limited to a fixed
  whitelist of ~87 symbols (AAPL, TSLA, AMZN, and similar large caps) on the free plan —
  international coverage needs a paid plan. Not useful for this portfolio's actual holdings.
- **Finnhub (free tier):** generous call volume for basic quotes, but most of the detailed
  fundamentals/financial-statement endpoints are gated to paid plans — treat as a quotes/news
  supplement, not a fundamentals source, until re-verified.
- Neither is a real substitute for SEC EDGAR or Newsweb above; list them only as a possible
  spot-check/backup.

## 2. Macro/economic data — rounding out FRED + Norges Bank

Already solid (FRED + Norges Bank, ECON-003/004 added commodities/Eurozone/China). If the macro
registry ever needs to go broader than that:

- **World Bank Open Data API** — free, no key, global GDP/inflation/trade series, good for
  cross-country comparison context.
- **OECD Data API** — free, useful for member-country indicators FRED doesn't carry directly.
- **IMF SDMX API** — free, global macro/financial stability data.

None of these are urgent — flagging them only in case a future macro-coverage review (like
ADR 0014) wants more breadth than FRED's international series offer.

## 3. Qualitative research supplement

The existing Gemini + Google Search grounding (Phase 4) already handles macro/sector narrative
research. Two free additions worth considering if evidence citations need to get more
primary-source-direct:

- **SEC EDGAR full-text search** (above) — lets the evidence packet cite an actual filing passage
  instead of an LLM-summarized one, for US names.
- **GDELT Project** — a free, keyless, massive global news index. Broader and noisier than Google
  Search grounding, so more useful as a supplementary signal (e.g., sentiment volume around a
  holding) than a primary evidence source.

## 4. The known pricing gap: Norwegian mutual funds

`market-ticker-ui-fix.md` already flagged that Alfred Berg Nordic High Yield II R and Heimdal
Høyrente Pluss B aren't on Yahoo Finance and stay excluded from valuation. One lead worth checking
(not verified working): **Verdipapirfondenes forening (VFF)**, the Norwegian fund industry
association, publishes daily NAV data for Norwegian-domiciled funds — if it has a free feed or
downloadable dataset, that would close this gap the same way gold-api.com is meant to close the
precious-metals one (ADR 0011). This needs a real look at vff.no before committing to it.

## Suggested next step (as of 2026-09-21)

Don't build all of this — two additions would give the best value-for-effort, both zero-cost:

1. **SEC EDGAR company-facts** as a new `FundamentalsProvider`-style source for SEC-registered
   holdings — reduces manual document upload for any future US name, with citation-grade evidence.
2. **Oslo Børs Newsweb** wired in similarly to the existing Gemini research provider, for
   Norwegian-listed holdings' regulated announcements.

Both fit the existing "new provider = a new file behind the factory, no service-layer change"
pattern already established for LLM providers. Both have since been built (see
`primary-sources-sec-edgar-newsweb-2026-09-22.md`).
