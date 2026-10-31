# 3D courtyard S6: scenery (2026-10-31)

Status: **written and tested, not yet looked at in a browser, not merged, not deployed.** Plan: [game3d-kaykit-sprint-plan-2026-10-31.md](game3d-kaykit-sprint-plan-2026-10-31.md) (S6).

## What changed
- `frontend/public/models/scenery.glb` (187 KB): 16 CC0 pieces from KayKit Dungeon Remastered and Medieval Hexagon, packed by `scripts/pack-props.mjs` (plain float vertices, no compression, no animation). Credits and both licence texts are in `public/models/`.
- `frontend/src/game3d/sceneryPieces.ts`: 18 placed pieces, pure data. Torches and four banners (white, blue) on the keep wall, two torches at the gate, a camp by the Partner (tent, weapon rack, crates, barrels, sack), barrel and bucket by the board, wheelbarrow and two flags on the gate road.
- `frontend/src/game3d/Scenery.tsx`: loads the file, clones each piece, adds a cylinder collider where `solid > 0`. If the file fails to load it renders nothing, colliders included.
- Rules kept: decoration only, no fact, no data; nothing replaces the fountain, lamps, board, perch or the eight holding towers; no red or green banners or flags (cannot read as a status colour).

## Verified
- `sceneryPieces.test.ts`: every piece names a node in the file, file is under 1 MB with no quantize or meshopt, standing pieces are on the cobbles and clear of the keep, pads, people, spawn, gate road and props, hanging pieces sit on the keep face or inner wall.
- `tsc --noEmit` and eslint on the touched files are clean.

## Not verified (open)
- **No screenshot yet.** Piece scale (Hexagon pieces are about 0.2 units tall, scaled x6 to x8), facing of torches and banners, and the camp layout are untested guesses.
- Draw calls (budget 300) and first-load size (budget 15 MB) not measured. Pieces are cloned, not instanced.
- Ink outline on the scenery not tried (add only if it looks right).

## Game checklist
Visual verb and scene: "light the torches, hang the banners: a gate with a keep, not a plain yard". Tap count unchanged. Identity score before/after: to be judged from the screenshot.
