# 3D: holdings moved back inside the wall (2026-11-11)

**What Faiz asked:** move the holdings that stand outside the fortress into the main fortress area, spread evenly round the inside of the perimeter, so each holding's 3D art and entrance are inside, not outside.

## What changed

- The eight holdings now stand on **one ring inside the wall**: four along the east wall, four along the west wall, the same angle apart (22 degrees, about 16 units), mirrored left and right. Ring radius 42 (the building edges end at the cobble edge, the wall is 54).
- The ring starts just north of the market corner (east) and the Storm Drill camp (west) and ends either side of the keep, so the gate, Sal's counter, the Hype Booth, the market, the camp, the desk, the vault and the open middle walk are all untouched.
- **Spot order:** the biggest holding takes the east spot nearest the gate, the next the west spot facing it, and so on up the walls. Weight order only; the theme only sets the building's width. No verdict, wall, moat or thesis moves anything (THE RULE kept; `assignPlots` still cannot read them).
- **Every door faces the middle of the yard.** The door post, name sign, two-leaf gate and "walk in" reach work as before; stepping back out of a holding's land puts you in front of that door.
- The five outdoor zones (river bend, rise, fields, hill foot, open meadow), their fallback lists and the branch lanes from the ring road to each plot are gone: nothing stands out there now. The river, the ring lane, the road run to the Town, the fields and the trees stay as scenery.

## Files

`outdoorPlan.ts` (rewritten; file name kept so callers stay put), `stateToWorld.ts`, `countryside.ts`, `meadowPlants.ts`, comments in `OutdoorHoldings.tsx`, `Courtyard.tsx`, `towerDoor.ts`. Tests: `outdoorPlan.test.ts` rewritten (17 checks: inside the wall, one ring, equal spacing, mirrored, no overlap with the keep, corner towers, market, camp, gates, desk, vault, props, scenery, booths, torches, NPCs), `outdoorWorld.test.ts`, `countryside.test.ts`, `meadowPlants.test.ts`, `townHallOutside.test.ts` updated.

## Checked

tsc, eslint, vitest (223 files, 1,995 tests) and `npm run build` pass. **Not seen in a browser** and not deployed.

## Faiz after deploy

Walk the yard: eight buildings round the east and west walls, each door facing you as you walk in. Check nothing feels crowded by the market or the camp, and that the walk from the gate to the keep is still open.

## Open

- Holdings with no building art yet (defence, tech, health) stand as a plain tower on a plinth, as before.
- The fields in the far west were laid out round the old farm plots; they stay as scenery.
