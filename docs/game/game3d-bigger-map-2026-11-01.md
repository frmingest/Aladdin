# 3D courtyard: bigger map and typing keys (2026-11-01)

Asked by Faiz: make the whole map larger and spread the marketplace and towers further out; hotkeys (P stats, Q, T, E) fired while typing in a quest or desk field.

## What changed

- `WORLD_SCALE = 1.5` in `layout.ts`. Positions (not model sizes) of walls (36 to 54), cobbles (31 to 46.5), keep (z -25 to -37.5), spawn, the eight tower pads, the siege-simulator zone, props, the two advisors, townsfolk, standing torches and scenery are the first-draft value times 1.5. The keep door face and gate torches are now derived from `KEEP` and `WALL_RADIUS`.
- Marketplace: moved as a block (+10, +7, centre now 30, 21) rather than scaled, so the stall, well, canopy and tables keep their spacing and the corner does not thin out.
- Horizon: grove, rocks, road, walk limit, hills, mountains, backdrop, ground, fog, sun shadow box and camera far plane pushed out to match.
- Walk speed 4.5 to 6 and run 8 to 11, so crossing the courtyard takes about as long as before.
- Typing keys: one shared `typingInField` (input, textarea, select, contenteditable) in `useKeys.ts` now guards the E, Q/T and P handlers. P had no guard at all; P and F3 also ignore Ctrl/Cmd/Alt.

## Checked

`tsc --noEmit`, `npm run lint` (0 errors), `vitest` (1048 pass, including the pad, prop, scenery, market and reserved-zone clearance tests), `npm run build`. New test: `useKeys.test.ts`. Not seen in a browser, not deployed: the shadow map now covers a wider box at the same 2048 size, so shadows may look softer; check 60 fps with P.
