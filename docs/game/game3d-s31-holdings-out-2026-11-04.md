# 3D S31 PR 3: the holdings step out (2026-11-04)

Written on `feature/game3d-s31-holdings-out`, stacked on `main` at `281f6cd` (#290). Tests, type-check, lint and the build pass locally (1635 tests). **Not opened in a browser, no fps measured, not merged, not deployed.** Plan: [S31 plan](game3d-outdoor-holdings-sprint-plan-2026-11-04.md); earlier PRs: [plots](game3d-s31-outdoor-plots-2026-11-04.md), [countryside](game3d-s31-countryside-2026-11-04.md).

## What a sprint is for (plain words)

A sprint is one small, finished step you can look at and judge. This one is the step you asked for: **the fortress stays, and the holdings leave it.** Walk out of the gate and each holding stands on the meadow as what it is.

## What you will see

- Every holding stands on its own fixed spot outside the wall (the spots from PR 1, the lanes from PR 2). The eight towers inside are gone and the yard is empty (decision H2).
- A holding with a building in the game (windmill, watermill, farmhouse and fish farm, fountain square, mine, quarry) shows that building, with its wear (wall tier) and stream band (moat tier), exactly as in its own land.
- A holding with no building yet (defence, tech, health, plain) stands as a plain tower on a small plinth (decision H1).
- Each has a **door post** with a lamp and its **name sign** on the side the lane reaches. Press E near it to go in, as before. Coming back out puts you in front of that door, looking at the building.
- If a model fails to load, the plain tower stands in its place.

## The rules that held

- Where a holding stands depends on its theme and weight order only (`assignPlots`). A test changes wall, moat, thesis and size and checks every spot stays the same.
- The door is reached from the building's footprint, not its middle, so a big building is not easier to enter. Tested.
- No quick travel (decision H3, deferred).

## What changed in the code

- `stateToWorld` now places holdings on outdoor plots by default (each view gets a `plot`: zone, footprint, door point, door facing). Handing in `spots` still gives the old pad positions, so older tests keep working.
- `OutdoorHoldings.tsx` (new) draws each building from `LandCentre` moved onto its plot, a collider, the door post, or the plain tower on a plinth. `Courtyard` no longer draws the eight pads and towers.
- `towerDoor.ts`: `enterableOf` and `outdoorExit`; `areas.ts` uses the outdoor exit; `Scene.tsx` counts the reach from the footprint.
- `towerLook.ts` (new): the size, moat and wall tables moved out of `stateToWorld` (still re-exported) to break an import cycle with the outdoor plan.
- Tests: `outdoorWorld.test.ts` (8 new), `stateToWorld.test.ts` updated.

## What I did not check

Looking at it in a browser; frame rate with six buildings in the open scene (press P); whether the building faces look right (they keep the land's facing, only the door post follows the lane); a draw-call count. These are your look-over.
