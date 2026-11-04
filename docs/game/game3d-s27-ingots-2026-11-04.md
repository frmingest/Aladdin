# 3D S27 (A1): the gold bullion vault (2026-11-04)

**Status: written and tested on `feature/game3d-asset-plan-ingots`, off `main` at `2ad6fb6`. `tsc`, lint (0 errors), the full test run (1,644) and the build pass locally. Not seen in a browser, no fps, not merged, not deployed.** Plan: [asset sprint plan](game3d-asset-sprint-plan-2026-11-04.md).

## What you will see

A holding whose theme is `ingots` (physical gold, the bullion structure) now stands as its own building, in the meadow and in its land: a gold chest in the middle, a pallet with a large gold stack, a medium gold stack, a silver stack and two coin stacks, inside a ring of six low barred barriers, with the usual stream band outside. The barriers wear the wall ladder the same way the fountain's columns do: upright and footed on Sound, leaning and gapped on Worn, props and loose boards on Patched, fallen pieces, a crack and broken props on Failing. Unsurveyed walls show the pale ghost. "Not applicable" (bullion has no balance sheet) draws the vault undamaged with no footing, so it never reads as Sound.

## What changed

- `ingotsDressing.ts` (new, pure): ring, scale, fixed pile list; `ingotsPlan` is `fountainPlan` read as barriers, so the same tests and the same slots-lost-first rule apply.
- `IngotsDressing.tsx` (new): draws it from `holding-ingots.glb`, static batch, plain block as the fallback.
- `LandCentre.tsx`: one line for the theme. `landCentre.ts`: `DRESSING_BUILT.ingots = true`, and `DRESSING_DRAWS_NEUTRAL.ingots = true`.
- `ingotsDressing.test.ts` (new, 9): ladder order, sound versus failing, neutral and ghost are not Sound, wall tier alone decides, fixed gold, everything inside the ring and the ring inside the stream band, slot behaviour, every node exists, file under 600 KB.
- No new asset, no backend, no migration.

## Seen

A headless lineup (three.js, software GL) of the real `holding-ingots.glb` at intact, partly fallen and failing: reads as a vault yard; the coin stacks were hidden behind the chest, so they were moved out (angle and distance only).

## Not checked

The building in the real scene (facing, size next to the door post, shadows), draw calls and fps (press P), and which of your holdings is bullion (the theme readout lists it).
