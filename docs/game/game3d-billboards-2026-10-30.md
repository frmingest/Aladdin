# 3D courtyard, week 5 (start): billboards and props (2026-10-30)

Status: **written, tested and looked at in a headless browser (software GL), not merged, not deployed, not yet seen by Faiz on a real GPU.** Added to the week 4 PR (`feature/game3d-reckoning`). Frontend and art only.

## What changed
- The Oracle and the Partner are now **billboards** (Stitch pictures that stay upright and turn to face you), replacing the plain-shape stand-ins. Still solid, still labelled "press E".
- Courtyard props from Stitch pictures: fountain (middle), four lamp posts (two at the gate road, two by the fountain), a blank quest board (near where you arrive), raven perch (east). Decoration only; none carries a fact. `props.ts` holds where they stand; `props.test.ts` checks they sit on the cobbles, clear of pads, keep, people, spawn and the gate road, and apart from each other.
- A distant **mountain and lake backdrop** wraps the horizon (mirrored tiles so joins do not show), unlit and unaffected by fog.
- Unlit (flat) materials and a soft ground blob under each picture, so nothing is flattered by light and nothing floats.
- The three side panels now sit above the floating name labels (`z-20`); before, a far-away label could draw over the quest log.

## Art pipeline
- `scripts/art/pack_game3d.py` (offline, not CI): masters in gitignored `art-masters/game3d/<id>.png` -> keyed (same white key as `pack.py`), cropped, WebP into `frontend/src/assets/game3d/` (committed, 131 KB for all seven) and a generated `frontend/src/game3d/artManifest3d.ts`. The Stitch folder each master came from is listed in the script header.
- Not used yet: hero front/back/side (waiting for the image-to-3D step), gate arch (its dark opening would hide the road when you walk through) and the keep door picture (the keep is a box).

## Verified
`tsc --noEmit` clean; ESLint clean; full `vitest run` 915 pass (game3d 57, +3 props tests); `vite build` ok (3D chunk still 2.9 MB, 1.0 MB gzipped; the seven pictures add 131 KB). Looked at in headless Chromium: props, Partner billboard with "press E", quest log with both quests (mock data), and the backdrop above the walls all render.

## Known gaps
- Software rendering only: frame rate on a real GPU is unmeasured (press P).
- Billboards look flat when seen from above or from far to the side; the hero is still the capsule.
- Backdrop is painterly, not inked like the props, and large: judge it from the courtyard.
- Perch art is busy; fountain is oversized on purpose (storybook scale).
- A tower-mesh check was not part of this change.

## To look at (Faiz)
Open `/game3d`: do the people and props read well from the spawn point? Do the lamps and board get in your way? Look up over the walls: is the backdrop pleasant or too heavy? Press P for frame rate.
