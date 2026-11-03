# 3D S26 PR 1: the ladder, the stream and the theme readout (2026-11-03)

**Status: written and tested (tsc, lint, 1521 frontend tests, build). The ladder picture below was rendered in headless Chrome with software graphics (placeholder blocks only, not the game). The land itself was NOT looked at in a browser; not merged, not deployed.** Plan: [S26 sprint plan](game3d-s26-dressings-sprint-plan-2026-11-03.md), section "PR 1". Builds on S25 PR 3 (#280).

## What you will see

Nothing new in a land yet, on purpose. Every theme still has no dressing, so each land keeps S25's own tower. What this PR adds is the rulebook and the slot the dressings (PR 2 to PR 5) plug into:

- **The ladder.** Wall tier gives one of five rungs (Sound, Solid, Worn, Patched, Failing) as numbers: lean, gaps, props, broken props, loose boards, fallen pieces, patches, a crack, and how proud the finish is. Not surveyed is a **ghost**, no walls is **neutral**; neither is a rung, and neutral is not Sound.
- **The stream.** Moat tier gives wide water, narrow water, a dry stony bed, a mist band with a "?", or no band.
- **The centre slot** takes { theme, condition, stream }. Ghost and neutral are chosen once, before any dressing, so no dressing has to draw them.
- **The picture:** [game3d-s26-ladder-2026-11-03.png](game3d-s26-ladder-2026-11-03.png): one placeholder block at Sound, Solid, Worn, Patched, Failing, then Ghost and Neutral; under it the five stream looks (wide, narrow, none, mist, absent). Software render, so the look of the real light and sky is untested. The wide band is clipped at the left by the picture's camera.

**Visual verb + scene:** *visit the holding's workplace.* Facts encoded: wall tier (condition) and moat tier (stream), as shape, lean and rubble, never colour.

## Truth rules kept

- Condition from the wall tier only; stream from the moat tier only; theme from the sector only. `landCondition(wall)` and `landStream(moat)` take one argument each.
- Unknown stays fog: an unread wall is a ghost, an unread moat is mist, never a middle grade or clear water.
- No red or green: the ladder is numbers only; the stream tints are water blue, stone grey and mist white (a test checks them).
- Reduced motion: nothing here moves.
- Budgets: the placeholder block is at most about 25 small meshes and the stream band one flat shared material plus 14 small stones; not measured in a browser (press P in a land once a dressing exists).

## Code

- `game3d/landCondition.ts`, `landStream.ts`, `landCentre.ts` (pure, tested).
- `game3d/LandCentre.tsx` (the slot), `LandBlock.tsx` (placeholder at any rung, ghost, neutral), `StreamBand.tsx` (one shared material), `LandLadder.tsx` (the picture).
- `HoldingLand.tsx`, `Scene.tsx`, `Game3DPage.tsx`: the centre now carries the slot; the page calls `holdingTheme3d` through `centreSlotFor`.
- `DRESSING_BUILT` in `landCentre.ts` is the switch each dressing PR flips.

## Theme readout (demo holdings, same call the page uses)

| Holding | Sector | Theme |
|---|---|---|
| Apple Inc. | Technology | plain |
| Microsoft Corporation | Technology | plain |
| Alphabet Inc. Class A | Technology | plain |
| Johnson & Johnson | Health Care | plain |
| Procter & Gamble Co. | Consumer Staples | stall |
| Coca-Cola Co. | Consumer Staples | farm |
| JPMorgan Chase & Co. | Financials | bank |
| Visa Inc. Class A | Financials | bank |
| Home Depot Inc. | Consumer Discretionary | stall |
| Exxon Mobil Corp. | Energy | windmill |

This is the fabricated demo portfolio. **The real readout for Faiz's own holdings needs his live data and was not run**; `themeReadoutTable` in `landCentre.ts` prints it from any list of towers, and the test shows how. S26 covers mill, farm, fountain and mine, so of the demo set only Exxon (windmill) and Coca-Cola (farm) would change in this sprint; stall and bank wait for S27.

## Not done / for Faiz

- No dressing is placed yet (PR 2 to PR 5).
- Live-holding readout (needs real data); land not opened in a browser; draw calls and triangles not measured.
- Words: no new player-facing string in this PR (only the "?" mark on the mist band and ladder labels in the picture).
