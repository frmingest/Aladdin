# 3D courtyard S14 M4 + S20: merchants at Sal's counter and the Hype Booth (2026-11-02)

**Status: written on `feature/game3d-merchants`, off `main` at `9014939`. `tsc` and lint are clean; the 13 test files that depend on the change (111 tests) pass; the full test run and the build were left to CI (the workspace disk was nearly full and the full run crawled). NOT looked at in a browser by Claude, not merged, not deployed.**

## What this is for (plain words)

The two stands at the near end of Market Street (Sal's counter and the Hype Booth) were empty wooden counters with a sign. Now somebody stands behind each one, so the street has people where you press E. Same free trick as the scribe and the vault keeper: bodies from the character files we already have, no new download.

## What you will see

- **Sal** stands behind his teal-roofed counter, in the Rogue file (the scout's body, knives put away), playing the `Interact` clip (hands busy at the counter).
- **The Hype Booth barker** stands behind the yellow-roofed counter, in the hooded Rogue file (the hero's body, weapons put away), playing the `Cheer` clip on a loop. With reduced motion he holds Idle, like everyone else.
- Neither has a name, words or data. E still opens the same two dialogs as before.
- If a model file fails to load, the plain shape figure stands in; while loading they show nothing, so the old shape never flashes.

## What changed

- `boothPlan.ts`: each stand carries a `merchant` (model slot, held clip, height) and a shared `MERCHANT_AT` spot behind the counter, in the stand's own frame.
- `Booths.tsx`: renders the merchant inside the stand's group. He stands inside the stand's own solid, so no new collider.
- `models3d.ts`, `modelFit.ts`: two new slots, `merchantSal` (Rogue.glb) and `merchantHype` (Rogue_Hooded.glb). Both files are already fetched for the scout and the hero.
- `animClips.ts`: `CLIP.interact`.
- Tests: `boothPlan.test.ts` (each stand has one, own slot, held clip, inside the solid and under the roof) and the slot list in `modelFit.test.ts`.
- No backend, migration or new asset.

## Not checked

- How the figure sits behind the counter (the counter is 1.1 high, the roof 3.05; he is 1.9 tall at `lz = -0.25`). If he clips the posts or the counter, `MERCHANT_AT` is the one number to change.
- Whether a looping `Cheer` reads as friendly or as noise. One word in `boothPlan.ts` swaps it for `Idle`.
- Draw calls and frame rate: two more skinned people, each with an ink-outline shell. Press P; the first cut is the barker.
- The barker shares his body with the hero and Sal with the scout; that is the cost of the free path.
- The full test suite and `npm run build` were not run here; CI runs them.
- On a case-insensitive mount `tsc` reports false "differs only in casing" errors for `Workers.tsx` / `workers.ts`; it was run on a case-sensitive copy instead and was clean.

## Left for later

Kenney Mini Characters for truly new faces (needs a lineup picture first); KayKit Skeletons as enemies (your call); the Quest-log pill on phones and the other 3D ideas listed in PROGRESS.
