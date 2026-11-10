# 3D: the whole Town moves outside the gate, and the holdings spread round the meadow (2026-11-10)

Faiz's ask: the holdings should be spread around the kingdom outside, and the Town should stand right outside the
gate (first the Town Hall, then "the whole town"), so you walk up to it instead of being teleported to it.

## What changed, in plain words

- **The whole Town stands on the meadow**, either side of the gate road, a few steps out of the gate. Six buildings in two
  rows facing the road. West side, from the gate out: Town Hall, Cartographer, Weather Tower. East side: Archive, Workshop,
  Hall of Records (the big castle at the far end). Walk up to a door and press E. The Town Hall, Hall of Records and
  Weather Tower take you into their rooms; the others open their page. Stepping out puts you on the road in front of the door.
- **The gate is just a gate now.** No Town to teleport to; the old Town area, its plaza, well and road back are gone.
- **The holdings spread out.** Before, every holding with no landscape of its own (bank, stall, factory, ingots, fountain,
  armoury, apothecary, plain tower) crowded the two strips either side of the gate road. Now they stand on the open
  meadow, one in each quarter round the wall: south-east first (the shortest walk), then south-west, north-east, north-west.
  Mines and quarries (hill foot, north), farms (fields, west), watermills and fish farms (river, east) and windmills
  (rise by the river) keep their places.
- **The gate road is clear** between the two rows of buildings.

## Rules kept

- Where a holding stands still depends only on its theme and its weight order. The landscape carries no fact.
- The Town is fixed: the same spots for every portfolio, the same KayKit models, door mats and name boards as before. If the model file fails to load, the mat, the board and the door still work.
- Trees and plants keep off the buildings' ground (same thinning rule as for the plots).

## Where things are (courtyard coordinates, x east, z south, gate road at x 0)

| Thing | Spot |
|---|---|
| Town Hall / Cartographer / Weather Tower (face east) | -12.5 at z 66 / 79 / 92 |
| Archive / Workshop / Hall of Records (face west) | 12.5 at z 66 / 79 / 92 |
| Door spots (E works within 3.4) | about 5.5 to 6 off the road, on the building's road side |
| You step out | 6.4 further toward the road, looking at the door |
| Open meadow spots, in fill order | 35, 70 / -50, 60 / 61, -48 / -57, -53 |

## Code

- `townPlan.ts`: all six `BUILDINGS` on the meadow; the Town-only pieces (plaza, well, exit post, gate prompt) are gone; new `stepOutOf`, `buildingReach`, `VILLAGE_MARGIN`.
- `Village.tsx` (was `Town.tsx`) draws the buildings, door mats and name boards and watches which door you are at. `TownHallOutside.tsx` is gone.
- `areas.ts`: the `town` area is gone; the courtyard has doors for the Town Hall, Hall of Records and Weather Tower; their parent is the courtyard and their exits are on the meadow (`stepOutOf`).
- `near.ts`, `Scene.tsx`, `Game3DPage.tsx`: in the courtyard E at a building does `openBuilding`; no gate, Town exit or hall-gate nears; back buttons read "Back outside".
- `outdoorPlan.ts`: the "road" zone became "meadow" with four spread spots; `countryside.ts` and `meadowPlants.ts` keep trees and plants off every building and its door mat.
- Tests updated for the new flow; the exit snapshot changed on purpose (the Hall of Records exit is on the meadow). The grove test now allows up to 65% of the woods to be thinned (the village takes more trees than the single hall).

## Status

Written and tested (type-check, lint, vitest for `src/game3d` and `src/pages`, production build), not deployed, not yet seen in a browser.
**Faiz, after deploy:** look at the gate road from the gate: three buildings each side with name boards; walk up to each
door and press E (three rooms, three pages); then walk round the wall and check one holding in each quarter.
