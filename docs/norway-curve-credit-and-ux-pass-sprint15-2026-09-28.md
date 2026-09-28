# Sprint 15 #4 — Norway yield curve / credit spread, plus a UX pass (2026-09-28)

Branch `feature/norway-curve-credit-ux`. **Written and tested. Not merged, not deployed, not checked live.**

## 1. Norway yield curve and credit spread

### What was investigated

| Candidate | Result |
|---|---|
| Norges Bank `GOVT_GENERIC_RATES` | ✅ Free. 3M/6M/12M T-bills and 3Y/5Y/7Y/10Y government bonds. We already fetched the 3M bill and the 10Y bond, so a curve needs **no new fetch**. Confirmed via WebFetch; the build sandbox and Faiz's PC shell both get 403 from the proxy on `data.norges-bank.no`, so nothing was fetched directly |
| Norges Bank `SHORT_RATES` (looking for NIBOR) | ❌ Only NOWA series; no NIBOR |
| Norwegian corporate credit spread (Norges Bank, SSB, FRED) | ❌ **No free daily source found.** FRED only carries BIS credit *volumes* (credit to non-financial corporations), not spreads |
| Nordic bond indices (iBoxx, Nordic Bond Pricing) | Paid / not investigated further |

**Conclusion:** the curve leg can be Norwegian; the credit leg cannot, for free. The regime keeps US high-yield OAS as its credit signal, and the UI now says so plainly.

### What was built

- **Catalogue `v2`** (`app/domain/macro_series.py`): same fetched series as `v1`, plus derived indicator `no_curve_10y_3m` (10Y bond minus 3M bill). `active_macro_series_version` now defaults to `v2` (CLAUDE.md Rule 3: `v1` untouched).
- **Regime** (`app/services/risk/regime.py`): new `RegimeResult.norway_curve_pp` (3-month-smoothed 10Y minus 3-month-smoothed bill) and a `no_curve_10y_3m` row in `inputs`.
- **Informational only, not a trigger.** Norway's 3M bill sits on a ~4.5–4.8% policy rate while the 10Y is ~4.4%, so the curve is inverted for reasons the US-calibrated (≤ 0 pp) stagflation threshold was never sized for. Making it a trigger would change regime output (and the regime-adjusted DCF, if enabled) without a calibration. **Decision for Faiz:** whether to calibrate a Norway threshold after watching a few months of the series.
- Portfolio risk page note reworded; no schema, no migration.

### Tests

3 new regime tests (smoothed difference shown; inverted curve alone never triggers; missing leg → `None`), 1 new catalogue test, macro API test updated to `v2`.

## 2. UX pass

No general UX-designer skill is installed (the only one is CWO-specific, which Faiz excluded), so this used standard heuristics (Nielsen's visibility/error-prevention/recognition, WCAG keyboard and focus) plus the `dataviz` skill's guidance. Code-based review only: **not looked at in a browser**, since the live app needs the API key.

| Finding | Fix |
|---|---|
| Reaching one company took sidebar → Holdings → scan table | **Quick search** (Ctrl/⌘+K or "Search…" in the nav): pages + holdings by name or ticker, arrow keys + Enter |
| Every browser tab was titled just "Aladdin" | Per-page tab titles; holding pages show the ticker |
| Sidebar showed nothing active on a holding page (`end` matching) | Parent nav item now stays highlighted |
| Holding page is ~8 sections long, one scroll | Sticky **"On this page"** chips; jumping to a collapsed section opens it |
| **Delete holding** sat beside Watch in the page header (error-prone) | Moved to a "Delete this holding" card at the very bottom; same confirm dialog |
| No keyboard focus indicator; no skip link | Global `:focus-visible` ring; "Skip to content" link |

### Not done (candidates)

Dashboard density, table sorting/filter persistence, chart palette audit against `dataviz`, empty-state consistency, extending the "i" tooltips to remaining pages. A browser-based visual review is still owed.

## 3. Verification

Backend 1017 total, 1015 pass; the 2 failures are the same pre-existing, unrelated ones as on `main`. `ruff` clean. Frontend `tsc` 0 errors, `eslint` 0 errors (2 pre-existing warnings), vitest 22/22, `npm run build` clean.
