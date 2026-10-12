# Siege Simulator: a beta for every instrument (2026-10-07)

Branch `feature/siege-instrument-sensitivity`. Status: **written and tested, not merged, not deployed, not run on real holdings.**

## The problem

`/fortress/siege` showed "Cannot judge yet": only 0.2% of the portfolio value had a stored beta, and 50% is needed. Salmon Evolution was the only tower with a number.

Root causes, from the code and from `computed_snapshots` on Supabase (22 `beta:*` rows, none for the six missing holdings):

1. Beta came only from Yahoo's `info["beta"]`, which is normally empty for funds, ETFs and metal ETCs (4GLD, ETLX, Heimdal Utbytte N, Alfred Berg, XDEF). Those hold almost all of the book's value.
2. Even for a stock, the beta was only fetched as a by-product of the DCF. Vår Energi's valuation stops early ("owner earnings volatile, median not positive") before it reaches the beta step, so Refresh never stored one.
3. The worker's warm-up only visits holdings with no price at all.
4. Yahoo's beta is measured against the S&P 500, not the market a Norwegian book is exposed to.

## What changed

- **Method (`siege_scenarios_v2.py`, new version file; v1 untouched in value):** every holding gets a beta measured the same way from data the app already stores: its own daily closes, converted to NOK, against OSEBX, using only the days OSEBX fell. Arithmetic is in `services/game/sensitivity.py` (pure, Decimal). A gold ETC can come out near zero or negative; that is the point.
- **Confidence per row:** number of fall days used, R-squared, and a caution when the fit is weak (R-squared under 0.10) or when 30% or more of daily prices did not change (a slowly updating NAV reads too low).
- **Fallback:** Yahoo's beta only where price history is too short (under 120 aligned days or 40 fall days), marked "from Yahoo" with the reason. A holding with neither stays "not modelled", with its own reason. Nothing is defaulted.
- **Data:** a new worker job (`services/risk/sensitivity_history.py`, every 6 h, cheap when stored history is fresh) stores 730 days of history for every holding you own, the benchmark and the FX pairs. The Risk and Performance pages only stored stocks. The page itself stays database-only: no provider call, no write.
- **UI:** each row says where its beta came from and how well it fits; each unmodelled holding lists its own reason (the old "open the holding once" advice was wrong for funds). New job row on the Background jobs card.
- `active_siege_scenarios_version` is now `v2`. Setting it back to `v1` restores the old vendor-beta-only behaviour.

## Limits (stated on the page or here)

- Norwegian funds price once a day at NAV and lag the market, so their measured beta tends to read too low; the row carries a caution when the data shows it.
- Returns are daily; a fall of "the market" means a fall of OSEBX. A global ETF (XDEF) is understated by an OSEBX benchmark. A global benchmark option is a later decision.
- It is a what-if from past down days, not a forecast.

## Verified

`ruff check .`, `pytest -q` (1750 passed, 2 skipped), `tsc --noEmit`, `npm run lint` (2 existing warnings), `npm test` (331), `npm run build`. New tests: `test_game_sensitivity.py`, `test_sensitivity_history.py`, `test_game_siege_v2_api.py`, plus the job-status and worker tests extended for the new job. Not checked against real holdings or the live site.

## After deploy (Faiz)

1. `git pull` in `E:\Aladdin`, restart backend and worker.
2. Wait for the worker's first pass; More, System, System status shows "Siege Simulator price history" with a summary. Tickers Yahoo cannot serve (some Norwegian fund codes) are listed there with the reason.
3. Reload `/fortress/siege`. Tell me which towers are still grey and the reason shown, and whether any number looks wrong against what you know.
