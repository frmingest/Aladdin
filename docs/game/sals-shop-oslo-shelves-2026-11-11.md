# Sal's shop: pick an Oslo company from shelves (2026-11-11)

**Status: written on `feature/sals-shop-norway-catalogue`, off `main` at `8e3ddbb`. Written and tested, NOT merged, NOT deployed, NOT run against real Yahoo data (Yahoo is not reachable from the cloud workspace this was built in).** Needs a migration (`a2d3e4f5a6b7`) and the PC worker running.

## What this is for (plain words)

Sal's counter used to be an empty form: you had to know a company's Yahoo symbol (`EQNR.OL`), type it, type the name, pick a currency. Now Sal has **shelves**. Every company on Oslo is on a shelf, sorted into categories, and one tap on a card opens its stall. Typing is only for things that are not on the shelves (other exchanges).

The shelves are filled by a **background job on your PC** (the worker). It asks Yahoo once for every Oslo company, then again once a week, and keeps the list in the database. The pages never call Yahoo themselves.

## What you will see (flat Marketplace and /game3d, the same pop-up)

- Talk to Sal: the pop-up opens on the **shelves**, under a striped awning. Two taps from the Marketplace: *Ask Sal for a stall*, then a card.
- **Shelves** down the left (a swipe strip on a phone), with a game name and the real sector under it: Oil & Power (Energy), Banks & Coin (Financials), Ships & Workshops (Industrials), Food & Fish (Consumer staples), Metals & Earth (Materials), Gadgets & Code (Technology), Shops & Wheels (Consumer discretionary), Healers (Health care), Wires & Waves (Communication), Water & Wind (Utilities), Land & Roofs (Real estate), Odds & Ends (not sorted). Empty shelves are hidden.
- **Size chips:** Any size, Giants (over 50 bn NOK), Big (10 to 50 bn), Small (1 to 10 bn), Tiny (under 1 bn). A company with no market value is **"Size in fog"**: never guessed, never rounded.
- **Search** by name or ticker; Norwegian letters work both ways (typing `orsted` finds Ørsted).
- **Cards** show the size as a stack of coins **and the word**, the ticker, the market value, and *Open the stall*. A company that already has a stall says *On your street* and cannot be opened twice. Biggest first; 48 at a time, *Show more* for the rest.
- A pick opens the stall at once (no confirm step), with the company's **sector already filled in**, then Sal's usual flow: price check, *Send the runners to Newsweb!*, *Enter the store*. *Another stall* takes you back to the shelves.
- If the shelves are empty or cannot be reached, Sal says so and you land in the old typed form. *Not on the shelves? Type a ticker* and *Back to the shelves* switch between the two.
- Demo mode: you can look, not pick.

No Stitch picture is needed: the awning, coins and plank shelves are drawn in code.

## What changed

Backend
- **New table `ticker_catalogue`** (migration `a2d3e4f5a6b7`, additive): ticker, name, currency, Yahoo sector, app sector, market value, active flag, first/last seen. Never deletes: a company Yahoo stops listing is marked inactive.
- `app/providers/yfinance_catalogue.py`: yfinance screener, `exchange = OSL`, **one query per Yahoo sector** (so each company's sector is reliable) plus one unfiltered pass for companies with no sector (they arrive unsorted, not guessed). Pages of 250, one retry, a pause between calls.
- `app/services/ticker_catalogue.py`: refresh rules. An empty fetch changes nothing; a known sector or value is never overwritten by "missing"; a company is retired only after a **complete** fetch that still returned at least 60% of what was there.
- `app/domain/ticker_catalogue.py` (`catalogue-v1`): Yahoo sector to the app's sector list, and the size bands. Plain code, no LLM.
- **Worker job** "Oslo ticker catalogue" (`maybe_refresh_ticker_catalogue`): at first start (empty table), then every `TICKER_CATALOGUE_REFRESH_HOURS` (default 168). A failed pass is retried after `TICKER_CATALOGUE_RETRY_SECONDS` (default 3600), never on every poll. Off with `TICKER_CATALOGUE_ENABLED=false`.
- **System status page** gets a row for it (ok, overdue, last pass had a problem, off).
- `GET /catalogue`: read only, database only, also served in demo mode.

Frontend
- `lib/salShop.ts` (grouping, filtering, search, wording), `SalesShop.tsx` + `shop.css`, and `SalesRepDialog.tsx` now opens on the shelves. `api.getCatalogue()`.
- Keystrokes inside the pop-up no longer reach the 3D world (A walks, M toggles sound, Q/T/G open panels), so typing in the search box after tapping a shelf chip is safe. Escape and Ctrl/Cmd combos still pass.

Tests: tests env switches the catalogue job off by default (`tests/conftest.py`) so no test can reach Yahoo.

## How it was checked

- Backend: ruff clean, 2,087 tests pass (50 new unit tests in `tests/unit/test_ticker_catalogue.py` against a fake screener, 4 API tests), migration up, down, up on SQLite.
- Frontend: tsc clean, ESLint 0 errors, vitest, production build (numbers in the PR).
- **Real Chrome click-through against a mocked API** (flat Marketplace, desktop and 390 px phone): shelves, size chips, search, one-tap open (the request carried ticker, name, NOK and the sector), *Another stall* back to the shelves, a company already on the street disabled, empty shelves and unreachable shelves fall back to the typed form, demo mode disabled, Escape closes, letters typed after tapping a chip never reach the window.

## Not checked

- **Real Yahoo.** The screener query is built and validated by yfinance offline, but the cloud workspace cannot reach Yahoo, so the first real run is on your PC. If a sector comes back empty or the exchange code is wrong, the job reports it as a problem on the System status page and the shelves stay as they were.
- **Walking up to Sal's counter in /game3d.** The 3D pop-up is the same component (`voice="game"`), and its first paint and the hotkey guard are tested, but nobody walked the Market Quarter in a browser.
- The shelf sizes and sectors in the screenshots were sample data, not Oslo facts.
- Market values come from Yahoo in the trading currency. Only NOK values get a size band.

## For Faiz after merge and deploy

1. Railway runs the migration. Then start the PC worker (it must have the market data provider on: `MARKET_DATA_PROVIDER=yfinance`).
2. System status page: **Oslo ticker catalogue** should turn green within a few minutes (the first pass takes about a minute: twelve queries with pauses).
3. Open Sal's counter: shelves should list roughly the Oslo companies. Tell me if a shelf looks wrong (sector names come from Yahoo) or a size looks off.
4. If the row says *Last pass had a problem*, the text names the sector that failed; send it to me.

## Decisions for you

- **One tap opens the stall** (a stall is easy to remove, and the old flow needed a second "confirm"). Say if you would rather have a confirm step.
- **Size bands (50 / 10 / 1 bn NOK)** live in `app/domain/ticker_catalogue.py` and are mirrored in the chip hints; say if you want other cut-offs.
- Not built: a "restock now" button (the worker refreshes weekly), categories by industry (Yahoo's finer level, many more queries), a Sal counter sign in 3D that shows how many stalls are on the shelves.
