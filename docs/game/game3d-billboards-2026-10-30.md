# 3D courtyard, week 5 (start): solid people and props, mountain backdrop (2026-10-30)

Status: **written, tested and looked at in a headless browser (software GL), not merged, not deployed, not yet seen by Faiz on a real GPU.** Added to the week 4 PR (`feature/game3d-reckoning`). Frontend and art only. (File name keeps "billboards": the first version used flat pictures; Faiz saw them on Railway and said they went flat or vanished when he walked past, so they were replaced the same day.)

## What changed
- **Real solid models, built in code** from simple shapes with a dark-indigo ink outline (a slightly larger back-facing copy) and the Stitch Master palette: the Oracle, the Partner, the hero (teal hooded cloak, replaces the capsule), fountain, lamp posts, a blank quest board and a raven perch. Faceless figures, as in the pictures. `Inked.tsx` (part helper and palette), `Figures.tsx`, `PropModels.tsx`.
- Props (`props.ts`): fountain in the middle, four lamps (two at the gate road, two by the fountain), board near the spawn point facing the gate, perch east. Decoration only; none carries a fact. `props.test.ts` checks they sit on the cobbles, clear of pads, keep, people, spawn and the gate road, and apart from each other.
- Distant mountain and lake **backdrop** (the only picture left, 22 KB), wrapped round the horizon with mirrored tiles, unlit and unaffected by fog.
- The side panels sit above the floating name labels (`z-20`).

## Art pipeline
`scripts/art/pack_game3d.py` (offline): masters in gitignored `art-masters/game3d/backdrop.png` -> WebP in `frontend/src/assets/game3d/` and generated `frontend/src/game3d/artManifest3d.ts`. The Stitch pictures of the people and props stay on Faiz's disk as the style reference and as inputs for a later image-to-3D step.

## Verified
`tsc --noEmit` clean, ESLint clean, `vitest run src/game3d` 57 pass. Earlier in the same branch the full `vitest run` (915) and `vite build` passed; not rerun for the model swap. Looked at in headless Chromium with mock data: hero, Partner (scarf, cap, "press E"), fountain, lamps, board all render as solid objects from several sides.

## Known gaps
- Software rendering only: frame rate on a real GPU is unmeasured (press P). Each part is drawn twice for the outline; a few hundred draws at most, within the 300 budget, but not measured.
- Models are simple shapes: stylised, not the detail of the Stitch pictures. No animation (no walk cycle) yet.
- Real rigged models (Tripo or Meshy from the Stitch front and back pictures, then GLB with `useGLTF`) would replace `Figures.tsx` one figure at a time; terms of use to check first.
- Gate arch and keep door pictures are still unused.

## To look at (Faiz)
Open `/game3d`: walk round the fountain, the board and both people. Do they hold up from every side? Is the hero (teal hood) readable? Press P for frame rate.
