# 3D: the Siege Field gate moves outside, the old battlefield goes (2026-11-19)

Issue #460. **Status: written on `feature/game3d-siege-field-outside`, off `main` at `386f781`. `tsc`, lint (0 errors), the full frontend test run (240 files, 2232 tests) and the build pass. Never seen in a browser, no fps, not deployed.** Earlier plans: [A5 Siege Field](game3d-a5-siege-field-2026-11-04.md), [A8 tools](game3d-a8-siege-field-tools-2026-11-05.md).

## What Faiz asked for (2026-11-19)

"Move the Siege Field into the main map and outside the main fortress, next to the other buildings. We do not need the old battleground, remove it from the siege area."

The field's content is about 66 x 60 units (from the fog ghosts to the road back, and from the western to the eastern rocks). The free ground on the meadow beside the Town, once the wall, the river, the tilled fields and the grove are left out, is clearly smaller; that was an estimate, not a measurement. Putting the whole field there would mean squeezing the layout or widening the meadow, so Faiz chose the smaller change: **move the entrance outside**; the field stays its own place behind it.

## What you will see

- **This change (issue #460) puts the gate on the west lawn outside the fortress**, level with the Town's rows, the Royal Mint's mirror across the gate road (Mint at x 28, z 72; gate at x -28, z 72). Its plank faces the gate road. It was inside the courtyard, south of the drill post.
- **Press E at the gate** still rides you out to the Siege Field. Riding back puts you on the meadow beside the gate, looking away from it.
- **Grove and boulders keep off the gate's ground** (two more horizon pieces are dropped than before: 25 of 83 instead of 23).
- **The old battlefield is removed from the field**: the scorch and chalk strip and the war table (and the two plain reads behind them). The flat Siege page and its back-test are untouched.

**Visual verb + scene:** *ride out to the siege.* Walking out of the fortress gate, past the Town, to a timber gate on the west lawn.

## What changed

- `siegeFieldLogic.ts`: new gate position, facing, return spot and return yaw.
- `countrysideLogic.ts`: the grove thinning also clears the gate's ground.
- `SiegeGate.tsx`, `SiegeField.tsx`: comment and the battlefield mount removed.
- Deleted: `Battlefield.tsx`, `battlefieldLogic.ts` (+ test), `battlefieldWordsV1.ts`, `useBattlefield.ts`.
- `siegeFieldLogic.test.ts`: the "gate in the courtyard" tests became "the gate on the meadow": outside the wall, inside the meadow, west of the road, level with the Town, clear of every building, door reach, river, field, track, person, tree and boulder; the return spot is on the meadow and out of every door's reach.
- No backend change, no migration, no new art, no new words file.

## Game sprint checklist (short)

1. Pages touched: the courtyard area of `/game3d` (the gate, now on the west lawn) and the Siege Field (battlefield removed).
2. Identity: courtyard 2 to 2 (the gate is furniture with a plank and a pennant, it carries no fact); Siege Field 2 to 2 (the wall line still carries the one fact). No new page.
3. Visual win: the Siege Field now has a doorway beside the other buildings.
4. Words: none added; the battlefield's strings (a version-1 words file) are deleted; the gate's plank and prompt reuse `siegeFieldWordsV1.ts` unchanged.
5. Kit: no new piece; the gate is the existing code-built furniture.
6. Cut line: nothing is cut apart from the battlefield Faiz asked to remove.
7. Fortress rules: read-only (the deleted code was two plain GETs), deterministic, unknown stays unknown on the tower banners, no buy/sell wording, no fact carried by where the gate stands.
8. Taps: still one E at the gate; the walk to it from the fortress gate is longer, because it now stands on the meadow. Not measured in a browser.
9. Draw calls: the gate is unchanged (one batch, one plank, two colliders); the field draws less (no strip, table or plates) and makes two fewer reads on opening; two fewer horizon instances. Not measured; the press-P check on real hardware is Faiz's.

## Open items (not done here)

- **Finding the gate.** Nothing points to it: no signpost entry, hint or quest line, and it stands about 28 units west of the road. A signpost line or a hint needs a new words version; left for a follow-up issue.
- **Parity register.** `parity3d.ts` still lists `/fortress/siege` as fully in 3D, but the flat page's back-test card now has no 3D surface. Decision for Faiz: accept it as an exception and mark the register, put the back-test somewhere else in 3D, or lower the level.
- **Performance group.** The gate is still counted under the `drill` group in the performance overlay; a group of its own would be clearer (optional).

## Not checked

Everything on screen: how the gate reads from the Town, whether it hides behind the Town Hall's back from the road, frame rate, phone width. Looking is Faiz's (see "After deploy" in the PR).

## Supersedes

[S29, the old battlefield](game3d-s29-battlefield-2026-11-06.md): the strip and the war table it describes are removed by this change. The river colour change in that PR stays.
