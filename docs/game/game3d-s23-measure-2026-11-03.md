# 3D S23 PR 1: measuring the courtyard (2026-11-03)

**Status: written and tested, not looked at in a browser, not merged, not deployed.** First step of [S22 and S23](game3d-s22-s23-sprint-plan-2026-11-02.md). Nothing you can see in the scene changes. The only visible change is a small box under the toolbar when the stats are on.

## What a sprint step like this is for (plain words)

The courtyard draws too many things (528 draw calls when we last looked; our own limit is 300). Before we fix it, we need to know *who* owns those calls, so we fix the biggest owners first instead of guessing. This step only adds the measuring.

## What you will see

Press **P** (or the 📊 button) in `/game3d`. The top line is the same as before (fps, draws, triangles). Under the toolbar a small box now shows:

- how many shapes (geometries) and textures the renderer holds in memory;
- the biggest parts of the scene, each with its draw calls and thousands of triangles, e.g. `scenery 142 · 31k`;
- "parts add up to N of M draws": the parts only count meshes, while the renderer total also includes shadows and the ink outline pass, so the gap is expected and now visible.

Parts: horizon, courtyard (towers, props), scenery, market (stalls, Market Street, booths), posts (torches, desk, vault, watch, ravens, realm, drill, signpost, camp), weather, people, backdrop, hero; and one part each for the Town, Town Hall, Hall of Records and a tower's library. Anything untagged shows as `other`.

## How it works

- `perfGroups.ts` (pure): `tallyScene(root)` walks the scene and gives each visible mesh to its nearest ancestor tagged `userData.perfGroup`. An instanced mesh counts as one call with every copy's triangles, and is counted separately, so we can see what already draws copies in one go.
- `PerfProbe.tsx`: adds memory numbers, and runs the walk about every 2 seconds, only while the stats are on (the flag `statsDetail`). Off, it costs nothing.
- `Scene.tsx`: plain wrapper groups carry the tags. They have no transform, so positions, physics and look are unchanged.
- `PerfBreakdown.tsx`: the little box.

The numbers are the same for every holding and say nothing about any of them (no verdict, no colour).

## Tests

`perfGroups.test.ts` (grouping, nearest tag wins, hidden parts skipped, instanced and multi-material counts, stable order) and `PerfBreakdown.test.tsx` (empty, counting, list, "N more"). All 63 files / 510 tests in `src/game3d` pass; lint, `tsc --noEmit` and `npm run build` are clean.

## What Faiz does

Open `/game3d`, press P, wait a few seconds, and send Claude the box (a screenshot is fine), once in the courtyard, and once each in the Town and a tower's library if you like. Those numbers are the baseline for S23 PR 2 (draw copies in one go). Check the scene looks and moves exactly as before.

## Not done here

- No baseline numbers yet: this was written without a graphics window, so the 528 figure is still the one from the discovery QA run.
- No fps check: that stays a thing to read with P on your machine.
