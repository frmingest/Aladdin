# 3D courtyard S20: a scribe at the desk and a vault keeper at the chest (2026-11-02)

**Status: written on `feature/game3d-people-scribe`, off `main` at `20216a4`. `tsc`, lint, the full test run (1,303) and the build are green. NOT looked at in a browser by Claude, not merged, not deployed.**

## What this is for (plain words)

Two clips (sitting, using an item) were added to the character files last time but nobody played them. This sprint gives them a job, so the courtyard has people where things happen, with no new download.

## What you will see

- **The scribe** sits in the writing desk's chair, facing the desk, with the open spellbook on his lap. He is the Oracle's Mage file with the wand and staff put away.
- **The vault keeper** stands at the east end of the Vault chest, facing it, holding his mug and playing the "use item" clip. He is the guard's Barbarian file with axes and shield put away.
- Neither has a name, dialogue or data, and neither reacts to the quest cheer (a cheering scribe would stand up out of his chair). Walking into them is blocked by a small collider.
- With reduced motion the scribe stays seated (the sitting clip is a slow breathing loop); the keeper holds Idle, like everyone else.
- If a model file fails to load, the plain shape figure stands in. While loading they show nothing, so the old shape never flashes.

## What changed

- `game3d/workers.ts` (+ test): positions worked out from the desk and chest frames, so they follow if either moves. Tests check chair position, facing, clearance from pads, people, props, scenery, spawn and tower exits.
- `game3d/Workers.tsx`, `Scene.tsx`: render them.
- `models3d.ts`, `modelFit.ts`: two new slots, `scribe` and `keeper`, reusing the Mage and Barbarian URLs (the browser fetches each file once).
- `animClips.ts` (+ test): `STILL_POSES`; reduced motion keeps sitting.
- No backend, migration or new asset.

## Not checked

- How the seated pose lines up with the chair, and whether the mug stays in the keeper's hand, were not seen. Fit uses the standing bind pose; if he sinks or floats, one number in `workers.ts` (the 1.1 chair offset) fixes it.
- Draw calls and frame rate with two more skinned people (each has an ink-outline shell). Press P; the first cut is the keeper.
- The scribe and the Oracle share a body, and the keeper and the guard share one; that is the cost of the free path.

## Left for later

Merchants at the Market Street stands (Sal, Hype Booth) with the same trick; Kenney Mini Characters for new faces (needs a lineup picture first); KayKit Skeletons as enemies (your call).
