# L&G (LGIM) holdings capture for the L&G Gold Mining UCITS ETF (F31) — 2026-09-29

**Status:** written and unit-tested; **not committed, not deployed, not run from Railway**. No migration. Follows the Xtrackers capture ([fund look-through valuation](fund-look-through-valuation-2026-09-29.md)).

## The question
Faiz liked the free Xtrackers holdings capture and wanted the same for the **L&G Gold Mining UCITS ETF** (`IE00B3CNHG25`). He proposed two routes: (1) scrape LGIM's fund page, (2) use the underlying index (STOXX Global Gold Miners).

## What was checked
| | Finding |
|---|---|
| Underlying index | Confirmed (justETF): the fund tracks STOXX Global Gold Miners by full physical replication, 44 holdings |
| Route 2 (STOXX) | Not confirmed free/unauthenticated — public STOXX pages show top holdings only; full constituent files usually need an account/licence. Would also be an *index proxy*, not the fund's holdings. **Not used** |
| Route 1, as proposed | The guessed endpoint (`fundcentres.lgim.com/api/fund-data/holdings?isin=…`) is not real. But the idea was right |
| Route 1, in fact | The fund page (`fundcentres.landg.com/en/no/private-investors/fund-centre/ETF/Gold-Mining/`) publishes a public **"Download full fund holdings" CSV**. Found by inspecting the page's real network traffic in the built-in browser (Faiz clicked the Terms & Conditions gate once) |

## How the capture works
1. **Resolve the file URL every run** (the document id is per publication, never hard-coded):
   `GET https://fundcentres.landg.com/srp/api/part?id=12618&audience=141&route=4233&version=live&languageId=1&share_class_id=896&fund_id=96` → an HTML fragment containing `"896": [{ name: "Download full fund holdings", url: ".../srp/documents-id/<uuid>/Fundholdings.csv", type: "csv" }]`.
2. **GET that CSV.** Both calls answered **200 with cookies disabled** (no login or accepted-terms session needed by the server).
3. The CSV: metadata lines (`ETF Trading ID`, `Basket Trade Date`), then `Security Description, ISIN, Trading Currency, Constituent Weight (Base)` — weights are **fractions** (0.163 = 16.3%), 44 rows on 2026-09-29, a `Record Count` footer, no country/sector.

## What was built
- `backend/app/providers/lgim_holdings.py` — fetch + parse + convert to a normalized CSV (ISIN / Name / Weight (%) / Currency; percent, so the importer's fraction heuristic is never involved).
  - **Safety:** the resolved URL must be `https` on an L&G host; the file's `ETF Trading ID` must equal the requested ISIN (another fund's basket is refused); `Record Count` must equal the rows parsed (truncation refused); weights must sum to ~100%.
  - **Names:** share-class descriptors are stripped (`NEWMONT CORP USD 1.6` → `NEWMONT CORP`, `… CAD NPV`, `… 1P`) so a fund line can auto-link to the same company held in the app.
  - `KNOWN_FUNDS` registry: `IE00B3CNHG25` → `fund_id` 96 / `share_class_id` 896. Another L&G ETF needs an entry (ids come from its fund page's network traffic); an unknown ISIN is refused with a message saying so.
- `POST /funds/{id}/holdings/fetch-lgim {isin}` — same importer and provenance as Xtrackers/upload (stored as a `fund_holdings` document `lgim-<ISIN>-holdings-<date>.csv`, replaces holding/currency exposure rows, auto-links). Errors surface as 502.
- UI: the Look-through card has an **Issuer** selector (Xtrackers / L&G); the button and ISIN placeholder follow it.
- Tests: `tests/unit/test_lgim_holdings.py` (9) with the real 44-row CSV and a trimmed resolver fragment as fixtures; two integration tests in `test_funds_api.py`.

## Verified vs not
| Verified | Not verified |
|---|---|
| Both calls and the CSV shape, live, through the browser (2026-09-29) | The backend's own `httpx` fetch from Railway or the PC (the build sandbox cannot reach `lgim.com`/`landg.com`) |
| 9 new unit tests + the Xtrackers tests pass; ruff clean; frontend tsc + eslint clean | The 2 new integration tests — the build session's disk was full; CI runs them |
| Weights sum to 100.002% on the real file (cash residual is rounding, clamped to 0) | Whether the document id changes daily (the resolver makes it irrelevant) |

## Notes / risks
- The site says using it implies acceptance of its terms. A once-a-day fetch for personal analysis looks reasonable; Faiz may want to read them himself.
- These are the fund's holdings **with currency only** — no country/sector split (so the fund's sector/country exposure rows stay empty for L&G, unlike Xtrackers).
- Then use **Refresh look-through** as for Xtrackers: it prices each constituent by ISIN (yfinance) — Canadian/Australian/South African listings may resolve less reliably; coverage below 60% keeps the fund "unavailable" with the reason shown.
