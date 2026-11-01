# 3D courtyard: the keep and the four corner towers as real models (2026-11-01)

Status: **written and tested, in PR `feature/game3d-keep-and-towers`; not merged, not deployed, seen only in a headless browser (software WebGL, mocked empty fortress), not on your real data.** Plan source: [KayKit plan, S7](game3d-kaykit-sprint-plan-2026-10-31.md) and the "not done" note in [horizon](game3d-horizon-2026-10-31.md).

## What this is for (plain words)
You asked for the next sprint items with the biggest visual change. The biggest thing you see on every visit is the skyline of the courtyard itself: a grey box with a red cone (the keep) and four grey drums (the corner towers). They are now a real castle with a wooden door, windows and blue banners, and four stone towers with a balcony on top. Nothing about your holdings changes: **the eight holding towers stay code-built** because they show real data.

## What changed
| Part | Before | After |
|---|---|---|
| Keep | plain box and cone, 16 by 12 | KayKit `building_castle_blue`, scale 5.6 (11.1 wide, 12.7 deep, 22 tall), south face still on the old face so the door torches and banners still line up |
| Corner towers | four cylinders with a red cone | KayKit `building_tower_B_blue`, scale 4.8 (12 tall), turned to face the middle |
| Colliders | one box and four cylinders | a box and four cylinders that match the new shapes (the keep box is narrower than before, so you can walk closer to its sides) |
| Banners at the keep | at x +-4.8 and +-6.6 | moved in to +-3.9 and +-5.1 so they hang on the narrower castle |
| Fallback | n/a | if `keep.glb` fails to load (or while it loads), the old plain shapes are drawn, exactly as before; checked by blocking the file |

Files: `frontend/public/models/keep.glb` (0.47 MB), `scripts/pack-keep.mjs`, `frontend/src/game3d/{keepModels.ts,KeepModels.tsx,keepModels.test.ts}`, `Courtyard.tsx`, `sceneryPieces.ts`, credits row in `public/models/CREDITS.md`. `KEEP` in `layout.ts` is unchanged on purpose (the other tests use it as a conservative clearance).

## Checklist section B
1. **Pages touched:** `/game3d` only (courtyard shell). No flat Game mode page changes.
2. **Identity:** `/game3d` stays 3 or better; the courtyard now reads as a castle.
3. **Visual win:** *a castle, not a box*. Voice: no new words.
4. **Rules:** truth: the keep and towers carry no fact. Colour: blue set only, no red or green. Reduced motion: nothing moves. Performance: one 0.47 MB file; **draw calls and the 15 MB first-load budget not re-measured here** (software rendering); check P stats on your machine.
5. **Taps:** unchanged.
6. **Checks run:** `tsc`, `npm run lint` (2 old warnings in `demoMode.tsx` and `gameMode.tsx`), `npm test` (119 files, 1035 tests), `npm run build`: green. Backend untouched, not run.
7. **Seen:** spawn view and the view from the fountain, plus the blocked-file fallback. **Not seen:** a real GPU, your data, a phone.

## For Faiz after deploy
Open `/game3d`: the castle at the north end with its door, a torch each side and blue banners; four towers on the wall. Press P for the frame rate (target 60). If you dislike the castle, the old box comes back with one revert.

## Not done (needs your call)
**The drill camp (KayKit S10)** is not built: there is no Storm Drill quest yet to switch it on, and a camp that is always there would make a calm fortress look besieged. Next step is the Storm Drill quest and its camp together.

## Git commit description
`3D courtyard: keep and four corner towers as KayKit models (CC0), colliders matched, plain-shape fallback if the file fails`
