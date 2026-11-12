# Demo mode shows seven random watchlist stocks (issue #404, 2026-11-12)

Written, not yet deployed.

## What changed
Demo mode used to show ten fixed, invented US stocks. Now, when it is switched on, it picks **seven stocks at random from the watchlist** and shows those on every page.

- **Real:** only the ticker, company name and sector of each pick.
- **Invented:** every number (accounts, quantities, prices, valuations, verdicts, tripwires, risk, journal). They are derived from the ticker, so the same ticker always gets the same figures. Real holdings, positions and analyses are still never read.
- **Picked once:** the seven are drawn when demo mode goes from off to on and stay until it is switched off and on again. Switching on while already on keeps them.
- **Short watchlist:** fewer than seven watched stocks are topped up from the old invented stocks, so the demo is always a full portfolio. An empty watchlist (the e2e test stack) shows the first seven old stocks, the same every run.

## Where
- `app/services/settings/demo_mode.py`: draws the picks on enable and stores them as `app_settings` rows `demo_pick_0..6` (`TICKER|name|sector`). No migration. They are deleted when demo mode is switched off.
- `app/services/settings/synthetic_data.py`: the demo portfolio is built from the picks (`set_demo_universe`); `is_demo_mode` keeps it in step with the stored picks on every demo request.
- `app/services/game/demo.py`: the invented tower facts (walls, shocks, tripwires, betas) now hang on the stock's position 0-6 instead of a ticker, so the game demo still shows every kind of tower whatever the picks are.
- The demo journal and risk cluster use the first three picks instead of AAPL/MSFT/XOM.

## Known limits
- Demo prices are all labelled USD, even for a Norwegian ticker.
- The demo Watchlist page still shows its two fixed invented names (NVDA, COST), not the picks.
- Demo mode already switched on before this change has no stored picks, so it shows the first seven old stocks until it is switched off and on once.
