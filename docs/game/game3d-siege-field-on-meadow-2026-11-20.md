# 3D: the Siege Field moves out onto the meadow, as part of the main map (2026-11-20)

Issue #466. **Status: written on `feature/game3d-siege-on-meadow`, off `main` at `72cabe5`. `tsc`, lint (0 errors, the same 3 warnings as `main`), the full frontend test run (240 files, 2234 tests) and the build pass. Seen once in a headless browser (software WebGL, no backend), no fps, not deployed.** Earlier plans: [gate moved outside (#460)](game3d-siege-gate-outside-2026-11-19.md), [signpost (#462)](game3d-siege-gate-signpost-2026-11-19.md), [A5 Siege Field](game3d-a5-siege-field-2026-11-04.md), [A8 tools](game3d-a8-siege-field-tools-2026-11-05.md).

## What Faiz asked for (2026-11-20)

"I don't like the Siege being placed like this, let's move the whole Siege area out here, just remove any trees/rocks that are in the way to make room for it." This reverses the #460 choice (move only the gate; the field stays its own place).

## What was measured first

The field's content is about 66 x 60 units (80 x 80 walkable). The meadow is walkable out to radius 104; the lane round the wall sits at radius 58.6. The free ground between them is about 40 wide, so the field as it was does not fit. Faiz chose **shrink the field to fit** (the other options were widening the meadow, or only re-placing the gate).

## What you will see

- **The whole Siege Field stands on the open lawn south-west of the fortress**, a 50 x 34 plot centred at x -56.7, z 54.7, its wall line on the far side and its open end toward the fortress. No gate, no fade, no ride, no road back: you walk in.
- **An entrance** (two posts, a lintel, a teal pennant and the "Siege Field" plank) always stands at the open end, so the field can be found.
- **The camp wakes when you come within 50 units**: engines, skeletons, tent, winch, marker stones and banners appear, and only then does the field ask the backend for the wall line (two plain GETs). A cold load makes no request for it; the courtyard spawn and the head of the gate road are both further than 50 units away (a test pins this).
- **The tools work as before** (winch, Storm and Siege stones, two yardstick banners); E is a courtyard prompt now.
- **Dropped for the plot, never moved:** 8 grove trees and boulders, the tilled patch `f3`, and the meadow plants that stood there. The old gate and the fingerpost (#462) are removed.
- **Compacted:** wall line, fog ghosts, engines, skeleton ranks, tent, rocks, winch and stones are the same pieces, drawn closer together (wall at z -10 instead of -18, winch at z 10 instead of 17). Sections are still 12 at most, 3.4 wide.

**Visual verb + scene:** *walk out to the siege.* The camp stands on the open lawn, with the Town and the gate road on its fortress side.

## Why this spot

A search over the whole ring (angle and radius) for a 50 x 34 plot clear of the lane, the walkable edge and the Town's buildings found slack of under a metre at any angle, so the angle is free. -46 degrees (south-west of the gate road) is the closest to the gate road and the Town that clears the Town Hall's reach. The first fit checked only the plot's corners and put the inner edge on the lane; the test now samples the whole plot against the lane, river, road and Town.

## What changed

- `siegeFieldLogic.ts`: the gate, fingerpost, return spot, `FIELD_SPAWN`, `FIELD_EXIT`, `FIELD_RADIUS` and `FIELD_HALF` are gone; `SIEGE_PLOT`, the plot's size, `fieldToWorld` / `worldToField`, `plotCorners`, `onPlot` and `FIELD_WAKE_RANGE` are new; the camp's positions are compacted.
- `siegeFieldTools.ts`: tool spots stay in the field's own frame; `fieldSpotAt` takes a place on the meadow and turns it.
- `near.ts`, `areas.ts`, `areaWordsV1.ts`: the `siege` area, its door, its return spot, the gate and exit spots are removed; the tools are courtyard spots. `?at=siege` now opens the courtyard.
- `SiegeField.tsx`, `SiegeGate.tsx`: no ground, slab, invisible walls or exit post; the field is a placed group that wakes on approach; the gate component is now the entrance. `SiegeFingerpost.tsx` is deleted.
- `Scene.tsx`, `Game3DPage.tsx`: the field is mounted in the courtyard; the siege branch, the gate prompt and the "ride back" prompt are removed.
- `countrysideLogic.ts`, `meadowPlantsLogic.ts`: the grove thinning, the tilled patches and the meadow plants keep off the plot.
- Tests: the gate and fingerpost tests became plot tests (fits the meadow, outside the lane, wall line on the far side, clear of the Town, its doors, the gate road, the river, the tracks, trees, boulders, plants, people and scenery; wakes late); the area tests use the Market Quarter; the e2e link list and the postcard card follow. `__g3dPlace` (development builds only) takes an optional camera turn.
- No backend change, no migration, no new art. No words file touched: the entrance plank reuses `FIELD_WORDS.gateLabel` from `siegeFieldWordsV2.ts` as it was (the gate, exit and fingerpost lines in that file are now unused).

## Game sprint checklist (short)

1. Pages touched: the courtyard of `/game3d` (the field on the south-west lawn). The Siege Field is no longer a place.
2. Identity: Siege Field 2 to 2 (the wall line still carries the one fact); courtyard 2 to 2.
3. Visual win: the field is part of the map, in sight of the Town, with no loading jump.
4. Words: none added or changed.
5. Kit: no new piece.
6. Cut line: the road back, the fade and the ride; the gate and fingerpost. Nothing else.
7. Fortress rules: read-only (two plain GETs, now only once you walk up), deterministic, unknown stays fog, no buy/sell wording, no fact carried by where the field stands.
8. Taps: no E at a gate; walk in, and E at a tool as before. Not measured in a real browser.
9. Draw calls: not measured. The entrance is always drawn (one batch, one plank, two colliders); the camp adds its meshes to the courtyard scene once you are within 50 units (the old Siege Field scene is no longer drawn on its own). The press-P check on real hardware is Faiz's.

## Open items (not done here)

- **Real-GPU look and draw calls.** The camp now draws in the same scene as the courtyard, so the courtyard's 300-call budget must be re-read on a real GPU (press P near the field). If it is over, the skeleton outlines go first.
- **Pop-in at 50 units.** The camp appears as you approach; a longer range costs draw calls on the road. Faiz to judge.
- **Seen with data.** The one screenshot was taken without a backend, so the wall line and the tent's headline were not seen. The demo-stack postcard `05-siege-field` shows them in CI.
- **Parity register.** `parity3d.ts` still lists `/fortress/siege` as fully in 3D; the flat page's back-test card has no 3D surface (open since #460).
- **The old Siege Field scene** had its own sky and the outer meadow; the field now uses the courtyard's.

## Supersedes

[#460, the gate outside](game3d-siege-gate-outside-2026-11-19.md) and [#462, the fingerpost](game3d-siege-gate-signpost-2026-11-19.md): the gate and the fingerpost they describe are removed. The battlefield removal in #460 stays.
