# 3D: the Siege Field moves out onto the meadow, as part of the main map (2026-11-20)

Issue #466. **Status: written on `feature/game3d-siege-on-meadow`, off `main` at `72cabe5`. `tsc`, lint (0 errors, the same 3 warnings as `main`), the full frontend test run (240 files, 2235 tests) and the build pass. Seen once in a headless browser (software WebGL, no backend), no fps, not deployed.** Earlier plans: [gate moved outside (#460)](game3d-siege-gate-outside-2026-11-19.md), [signpost (#462)](game3d-siege-gate-signpost-2026-11-19.md), [A5 Siege Field](game3d-a5-siege-field-2026-11-04.md), [A8 tools](game3d-a8-siege-field-tools-2026-11-05.md).

## What Faiz asked for (2026-11-20)

"I don't like the Siege being placed like this, let's move the whole Siege area out here, just remove any trees/rocks that are in the way to make room for it." This reverses the #460 choice (move only the gate; the field stays its own place).

## What was measured first

The field's content is about 66 x 60 units (80 x 80 walkable). The meadow is walkable out to radius 104; the lane round the wall sits at radius 58.6. The free ground between them is about 40 wide, so the field as it was does not fit. Faiz chose **shrink the field to fit** (the other options were widening the meadow, or only re-placing the gate).

## What you will see

- **The whole Siege Field stands on the open lawn south-west of the fortress**, a 50 x 34 plot centred at x -56.7, z 54.7, its wall line on the far side and its open end toward the fortress. No gate, no fade, no ride, no road back: you walk in.
- **An entrance** (two posts, a lintel, a teal pennant and the "Siege Field" plank) always stands at the open end, so the field can be found.
- **A tall pole with a long teal pennant** stands beside the entrance so it clears the grove and can be found from the gate road (the fingerpost is gone).
- **The camp wakes when you come within 50 units**: engines, skeletons, tent, winch, marker stones and banners appear, and only then does the field ask the backend for the wall line (one GET, `/game/siege`, with the fall and benchmark as query). A cold load makes no request for it and draws none of it; the courtyard spawn and the head of the gate road are both further than 50 units away (a test pins this). Its model files (about 3 MB) start loading at 55 units (just beyond the courtyard spawn, so a cold load fetches none of them) so waking is not a stall. Past 70 units it is hidden again and its skeletons stop (it is not rebuilt on the next approach). Its first read of the book stays for the session unless the fall or yardstick changes.
- **Not drawn while the Hourglass shows a past day** (it reads today's book); E at a tool is shut then, like every other place.
- **The tools work as before** (winch, Storm and Siege stones, two yardstick banners); E is a courtyard prompt now.
- **Dropped for the plot, never moved:** 6 pieces (4 grove trees and 2 boulders; one tree the old gate cleared is kept again), the tilled patch `f3`, and the meadow plants that stood there. The old gate and the fingerpost (#462) are removed.
- **Compacted:** wall line, fog ghosts, engines, skeleton ranks, tent, rocks, winch and stones are the same pieces, drawn closer together (wall at z -10 instead of -18, winch at z 10 instead of 17). Sections are still 12 at most, 3.4 wide.

**Visual verb + scene:** *walk out to the siege.* The camp stands on the open lawn, with the Town and the gate road on its fortress side.

**Fact to shape (unchanged):** a wall section's height is the fall; the yardstick banners mark the benchmark. **Unknown state:** unknown stays fog (the fog ghosts at the wall line). With no data the field shows the engines and fog, never an invented number.

## Why this spot

A search over the whole ring (angle and radius) for a 50 x 34 plot clear of the lane, the walkable edge and the Town's buildings found slack of under a metre at any angle, so the angle is free. -46 degrees (south-west of the gate road) is the closest to the gate road and the Town that clears the Town Hall's reach. The first fit checked only the plot's corners and put the inner edge on the lane; the test now samples the whole plot against the lane, river, road and Town.

## What changed

- `siegeFieldLogic.ts`: the gate, fingerpost, return spot, `FIELD_SPAWN`, `FIELD_EXIT`, `FIELD_RADIUS` and `FIELD_HALF` are gone; `SIEGE_PLOT`, the plot's size, `fieldToWorld` / `worldToField`, `plotCorners`, `onPlot` and `FIELD_WAKE_RANGE` are new; the camp's positions are compacted.
- `siegeFieldTools.ts`: tool spots stay in the field's own frame; `fieldSpotAt` takes a place on the meadow and turns it.
- `near.ts`, `areas.ts`, `areaWordsV1.ts` (only the two siege branches of its functions; no string in it changed): the `siege` area, its door, its return spot, the gate and exit spots are removed; the tools are courtyard spots. `?at=siege` now opens the courtyard.
- `SiegeField.tsx`, `SiegeGate.tsx`: no ground, slab, invisible walls or exit post; the field is a placed group that wakes on approach; the gate component is now the entrance. `SiegeFingerpost.tsx` is deleted.
- `Scene.tsx`, `Game3DPage.tsx`: the field is mounted in the courtyard; the siege branch, the gate prompt and the "ride back" prompt are removed.
- `countrysideLogic.ts`, `meadowPlantsLogic.ts`: the grove thinning, the tilled patches and the meadow plants keep off the plot.
- Tests: the gate and fingerpost tests became plot tests (fits the meadow, outside the lane, wall line on the far side, clear of the Town, its doors, the gate road, the river, the tracks, trees, boulders, plants, people and scenery; wakes late); the area tests use the Market Quarter; the e2e link list and the postcard card follow. `__g3dPlace` (development builds only) takes an optional camera turn.
- No backend change, no migration, no new art. No wording changed or added: the entrance plank reuses `FIELD_WORDS.gateLabel` from `siegeFieldWordsV2.ts` as it was (the gate, exit and fingerpost lines in that file are now unused).

## Game sprint checklist (short)

1. Pages touched: the courtyard of `/game3d` (the field on the south-west lawn). The Siege Field is no longer a place.
2. Identity: Siege Field 2 to 2 (the wall line still carries the one fact); courtyard 2 to 2.
3. Visual win: the field is part of the map, in sight of the Town, with no loading jump.
4. Words: none added or changed (the `areaWordsV1.ts` edit removes code branches, not a string).
5. Kit: no new piece.
6. Cut line: the road back, the fade and the ride; the gate and fingerpost. Nothing else.
7. Fortress rules: read-only (one GET, now only once you walk up), deterministic, unknown stays fog, no buy/sell wording, no fact carried by where the field stands.
8. Taps: no E at a gate; walk in, and E at a tool as before. Not measured in a real browser.
9. Draw calls: not measured. The entrance is always drawn (one batch, one plank, two colliders); the camp adds its meshes to the courtyard scene once you are within 50 units (the old Siege Field scene is no longer drawn on its own). The press-P check on real hardware is Faiz's.

## Open items (not done here)

- **Wake range is measured from the plot centre**, so the camp wakes while you are in the Town (about 33 from the centre). Measuring from the near edge, or about 35, would spare the Town its cost; for the real-GPU look, with the shadow-cost choice (turn `castShadow` off for rocks and banners).
- **Leaving a past Hourglass day remounts the camp** and asks for the book again (correct for truth).

- **No text route to the field (review finding, open).** The game-ux-designer review calls this a blocker for screen-reader and keyboard players: the gate prompt is gone and "Where to?", quests and hints do not name the field. The fix is new words (a "Where to?" line, a polite line when you enter the 50-unit range, `questWordsV4`), so a follow-up issue carries it; it makes #464 obsolete.
- **`?at=siege` opens the courtyard spawn.** Placing the player at the entrance is a follow-up.
- **Sleeping camp beyond 50 units.** The game-designer suggests a low fog bank over a tent shape so waking reads as the fog lifting; and showing the entrance shut or fogged in the Hourglass past view. Neither is built.
- **Tap count and keyboard path** are not measured in a real browser (a CLAUDE.md gate): Faiz or a real-browser session.
- **Playtest note.** The headless run saw no winch prompt; the tester stood 5.1 units from the winch (its range is 2.8), so that was not a bug. Commit 9187056 was not re-tested in a browser.

- **Real-GPU look and draw calls.** The camp now draws in the same scene as the courtyard (and casts shadows), so the 300-call budget must be re-read on a real GPU: press P near the field, then look away. If it is over, the skeleton outlines and shadows go first.
- **Pop-in at 50 units.** The camp appears as you approach, unfogged; a longer range costs more draw calls on the road. Faiz to judge.
- **Seen with data.** The one screenshot was taken without a backend, so the wall line and the tent's headline were not seen. The demo-stack postcard `05-siege-field` shows them in CI.
- **Parity register.** `parity3d.ts` lists `/fortress/siege` at level A (the Where-to panel opens the flat page), so the back-test card is still reachable from 3D and this change loses nothing under the register's rule. Whether it needs a world surface is Faiz's call (issue #461).
- **No text route to the field.** The old gate had an E prompt and #462 a fingerpost; now nothing in "Where to?", the quests or the hints names the field. A line there is new words (a new version file), so left to a follow-up (it makes #464 obsolete). The Storm Drill hint "Find the drill post in the south-west" (`questWordsV3.ts`) now also fits the field's side of the map; telling them apart needs `questWordsV4`.
- **No 3D Plain view for the field** (standard 1d): identity debt, pattern `MintPlainPanel.tsx`.
- **Camp and shadows.** The sun's shadow box is about 80 around the origin and the plot is 54 to 99 out, so part of the camp may lose its shadows. For Faiz's real-GPU look.
- **Breach read from the entrance.** The wall sits 10 behind the engines' row; a breached (low) section could be hidden behind an engine from the entrance. Not seen with data; check postcard `05-siege-field`.
- **The old Siege Field scene** had its own sky and the outer meadow; the field now uses the courtyard's.

## Supersedes

[#460, the gate outside](game3d-siege-gate-outside-2026-11-19.md) and [#462, the fingerpost](game3d-siege-gate-signpost-2026-11-19.md): the gate and the fingerpost they describe are removed. The battlefield removal in #460 stays.
