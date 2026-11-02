# 3D courtyard S17: the siege yard, per-holding results in the Storm Drill (2026-11-02)

**Status: written; `tsc`, `npm run lint` (the same 2 old warnings), `npm test` (150 files, 1248 tests), and `npm run build` pass; not clicked through in a browser; not merged until you merge the PR, not deployed, not seen on real data.** Branch `feature/game3d-siege-yard`, off `main` at `cc9890e` (S16 is fully merged: #248, #249, #250).

## What a sprint is for (plain words)

The Storm Drill already let you pick a market fall and write what you would do. What it could not show was the part you need to decide well: **which towers that fall hurts, and by how much.** That lived only on the flat Siege Simulator. This step puts the answer in the drill panel, so you see the damage first and then write your plan.

## What you will see

- Move the fall slider in the drill panel: under it, **"What the fall does"** counts the damage again (a short pause while you drag).
- A headline sentence and the level (the flat page's own words), then four numbers for the whole book: the fall it suffers, the what-if loss, the weighted beta and how much of the book was counted.
- **The worst-hit towers first**, up to eight: name (a link to its holding page), the share lost and the kroner lost, a wall that fills with the loss, and one word (Sheltered, Exposed, Wall at risk of breach, or Gains). "Rough guide" and "Differs from the stress case" show where the flat page shows them. More than eight: the panel says how many more sit on the flat page.
- **Fog over towers that could not be modelled**: each is listed with a "?" and the backend's own reason. They are left out of the total and never given a made-up number.
- The camp stays a fixed size, as decided on 2026-10-31: no model grows with the fall.
- If the count cannot be read, the panel says so in one line and the plan can still be written.

## How it works (short)

- `siegeYard.ts` (pure): turns the answer of `GET /game/siege` (the same call the flat page makes, with the same yardstick choice from the same browser storage key) into rows, fog and book figures. **No number or sentence is worked out here**: every figure and sentence comes from the flat page's helpers (`formatShock`, `formatNok`, `rowStatus`, `holdingLine`, `headline`, `coverageLine`, `isRoughGuide`, `stressGapNote`).
- `useSiegeYard.ts`: debounced read, the newest answer wins, a failure is a state, not a crash. `SiegeYardResults.tsx`: the block. `DrillPanel.tsx` mounts it (the old one-line link to the flat page moved into the block). `siegeYardWordsV1.ts`: new words in a version-1 file.
- 10 new tests (`siegeYard.test.tsx`): every figure and sentence equals what the flat helpers give for the same data; worst first; cap and "more" count; fog with reason and no number; no book figures when nothing could be modelled; empty book; failed read; no buy or sell words and no red or green.
- No backend change, no migration, no new endpoint.

## Game sprint checklist

Pages touched: `/game3d` only (the Storm Drill panel); no flat page changed. Identity stays 3 (verb *besiege*, scene the siege camp, fact: which towers a fall reaches). Words: short, in a version-1 file; the flat page's own for everything numeric. Colour-blind: every row carries the number and a word; the wall is gold, never red or green. Reduced motion: nothing moves. Taps: the answer appears with no extra tap after E at the post.

## Open list for you

- Try it in `/game3d`: E at the drill post, drag the fall, read the rows. Tell me if eight rows is too many for the panel, or a word is off.
- Not clicked through in a browser yet, and not tried on a phone width.
- Siege tower and ram stay skipped (neither KayKit nor Kenney has them).
