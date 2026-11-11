# 3D fix: live prices and no stock booths in the courtyard (2026-11-11)

**Status: written, tested (tsc, lint, vitest, build), not deployed, not seen in a browser.** Branch `fix/game3d-live-watchlist-and-courtyard-booths`.

## What Faiz saw

1. He saved a price for Aker Solutions in its store page, left and re-entered the Market Quarter, and the stall still stood under "No price yet".
2. Two market places existed: the courtyard's Market Street (eight stock booths) and the Market Quarter you teleport to.

## Cause and change

1. `Game3DPage` read the watchlist once, on load. A price saved in a store page (opened over the world) changed the data behind the world's back, and nothing read it again. Now the page re-reads the watchlist when a store page closes or goes back, and whenever you change place (`refreshWatchlist`). A failed read keeps what is shown.
2. The courtyard no longer draws or listens for stock booths (`MarketStreet` and its near targets are out of `Scene`). The arch to the Market Quarter, Sal's counter, the Hype Booth and the market decor stay. The Market Quarter is unchanged. `streetPlan.ts` stays: the quarter reuses `toStall`, and the plot lists are still pinned by tests as clear ground.

## Not checked

Not seen in a browser. A price saved in the Where-to panel's store page only shows in the world once the page closes or you go back; it is not live while the page is open.
