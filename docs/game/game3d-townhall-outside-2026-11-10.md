# 3D: the Town Hall moves outside the gate, and the holdings spread round the meadow (2026-11-10)

Faiz's ask: the holdings should be spread around the kingdom outside, and the Town Hall should stand right outside the
gate, so you walk up to it instead of being teleported to it.

## What changed, in plain words

- **The Town Hall stands on the meadow**, just west of the gate road, a few steps out of the gate. Walk up to its door and
  press E: you are in the hall straight away. Stepping back out puts you on the road in front of it. No Town in between.
- **The Town keeps its other buildings** (Hall of Records, Cartographer, Archive, Workshop, Weather Tower). Only the Town Hall left.
  The Town's north-west corner, where the hall stood, is empty now (the Weather Tower stands just north of it).
- **The holdings spread out.** Before, every holding with no landscape of its own (bank, stall, factory, ingots, fountain,
  armoury, apothecary, plain tower) crowded the two strips either side of the gate road. Now they stand on the open
  meadow, one in each quarter round the wall: south-east first (the shortest walk), then south-west, north-east, north-west.
  Mines and quarries (hill foot, north), farms (fields, west), watermills and fish farms (river, east) and windmills
  (rise by the river) keep their places.
- **The gate road is clear** apart from the Town Hall.

## Rules kept

- Where a holding stands still depends only on its theme and its weight order. The landscape carries no fact.
- The Town Hall is fixed: the same spot for every portfolio. It is the same market-hall model, door mat and name board
  the Town buildings use. If the model file fails to load, the mat, the board and the door still work.
- Trees and plants keep off the hall's ground (same thinning rule as for the plots).

## Where things are (courtyard coordinates, x east, z south, gate road at x 0)

| Thing | Spot |
|---|---|
| Town Hall (middle, faces the road) | -12.5, 66 |
| Its door spot (E works within 3.4) | about -5.9, 66 |
| You step out at | about 0.5, 66, looking away from the door |
| Open meadow spots, in fill order | 35, 70 / -50, 60 / 61, -48 / -57, -53 |

## Code

- New: `townHallOutside.ts` (spot, door, return, prompt), `TownHallOutside.tsx` (draws it), `townHallOutside.test.ts`.
- `areas.ts`: the courtyard has a `townhall` door; the hall's parent is the courtyard; the courtyard's bounds now cover the meadow.
- `near.ts`, `Scene.tsx`, `Game3DPage.tsx`: a `hallGate` "near" and E action, the same shape as the Market Quarter arch.
- `townPlan.ts`: the Town Hall left `BUILDINGS`. `townHallRoom.ts`: `hallExit()` is the meadow spot; the door prompt says "Press E to step back outside".
- `outdoorPlan.ts`: the "road" zone became "meadow" with four spread spots; `countryside.ts`: every plot gets a lane from the ring (the road stubs are gone); `countryside.ts` and `meadowPlants.ts` keep trees and plants off the hall.
- Tests updated for the new flow; the exit snapshot for the hall changed on purpose (the hall's exit is on the meadow now).

## Status

Written and tested (type-check, lint, vitest for `src/game3d` and `src/pages`, production build), not deployed, not yet seen in a browser.
**Faiz, after deploy:** look at the gate road from the gate: the Town Hall should stand on the left with its name board;
walk up, press E, press E again at the hall door; then walk round the wall and check one holding in each quarter.
