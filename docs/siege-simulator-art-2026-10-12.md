# Siege Simulator art (Design Master Sprint 14, 2026-10-12)

## Why
Decision 10 of the sprint plan put object art into Council, Records, Circle, Chronicle and the Map table and left the Siege Simulator, Night Watch and the Ledger out. The 2026-10-09 audit scored the Siege Simulator 2 because its tower row was generic SVG boxes in its own colours. Faiz asked why the new Stitch pictures were not used there.

## What changed (frontend only, behind Settings > Object art)
- `lib/siegeArt.ts` (pure): picks each tower's picture with `towerArtId` (same wall material and size classes as the Fortress), places it, and works out the soot height, flame rows, rubble, arrow hits, camp and rampart tiles.
- `components/fortress/kit/SiegeArtStrip.tsx`: draws the strip in weather paint (`worldPalette`, from the backend's siege level).
- `SiegeSimulatorPage.tsx`: shows the art strip with art on, the old `SiegeStrip` otherwise.

## Rules kept
- A picture carries no fact. Damage is the share lost from the backend's `shock_pct`; gains draw none.
- Shape, not colour, says "hurt" (all drawn by code over the picture): a soft soot stain that climbs the wall with the loss, fallen stones at the foot (3 to 12), one fire arrow stuck in the wall from 25% lost and two from 45%, and a ragged hole with smoke only where the backend says "wall at risk of breach".
- Fire climbs the wall as the loss deepens: no flames under 10% lost, then one more row per 20% (1 to 5 rows; three flames at the foot, two in each higher row, smaller towards the top), plus rising embers from 40%. The flames flicker with CSS (`siege-flicker`) and stand still under reduced motion.
- History: the first version drew cracks (a black band with white zigzags, then chiselled fissures). Faiz asked on 2026-10-12 to remove the cracks and keep everything else, with a climbing fire in their place.
- Not modelled: faded picture with "?". Unsurveyed walls: dashed ghost keep, never a guessed material.
- The camp is the Fortress's own `siegeCamp(level)`: none when calm or unsurveyed. No fire arrows (their targets are fixed to the Fortress scene).
- The list below the strip still says every number in words.

## Checked
tsc, ESLint 0 errors, 663 frontend tests (12 new), build. Rendered in headless Chromium against a mock API at desktop and phone width, art on and off. Not seen on real data.

## Not done
No banner backdrop or props for the Siege room: no picture was generated for it. A Stitch backdrop and a trebuchet prop would fit the Sprint 8 banner slots if wanted.
