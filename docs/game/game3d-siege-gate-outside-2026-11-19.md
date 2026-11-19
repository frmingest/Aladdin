# 3D: the Siege Field gate moves outside, the old battlefield goes (2026-11-19)

Issue #460. **Status: written on `feature/game3d-siege-field-outside`, off `main` at `386f781`. `tsc`, lint (0 errors), the full frontend test run (240 files, 2232 tests) and the build pass. Never seen in a browser, no fps, not deployed.** Earlier plans: [A5 Siege Field](game3d-a5-siege-field-2026-11-04.md), [A8 tools](game3d-a8-siege-field-tools-2026-11-05.md).

## What Faiz asked for (2026-11-19)

"Move the Siege Field into the main map and outside the main fortress, next to the other buildings. We do not need the old battleground, remove it from the siege area."

The field is about 66 x 60 units. The free ground on the meadow beside the Town, outside the wall and inside the walkable edge (radius 104), is about 44 x 26. Putting the whole field there would mean squeezing or widening the meadow, so Faiz chose the smaller change: **move the entrance outside**; the field stays its own place behind it.

## What you will see

- **The gate stands on the west lawn outside the fortress**, level with the Town's rows, the Royal Mint's mirror across the gate road (Mint at x 28, z 72; gate at x -28, z 72). Its plank faces the gate road. It was inside the courtyard, south of the drill post.
- **Press E at the gate** still rides you out to the Siege Field. Riding back puts you on the meadow beside the gate, looking away from it.
- **Grove and boulders keep off the gate's ground.**
- **The old battlefield is gone from the field**: the scorch and chalk strip and the war table (and the two flat reads behind them) are no longer drawn there. The flat Siege page and its back-test are untouched.

**Visual verb + scene:** *ride out to the siege.* Walking out of the gate, past the Town, to a timber gate on the west lawn.

## What changed

- `siegeFieldLogic.ts`: new gate position, facing, return spot and return yaw.
- `countrysideLogic.ts`: the grove thinning also clears the gate's ground.
- `SiegeGate.tsx`, `SiegeField.tsx`: comment and the battlefield mount removed.
- Deleted: `Battlefield.tsx`, `battlefieldLogic.ts` (+ test), `battlefieldWordsV1.ts`, `useBattlefield.ts`.
- `siegeFieldLogic.test.ts`: the "gate in the courtyard" tests became "the gate on the meadow": outside the wall, inside the meadow, west of the road, level with the Town, clear of every building, door reach, river, field, track, person, tree and boulder; the return spot is on the meadow and out of every door's reach.
- No backend change, no migration, no new art, no new words file.

## Game sprint checklist (short)

1. Pages touched: `/game3d` courtyard (gate) and the Siege Field (battlefield removed). 2. Identity: unchanged, no new page. 3. Visual win: the Siege Field now has a doorway beside the other buildings. 4. Words: none new; the gate's plank and prompt reuse `siegeFieldWordsV1.ts`. 5. Tap count: still one E at the gate; the walk to it from the fortress gate is longer, because it now stands on the meadow. Not measured in a browser. 6. Cut line: none.

## Not checked

Everything on screen: how the gate reads from the Town, whether it hides behind the Town Hall's back from the road, frame rate, phone width. Looking is Faiz's (see "After deploy" in the PR).

## Supersedes

[S29, the old battlefield](game3d-s29-battlefield-2026-11-06.md): the strip and the war table it describes are removed by this change. The river colour change in that PR stays.
