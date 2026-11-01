# 3D courtyard: spread the towers, reserve ground for the marketplace and siege simulator (2026-11-01)

Status: **written and tested (tsc, lint, 1039 tests, build); in PR `feature/game3d-spread-layout`; not merged, not deployed, not seen in a browser.**

## Why
The eight holding towers stood in one tight arc (about 5 units apart, radius 15) right in front of the keep, so the north half looked packed while the flanks and south stayed empty.

## What changed
- `towerSpots()` is now a fixed, mirrored horseshoe (`frontend/src/game3d/layout.ts`), best-seen first: an inner pair at (+-10, -9) framing the walk from gate to keep, flank pairs at (+-23, -12) and (+-23, -1), and a pair at (+-16.5, -23.5) framing the keep. Neighbours are 10 or more apart; the middle avenue (|x| under 8) stays open.
- New `RESERVED_ZONES`: marketplace (20, 14) radius 6.5 on the south-east, siege simulator (-21, 9) radius 7 on the south-west. Nothing is drawn; tests fail if any pad, prop, person, desk or scenery piece stands in them. Delete the entry when the feature is built.
- `TOWER_SPOT_RADIUS` removed (nothing used it any more).
- Not moved: the keep, corner towers, people, props, scenery. Holding order now fills inner pair first (biggest holdings), no data change.

## Tests
`layout.test.ts` (spread, spacing, clear of keep and corner towers, zones), new `reservedZones.test.ts`.

## For Faiz after deploy
Open `/game3d`: towers on both flanks and beside the keep, an open middle, empty ground south-east and south-west. Say if you want the keep moved or a different spread.
