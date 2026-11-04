# 3D S31 PR 1: plots and tracks (2026-11-04)

**Status: written and tested, not yet merged, nothing drawn, nothing seen in a browser.** This is the data step of the [S31 outdoor-holdings plan](game3d-outdoor-holdings-sprint-plan-2026-11-04.md). The fortress, the eight towers and the game look exactly as before: no code outside the two new files calls the new plan.

## What a sprint is for (plain words)

A sprint is one small, finished step you can judge. This one answers a question before anything is built: **where on the meadow could each holding stand, and is the walk too long?** The answer is a fixed list of spots, with rules that are tested on every combination.

## What changed

- `frontend/src/game3d/outdoorPlan.ts` (new, pure data, no three.js): five zones (river bend, rise by the river, fields, hill foot, road edge), 15 fixed spots, `assignPlots()`, the footprint of every theme, and the readout tables below.
- `frontend/src/game3d/outdoorPlan.test.ts` (new, 19 tests).

## The rule that matters

A spot depends on the holding's **theme** (and fish flag) and its **order** (weight rank) only. `assignPlots` takes `{ holdingId, theme, fish }` and nothing else, so it cannot read the verdict, margin of safety, thesis, wall or moat. A test hands it holdings that differ in all of those and checks the spots are identical.

## What the tests check

- Every spot is outside the wall with at least 3 units to spare, inside the walkable meadow, off the gate road, clear of the market corner, the drill camp, the watch post and the perch, and at least a building-width from every other spot (the tightest pair is 15.6 apart; two widest buildings need 11.6).
- Same inputs, same plots. Heaviest first takes the best spot; a full zone spills down a fixed fallback list.
- **Every order of eight holdings over six representative themes (1,679,616 orders)** places all eight on distinct spots. 20,000 random mixes of all eleven themes (with the fish flag) do the same.
- The footprints cover what the dressings draw (the stream band, the farm fence).

## Readout: how wide each building stands

| Theme | Footprint radius |
|---|---|
| mine, quarry, windmill, watermill, fountain | 4.0 |
| ingots, stall, bank, factory, plain tower | 4.3 |
| farm (fence ring) | 4.8 |

## Readout: the walk from the gate

Measured as a straight line from just outside the gate, or round the outside of the wall when the line would cross it. It is a floor for the real walk, which also follows the track.

| Zone | Spots | Nearest walk | Farthest walk |
|---|---|---|---|
| River bend | 3 | 68 | 109 |
| Rise by the river | 2 | 59 | 109 |
| Fields | 3 | 71 | 117 |
| Hill foot | 3 | 163 | 191 |
| Road edge | 4 | 17 | 30 |

**Finding:** the hill foot (mine and quarry) sits straight across the fortress from the gate, so the walk is 163 to 191 units, three to six times the road edge. The plan's decision H3 said quick travel is only worth it if the measured walk is long. This is that number. Faiz decided on 2026-11-04 to defer quick travel; this PR does not add it. If a long walk is not wanted, the cheap fix is a data change in this file (move the hill-foot spots to the north-east or north-west, nearer the gate side), not a new feature.

## Not checked

- The real walking speed and how long 190 units take on screen (needs the drawn meadow, PR 2 and 3).
- Which of the real holdings fall into which theme: run the theme readout (`themeReadoutTable`) on the real portfolio after merging #281.
- Whether the grove and boulders cross a plot: PR 2 drops those pieces (`horizonPieces.ts` keeps its seed).

## Verification

`tsc --noEmit`, `eslint`, the new tests and the full frontend test suite and build; see the PR text for the result of each.
