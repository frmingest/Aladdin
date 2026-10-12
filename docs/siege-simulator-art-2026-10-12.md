# Siege Simulator art (Design Master Sprint 14, 2026-10-12)

## Why
Decision 10 of the sprint plan put object art into Council, Records, Circle, Chronicle and the Map table and left the Siege Simulator, Night Watch and the Ledger out. The 2026-10-09 audit scored the Siege Simulator 2 because its tower row was generic SVG boxes in its own colours. Faiz asked why the new Stitch pictures were not used there.

## What changed (frontend only, behind Settings > Object art)
- `lib/siegeArt.ts` (pure): picks each tower's picture with `towerArtId` (same wall material and size classes as the Fortress), places it, and works out the scorched band height, crack count, camp and rampart tiles.
- `components/fortress/kit/SiegeArtStrip.tsx`: draws the strip in weather paint (`worldPalette`, from the backend's siege level).
- `SiegeSimulatorPage.tsx`: shows the art strip with art on, the old `SiegeStrip` otherwise.

## Rules kept
- A picture carries no fact. Damage is the share lost from the backend's `shock_pct`; gains draw none.
- Shape, not colour, says "hurt": a scorched band that rises with the loss, plus 0 to 3 cracks (none under 10%, one per 20% after).
- Not modelled: faded picture with "?". Unsurveyed walls: dashed ghost keep, never a guessed material.
- The camp is the Fortress's own `siegeCamp(level)`: none when calm or unsurveyed. No fire arrows (their targets are fixed to the Fortress scene).
- The list below the strip still says every number in words.

## Checked
tsc, ESLint 0 errors, 663 frontend tests (12 new), build. Rendered in headless Chromium against a mock API at desktop and phone width, art on and off. Not seen on real data.

## Not done
No banner backdrop or props for the Siege room: no picture was generated for it. A Stitch backdrop and a trebuchet prop would fit the Sprint 8 banner slots if wanted.
