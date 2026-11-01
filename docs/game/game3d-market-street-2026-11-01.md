# 3D courtyard S14 (M1 and M2): Market Street, one stall per watchlist company (2026-11-01)

**Status: written, not checked on this machine (see below), not merged, not deployed, never seen in a browser.** Branch `feature/game3d-market-street`, off `main` after S13 (#241) and S9 (#239).

## What a sprint is for (plain words)

The flat Marketplace tells you which companies you are watching sit near the price you named. In 3D that was only a decorated corner that said nothing. This first slice of S14 puts a stall on the ground for each watchlist company, with a flag and a little plate that say the same thing the flat page says.

## What you will see

- Up to **seven stalls** on the south-east ground, between the gate road and the old market corner, in the **same order as the flat Marketplace** (in range first, then nearest to your price, then by name).
- Each stall has a **flag on a pole**. The flag's shape tells the tone (two flags: in range, one long: near, one short: above, none: no price). Colour only helps; no red, no green.
- A **plate in front** prints the company name, the flat page's short word ("In range", "Near", "Above", "No price") and the signed gap ("+4%").
- No watchlist, or it can't be read: no stalls, nothing extra loads. If the town market file fails to load, the ground is open again.
- More than seven companies: the extra ones have no stand (the "N more" line is written but not shown yet; the Store panel and Sal come in M3 and M4).

## Files

- `game3d/streetPlan.ts` (+ `streetPlan.test.ts`): plots, `buildStreet(rows)`, `plateWords`. Pure. Reuses `orderStreet`, `shopFront`, `TONE_FLAG` and `gapLabel` from the flat page so the two cannot drift. Named `streetPlan` because `marketStreet.ts` would clash on case with `MarketStreet.tsx` on Windows.
- `game3d/MarketStreet.tsx`: draws the stalls from `town-market.glb` (S9), the flag and the plate. Lazy, boundary-guarded, no colliders beyond a stall footprint.
- `Scene.tsx` (a `stalls` prop) and `pages/Game3DPage.tsx` (reads the watchlist; a failed read means no stalls).

## M3: step into a store (branch `feature/game3d-market-store`, not run, not merged)

Walk up to a stall (within 3.4 units; it lets go at 4.6) and a prompt says "Press E to step into <name>'s store". E opens that company's store in the world panel. It is the flat store page itself (`/fortress/marketplace/:holdingId`, framed with `?embed=world`), so the eight gates, the price board and Name your price are the same code as the flat route and nothing is copied. If there are more companies than plots the prompt adds the overflow line. Esc backs out to the Where to? menu, then closes it.

- `game3d/stallDoor.ts` (+ `stallDoor.test.ts`): `nearestStall`, `storeDoor` (built from the parity register's store row), `stallPrompt`. Pure.
- `Scene.tsx`: `NearStallWatch`, `onNearStall`. `Game3DPage.tsx`: `nearStall`, `openStore`, the E key and the prompt.

## Game sprint checklist

Pages touched: `/game3d` only. Identity: stays 3 (visual verb *browse*, scene Market Street). Words: reuse the flat page's words, no new strings except the overflow line. Fact pieces are code-built; the stall model carries nothing. Kit reused: `Market.tsx` loader pattern, `Inked` parts, the signboard canvas idea from `TowerMesh`. Cut line: the second row of plots, then the plates' fog lane.

## Not done yet (next steps of S14)

- M4: Sal the Sales Rep and the Hype Booth.
- The fog lane for unpriced stalls (today they stand in order with a bare pole).
- A look-and-judge screenshot and measured taps; placement was checked by a test and a script, not by eye.
- Seven plots only, because the south-east is crowded: more companies would need a second area.
