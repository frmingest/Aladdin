# 3D asset plan A4: meadow plants from Forest Nature (2026-11-04)

**Status: written and tested on `feature/game3d-a4-meadow-plants`, off `main` at `8047b77` (A3 merged as #294). `tsc`, lint (0 errors), the full test run (1681) and the build pass. Seen in a headless render only (a top-down plan and one eye-level view), not in the app, no fps, not merged, not deployed.** Plan: [asset sprint plan](game3d-asset-sprint-plan-2026-11-04.md).

## What you will see

The open meadow outside the wall stops being bare. Between the lane round the wall and the edge of the walkable ground stand **26 trees, 44 bushes, 80 grass tufts and 14 boulders** from the Forest Nature pack (CC0), as copses: a few trees with bushes round them, boulders and tufts spread between. Trees and boulders stop you (a small trunk or stone you walk round); bushes and tufts you walk through.

They stand only on open ground: off every plot, track, field, the river, the gate road and every tree or boulder of the existing grove. The grove, hills and mountains are unchanged.

## What changed

- `scripts/pack-forest.mjs` (new): packs 15 Forest Nature pieces (6 trees, 4 bushes, 2 grass, 3 rocks, the `Color1` variants) into `frontend/public/models/forest.glb`, **181 KB** (ceiling 600 KB). Plain float vertices, one shared texture.
- `meadowPlants.ts` (new, pure): the fixed plan. Same seed, same plants, for every portfolio and day. Takes no input.
- `MeadowPlants.tsx` (new): draws it. One instanced draw per model (15 draw calls at most), no shadows, trunk and boulder colliders in one fixed body. If the file fails to load, nothing is drawn and the meadow is as before.
- `Scene.tsx`: two lines, `<MeadowPlants />` next to `<Countryside />`.
- `meadowPlants.test.ts` (new, 10): every node exists in the file, file under 600 KB, instance, model and collider ceilings, each kind uses its own models, stays on the meadow, off the river, tracks, fields, plots, gate road and grove, trees and boulders do not overlap, only trees and boulders are solid, the plan is deterministic and imports no holding, theme, wall or moat.
- `public/models/LICENSE-KayKit-Forest-Nature.txt` (by `scripts/import-pack.mjs`, CC0 confirmed) and a CREDITS entry.

## The plants never carry a fact

Fixed numbers from a fixed seed; no function takes a holding, a theme, a wall tier or a moat tier (a test pins the imports). Leaf green is scenery: `scripts/glb-colour-audit.mjs` finds 0 percent red on every piece; the trees, bushes and grass are green by nature and are on the allow list, the three rocks are grey. Nothing grows or changes with a gain or a verdict.

## Decisions (Claude's call)

- **Kept only 15 of the 100 or so pieces.** One variant per look is enough at meadow distance; more adds file size and draw calls for no visible gain. Say so if you want more variety.
- **No shadows and no wind.** Same as the horizon grove: the shadow map reaches 55 units and these stand beyond it; nothing animates.
- **Grass tufts stay small.** They are the first cut if fps is short.
- **No colliders for bushes and tufts**, so nothing snags you on the way to a door.
- Hills and mountains keep the Hexagon look (P7).

## Rules kept

No red or green status colour (audit above); condition and theme untouched; the file loads with the meadow, not with the first page (+181 KB on opening `/game3d`, nothing on any flat page); nothing grew in the holding land.

## Game sprint checklist, section A

1. Pages touched: `/game3d` meadow only. 2. Identity score: meadow 3 to 3 (richer, not new). 3. Visual win: the meadow reads as countryside, copses to walk through. 4. Visual verb + scene: *wander the copses.* 5. Words: none. 6. Kit: reuses the horizon's instancing method. 7. Cut line: grass tufts first. 8. Rules: above. 9. Taps: unchanged.

## Seen

A headless render (three.js, software GL) of the real `forest.glb` at the real plan, beside the real horizon grove: a top-down plan (copses spread round the ring, none on the river or lanes) and a standing eye-level view next to a 1.8 tall stand-in (trees about 8 to 10 tall, bushes waist to head height, boulders knee to chest).

## Not checked

The plants in the real scene (lighting, how they sit beside your buildings, whether the copses crowd a door), draw calls and fps (press P; at most 15 added draw calls), the first-load number in a browser, and the grass tufts' size on screen (small in the plan view).
