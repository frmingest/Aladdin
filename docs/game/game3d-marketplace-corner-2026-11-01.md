# 3D courtyard: the marketplace corner (2026-11-01)

Status: **written and tested, in PR `feature/game3d-marketplace-corner`; not merged, not deployed, seen only in a headless browser (software WebGL, empty sample fortress), not on your real data or a real GPU.** Source: [free assets note](game3d-marketplace-free-assets-2026-11-01.md) (suggested first step) and the marketplace ground held back by the spread-layout PR #231.

## What this is for (plain words)
You asked for the next sprint items with the biggest visual change. After the castle, the biggest bare patch left was the south-east of the courtyard: open cobbles held empty for "the marketplace". It is now a small market square: a blue-awning stall with crates of produce, a well, a canopy, two laid tables (food and bottles), stacked crates, a decorated keg, barrels, and a blue and a yellow flag at the two ends. It is **decoration only**. It shows no price and says nothing about any holding; whether a price is in range stays on the flat Market Street page.

## What changed
| Part | Before | After |
|---|---|---|
| South-east ground (about x 20, z 14) | empty, reserved | 9 KayKit pieces (`marketPieces.ts`), solid colliders (boxes for the stall, tables, keg and barrels; circles for the well, canopy, crates, stool) |
| Flags | none there | `market-flag-n` (blue) and `market-flag-s` (yellow) added to `sceneryPieces.ts` (existing `scenery.glb`) |
| Reserved zones | marketplace and siege simulator | **only the siege simulator**; the marketplace entry was deleted in this change, as `layout.ts` says to |
| If `market.glb` fails | n/a | the corner is open ground again; checked by blocking the file (page loads, one console warning, flags stay) |

Files: `frontend/public/models/market.glb` (0.74 MB, 11 pieces, 9 placed), `scripts/pack-market.mjs`, `frontend/src/game3d/{marketPieces.ts,Market.tsx,marketPieces.test.ts}`, `Scene.tsx` (mounts `<Market />`), `layout.ts` and tests, credits rows in `public/models/CREDITS.md`. No new licence: Hexagon and Dungeon Remastered were already in use.

## Rules kept
- **Truth:** no piece carries a fact; nothing depends on a holding. Red and green pieces are not used (a test checks model names). The produce crates on the stall have small red and yellow fruit baked into the texture; that is not a status colour and the model is not a flag or banner.
- **Reduced motion:** nothing moves.
- **Colliders:** the hero walks round everything; the middle of the square stays open (test: at least 1.5 from every real footprint).

## Checklist section B
1. **Pages touched:** `/game3d` only. No flat Game mode page.
2. **Identity:** stays 3 or better; a visible destination in the south-east.
3. **Visual win:** *a market square, not empty cobbles*. No new words.
4. **Performance:** one 0.74 MB file loaded with the scene, 9 pieces plus 2 flags (not instanced; about 11 extra draw-call groups). **15 MB first-load and 300 draw-call budgets not re-measured** (software rendering); press P on your machine.
5. **Taps:** unchanged.
6. **Checks run:** `tsc`, `npm run lint` (2 old warnings), `npm test` (121 files, 1046 tests), `npm run build`: green. Backend untouched.
7. **Seen:** spawn view, close view from the well side, bird's-eye view, blocked-file fallback. **Not seen:** a real GPU, your data, a phone.

## For Faiz after deploy
Open `/game3d`, look to the right of the quest board from the spawn: the stall, well and tables. Press P and check 60 fps. If it costs frames, say so and the small pieces go first.

## Not done
- The Storm Drill camp (S10) still waits for the Storm Drill quest.
- `stall_table_plain` and `crate_long_A` are packed but unused (cut line).
- Optional later: code-drawn pennants on the stall showing a real "price in range" fact, following the flat Market Street rules. Not started; needs your call.

## Git commit description
`3D courtyard: marketplace corner (KayKit stall, well, canopy, tables, crates, barrels, flags; CC0), colliders, plain fallback if the file fails; marketplace reserved zone removed`
