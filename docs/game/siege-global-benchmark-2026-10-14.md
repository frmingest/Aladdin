# Siege Simulator: a World yardstick next to Oslo (2026-10-14)

Branch `feature/siege-global-benchmark`. Status: **written and tested, PR open, not merged, not deployed, not run on real holdings.**

## What it is for

The Siege page asks "if the market falls X%, what happens to each tower?". Until now "the market" always meant OSEBX, the Oslo index. That is right for Norwegian stocks and wrong for a world fund such as XDEF: on a global sell-off OSEBX understates how far it falls (noted in the [instrument-sensitivity doc](siege-instrument-sensitivity-2026-10-07.md)). Faiz decided on 2026-10-14: add a global option, keep OSEBX for Norwegian stocks.

## What changed

- **A toggle on the page, "Measured against: Oslo | World".** Oslo stays the default, so nothing changes until you press World. The choice is remembered in this browser only. Nothing is blended: one yardstick at a time.
- **The World yardstick is ACWI**, the iShares MSCI ACWI fund (about 2,500 stocks, developed and emerging markets). It is a *stand-in* for a world index, not the index, and the page says so. It is listed in USD, so its prices are converted to NOK with the same stored USD/NOK history that converts holdings; both sides of the comparison are then what a Norwegian saver experiences, currency moves included.
- **Wording follows the choice:** "Market falls by" becomes "World stocks fall by"; the headline reads "A 30% fall in world stocks costs the modelled book ...".
- **Same method, same thresholds.** Downside beta over the benchmark's down days, 730-day window, at least 120 aligned days and 40 down days, weak-fit and flat-price cautions: all as in v2/v3.
- **New scenarios file `siege_scenarios_v4.py`** (CLAUDE.md Rule 3: v3 is untouched). `active_siege_scenarios_version` is now `v4`; setting it back to `v3` removes the toggle and restores the old behaviour exactly.
- **API:** `GET /game/siege?benchmark=local|global` (default `local`; anything else is a 422). The response gains `benchmark_key`, `benchmark_label` and `benchmark_options`. Still database only: no provider call, no write.
- **Worker:** the existing price-history job now also stores ACWI and USD/NOK, so the World view works without a live call. Until the worker has run once after deploy, World shows each tower as "not modelled" with the reason ("no price history stored for the benchmark ACWI" or "no USD/NOK history stored ...").

## Art (added the same day)

Faiz's Stitch picture "Siege global" (a stone lookout tower on a rocky coast, a faint globe on the horizon) is the World banner. Packed as `backdrop-siege-world` (960x536 WebP, 22 KB, pack mode `none`); the master now lives in the git-ignored `art-masters/Design_master/siege_global_world/` (it was in `frontend/public/art/Siege global/`, which must stay empty of images). It shows in a short strip above the Oslo | World toggle, **only while World is selected and Game mode (Object art) is on**; it carries no fact, has empty alt text, is lazy-loaded and disappears if it fails to load. New component `SiegeWorldBanner`. Art budget: set now about 2,400 KB of 2,800; backdrop cap raised from 5 to 6 in `artAssets.test.ts` with the reason in the comment. Tests: 2 new (draws nothing with art off; the picture is packed and decorative); `vitest` 786 passed, build green. Not looked at in a browser: judge the crop (the tower sits left, the globe right) on the live page.

## Limits (also on the page)

- Norwegian stocks usually read *lower* against the world than against Oslo, and a world fund *higher*. Both views are right for their own question.
- ACWI is US-listed and trades on US hours, so day-to-day alignment with Oslo-listed holdings is a little looser than OSEBX; the Fit figure on each row shows how well it explains the holding's moves.
- The back-test card below the table always uses Oslo (its "worst fall" is OSEBX's). The page says so when World is selected.
- Same caveat as before: a what-if from past down days, not a forecast.

## Verified

Cloud copy of the branch (the PC's Linux helper had no disk space): `ruff check .` clean; `pytest -q` 1934 passed, 2 skipped (10 new in `test_game_siege_global_benchmark.py`: default stays Oslo, the two betas differ as they should, World needs no Oslo history, USD to NOK conversion counts, missing USD/NOK and missing ACWI name their reason, unknown choice is refused, the worker stores ACWI and the dollar rate, v3 has no World option); frontend `tsc --noEmit`, `eslint` on the changed files, `vitest` 784 passed (4 new), `npm run build`. **Not** checked in a browser and not against real holdings.

## After deploy (Faiz)

1. Merge the PR. Railway redeploys; no migration.
2. Restart the worker on the PC (or wait for its next pass): More, System status, "Siege Simulator price history" should now list ACWI and USDNOK=X.
3. Open the Siege Simulator, press World. Tell me if the funds (XDEF, ETLX) now read higher than under Oslo and the Norwegian stocks lower; that is the expected direction. If a row says "not modelled", the reason on that row names what is missing.
