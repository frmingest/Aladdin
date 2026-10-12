# Game design challenge: Records, Circle, Map, dispatch details (2026-10-09)

Status: written, not yet deployed. Seen in headless Chromium at 1280 and 390 px against fake data only (not real holdings), with motion on; reduced motion, light theme and keyboard use were not walked through in a browser (unit tests cover the logic).

## What Faiz asked
1. Records: look like a hall of records. 2. Circle: colour theme far too light next to the rest of game mode. 3. Map: a dynamic fantasy world map. 4. Fortress: make "Show the dispatch details" visible and inviting.

## What changed
- **Records** (`kit/HallOfRecords.tsx`, `lib/hall.ts`, `kit/hall.css`): a stone hall with a torch-lit arcade; every decision is a tome in an arched niche with a letter roundel for the action, a wax seal per review (whole disc = sealed, split disc = owed, empty ring = written, each with a printed word at the desk) and a bookmark ribbon when a review is owed. Pressing a tome opens it at a reading desk with the same facts the cards held. A tome never looks different for its outcome. Plain view keeps the old cards.
- **Circle** (`kit/NightPanel.tsx`, `.nightpanel` in `index.css`, `kit/circleMap.css`): the ring map and marks list sit on a dark umber panel with gold ink and astrolabe ticks; selected controls are gold with dark text. Still neutral: nothing green, red or amber.
- **Map** (`lib/worldMap.ts`, `kit/WorldMap.tsx`, `kit/worldMap.css`): a continent generated from a fixed seed (same land every visit). Provinces are sectors (heaviest sector nearest the capital; holdings with no sector get their own dashed, hatched, named province, never folded into a real sector), settlements are holdings sized by bounded weight, the five fog patches sit on each settlement exactly as before, the Great Keep stands at the capital and takes the cash commission's flag. Drag or touch to pan, buttons, pinch or ctrl+wheel to zoom, one tab stop with arrow keys hopping to the nearest tower, names printed heaviest first without overlap. Sea drift, two ships, the Keep banner and a sea serpent move only with motion allowed and the map on screen. Terrain carries no state. The tower-card grid is gone; the survey list and slate remain.
- **Fortress dispatch details** (built by a second agent: `DispatchDisclosure.tsx`, `dispatchSeal.css`, `lib/dispatchSeal.ts`): a full-width gilded plate with a wax seal and raven, "Break the seal: dispatch details", a real line count, a chevron; open = cracked seal and a sunken frame. Game mode only.

## Checks
`tsc --noEmit`, `npm run lint` (0 errors), `vitest` (559 passed), `vite build`. Word budget for the Map chrome kept at 45 by shortening the hint. Backend untouched.

## Not verified / decide
- Real data; reduced-motion and light theme; keyboard walk-through; screen reader.
- Map: provinces are wedges round the capital (equal size, not weight); the seed ("aladdin-realm-3") can be changed in `worldMap.ts` for a different continent.
