# 3D S25 PR 3: the holding's own tower and the price post (2026-11-03)

**Status: written and tested (tsc, lint, 1501 frontend tests, build); NOT looked at in a browser (needs a game state to open a land, and the headless run has no way to fake one cheaply); not merged, not deployed.** Plan: [S25 sprint plan](game3d-s25-holding-land-sprint-plan-2026-11-03.md). Builds on PR 1 (#276) and PR 2 (#277). This is the last S25 PR; S26 (the themed dressings) starts after it.

## What a sprint is for (plain words)

A sprint is one small, finished step you can look at and judge. S25 gives every holding its own land. PR 1 built the ground and the records house, PR 2 the four survey lanterns. **This step fills the middle**: the tower you saw from afar in the courtyard now stands in the land, and a price post by the exit shows three facts at a glance.

## What you will see

Walk into any tower door. In the middle of the land stands **that holding's own tower**, with its real wall colour, crown, cracks, ivy and moat. A tower whose wall is not surveyed is a **pale ghost in mist**, as in the courtyard. By the exit, east of the gate, is the **price post**:

- **Plank gauge** (margin of safety): the cream marker sits higher the more room there is (four heights). Unknown is a mist ball, never a made-up height.
- **Sealed scroll** (thesis): whole, cracked (a gap), broken (two halves apart) or mist.
- **Small banner** (siege exposure): short square (sheltered), long pennant (exposed), notched pennant (breach risk) or mist.

Walk up to the post (no key needed) and it prints three short lines plus the stored reason for the gauge. Unknown lines start with "?".

**Visual verb + scene:** *visit the holding.* Facts encoded: wall and moat tier (tower), margin of safety, thesis state, siege exposure (post). Shape and height carry meaning; no red or green (the courtyard's thesis flag is dropped in the land, the scroll carries the thesis).

## Truth rules kept

- **Same layout for every holding.** The tower has a fixed footprint (radius 1.8, moat gap 0.8, moat widths 1.4 / 0.7); only its height follows the size class, capped at 11. A test keeps the moat clear of the lanterns and the records house.
- **A weak tower is not prettier.** Wall colour, crown teeth, cracks, ivy and ghost state come straight from the courtyard's `TowerView`; a test checks they pass through unchanged.
- **Unknown stays mist.** Not-analysed thesis, unsurveyed siege and no margin-of-safety result each draw mist with a "?".

## What changed in the code

- `TowerMesh.tsx`: the tower is lifted into a shared `TowerBody` (`door` option); the courtyard's `TowerMesh` just wraps it, so nothing is copied.
- `holdingLand.ts`: `LAND_TOWER`, `centreTowerFor`, `GAUGE_FILL`, `BANNER_SHAPE` (pure data, with tests). `pricePostFor` already existed.
- `PricePost.tsx` (new) and `pricePostWordsV1.ts` (new, short game-voice labels, with a word-budget test).
- `HoldingLand.tsx`, `Scene.tsx`, `Game3DPage.tsx`: pass the centre tower and price facts through.

## Not done / for Faiz

- Draw calls and triangles for the land were **not re-measured**; the tower sits inside S23's batch, the price post is a few dozen parts. Press P in a land and send the numbers (budget 120 calls, 80k triangles).
- The plan's before-and-after picture (strong and weak holding side by side) is **not made**; it needs a browser with a game state. Please look at two towers (one strong, one weak or in fog) and say if the weak one reads as weak.
- Words to judge: "Lots of room", "Some room", "No room", "Too dear", "Not priced yet".
