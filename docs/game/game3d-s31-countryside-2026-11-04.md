# 3D S31 PR 2: the countryside (2026-11-04)

**Status: written, tested, not yet merged, not deployed. Drawn but never looked at in a browser.** This is step 2 of the [S31 outdoor-holdings plan](game3d-outdoor-holdings-sprint-plan-2026-11-04.md). The eight towers still stand in the fortress and nothing in the game moves yet: this PR only lays the ground the holdings will step out onto (PR 3).

## What a sprint is for (plain words)

A sprint is one small, finished step you can judge. This one builds the **land the holdings will stand in**: a river down the east side, lanes from the gate to every spot, and ploughed fields in the west. Nothing on it means anything. It is the same for every portfolio.

## What you will see in `/game3d`

Step out of the south gate. The road runs on a little further. A lane circles the wall and branches off to each future spot (they are empty for now). A **river** bends past the east and south-east and runs off into the hills in the north. West of the gate, **five ploughed patches** sit round the future farm spots. Some trees and boulders from the grove are gone where the river, lanes and fields need the room.

## What changed

- `frontend/src/game3d/countryside.ts` (new, pure data and maths): the river, the tracks, the fields, the flat-strip builder, and the rule that thins the grove.
- `frontend/src/game3d/countryside.test.ts` (new): the ground rules below.
- `frontend/src/game3d/Countryside.tsx` (new): draws it as one flat mesh, one draw call, no physics (you walk across it like the meadow).
- `Horizon.tsx` draws and collides with the thinned horizon; `Scene.tsx` mounts `Countryside` beside it.
- `horizonPieces.ts` is untouched (same seed). Pieces in the way are dropped, never moved.

## The rule that matters: the landscape carries no fact

Everything is a fixed number. No function takes a holding, a theme, a wall tier or a moat tier (a test checks that no builder takes an input). The colours are earth and water only: nothing red, nothing green. The river is 7 wide, clearly not a moat band; the only fact outdoors stays the stream band round each building.

## What the tests check

- The river stays clear of the wall and corner towers, runs beside the river and rise spots (5 to 15 from the middle of the plot, never under it) and leaves every other plot dry. It never crosses a track.
- The lane round the wall is a closed ring that meets the gate road and clears the corner towers. Every one of the 15 spots has a branch that starts on the ring or the road and ends at its door, 4.8 from the plot's middle. No track runs through another plot.
- The fields stay on the meadow and off every plot, track and the river.
- Thinning: only drops pieces, never moves them; hills and mountains untouched; every dropped piece was in the way and every kept one is clear; at least 40% of the grove stays (26 of 53 trees and boulders stay, 27 dropped).
- Budget: the whole countryside is one mesh, about 880 triangles and 990 vertices; the horizon is 56 pieces (was 83), inside both ceilings.

## What I did not do

- Not opened in a browser, no screenshot, no frame rate (press P and send me the fps). The first thing to judge is whether the river reads as a river and whether the lanes look like lanes.
- No door posts, no name plates, no buildings outdoors: that is PR 3.
- No bridge: no lane crosses the river, by design.

## Next

PR 3, the holdings step out (the big one): `LandCentre` per plot, doors, nameplates and everything keyed to the old tower spots move with them.
