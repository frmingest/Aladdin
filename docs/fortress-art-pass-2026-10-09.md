# Fortress art pass — 2026-10-09

Branch `feature/fortress-art-pass`. Written and tested, **not merged, not deployed, not yet seen on the live app** (screenshots were taken from a test page with made-up holdings, not Faiz's real ones).

Starting point: a review of the game-object art (Fortress scene, Marketplace, Genie, merchants). The art was already strong; the gaps were same-looking towers, a siege that was mostly a sky colour, flat moats, empty lower terraces, noisy stone grain, and ravens that were hard to see. This PR is options A, C and D of that review. Option B (a building shape per sector), E (marketplace and characters) and F (hand-painted layers) are not done.

## What changed

- **Raven bug fixed.** The bob animation (`fortress-raven-bob`) set a CSS `transform`, which replaced the `translate(x y)` attribute on the same element, so the bird jumped to the top-left corner of the scene whenever motion was allowed. Position now lives on an outer group, the bob on an inner one (`RavenMark.tsx`, with a regression test). The raven also gets a pale halo and outline so it reads against the night sky.
- **A, polish.** Softer stone grain (`fs-grain` alpha 0.95/-1.4 → 0.72/-1.15); static ripples on the moat; a quiet life layer on the lower terraces (track, well, hay bales, furrowed field, trees; same whatever the portfolio looks like, never status).
- **D, weight as scale.** `weightScale()` in `lib/fortress.ts`: tower height follows portfolio weight within a size class, bounded 0.9–1.15, height only (widths decide the layout), unknown weight draws at the class height.
- **C, a visible siege.** `siegeCamp(level)` in `lib/fortress.ts` decides what is drawn; `SiegeArmy` in `sceneWorld.tsx` draws it on the far hills. Calm and unsurveyed: no enemy. Gathering: 3 tents, 7 soldiers. Besieged: 7 tents, 20 soldiers, 3 siege engines, 5 fire-arrow arcs aimed at the walls. All static; the existing camp fires remain the only motion.

## Rules respected (game-ui-standards)

No new animated SVG filters, no new looping animations, nothing that makes an unknown or weak fact look good, status never by colour alone, all mapping in pure tested functions.

## Verified

`tsc --noEmit`, `npm run lint` (0 errors; 2 existing warnings), `npm test`, `npm run build` all pass on this branch. Screenshots of calm, gathering and besieged were compared before and after.

## For Faiz after deploy

Look at Fortress in calm and besieged weather (the besieged army is easiest to judge in a real siege or the demo state), confirm ravens sit on their towers, and that Equinor-sized holdings read taller than small ones. If the grain now looks too soft or the weight scaling too strong, the two constants are `fs-grain` in `sceneWorld.tsx` and `WEIGHT_SCALE_MIN/MAX` in `lib/fortress.ts`.
