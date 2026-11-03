# 3D S25 PR 1: a tower's door now leads to that holding's own land (2026-11-03)

**Status: written and tested, looked at in a headless browser (software graphics, about 2 fps), not merged, not deployed.** Plan: [S25 sprint plan](game3d-s25-holding-land-sprint-plan-2026-11-03.md). Builds on the layout data merged in #275.

## What a sprint is for (plain words)

A sprint is one small, finished step you can look at and judge. This one is the first piece of what you asked for on 2026-11-02: **a tower's door should take you to a place that belongs to that holding**, not the same library room for all eight. This step builds the place itself, plain and honest. The next ones add the survey lanterns (PR 2), the holding's own tower in the middle and the price post (PR 3), and later the themed dressings (S26, S27).

## What you will see

Walk to any tower door in the courtyard and press E. You arrive in an open green land with a hedge round it. Ahead and to the left stands a **gate stone** with the holding's name, ticker, weight in the realm and value. On the west side is the **records house**: an open-fronted building with the same seven shelves as before (round the walls) and the reading table in the middle. **E at a shelf opens it, E at the table opens the latest report** (that still marks it opened, from S24). **E at the gate** (two low posts behind where you arrive), the "← Back outside" button, or **B** take you back to the courtyard, to the spot in front of that tower's door.

Only the size of the ground follows the holding's size class (four fixed sizes: great 22, medium 19.5, small 17.5, tiny 16.5, and "not known" takes the small one). Everything else stands in the same place for every holding.

The middle of the land is **bare on purpose** for now. The four survey lanterns come in PR 2; the holding's own tower and the price post come in PR 3.

**Pictures:** [a holding with all facts](img/game3d-s25-land-arrival-2026-11-03.png) and [a small holding that is not surveyed](img/game3d-s25-land-unsurveyed-2026-11-03.png) ("Weight not known", "Value not known", "Not surveyed yet"). Both from the arrival spot, with made-up sample towers.

**Visual verb + scene:** *visit the holding.* Facts encoded: the gate stone's name, weight and value; the shelves' book counts and mist (as before).

## What changed in the code

- `holdingLand.ts` (pure data): new fixed layout. The ground radii grew, because seven bays only fit round a house if the house is big enough; the records house (`RECORDS_HOUSE`, `LAND_SHELF_SLOTS`, `LAND_TABLE`) is now sized for them at three quarters of the library's bay size (`BAY_SCALE`), and the spawn, gate, gate stone and price post moved to match. A test checks every bay and reading spot is inside the house, that bays do not overlap, that the table is clear of the shelves, and that the whole house fits the smallest land.
- `areas.ts`: the place `library` is now `holding` (outdoor, parent = courtyard, one door: the gate). `near.ts`, `areaMachine.ts`, `placeLink.ts`, `areaWordsV1.ts` follow. Links are `?at=holding:<id>`; **the old `?at=library:<id>` still works** and opens the same land (decision F1, silently).
- `HoldingLand.tsx` (new): draws the land. `LibraryBay.tsx` (new): the shelf bay and book, moved out of `Library.tsx` with a `scale` option. `holdingLandWordsV1.ts` (new): the few words (plate, gate prompt, house label), game voice.
- `Scene.tsx`, `Game3DPage.tsx`: the page builds the gate stone's facts (`gateStoneFor`, `landRadius`) from the stored tower row and passes them to the scene. The Standing prompts, shelf panels and report opener are untouched.
- **The old shared library room is still in the code** (`Library.tsx`, `libraryRoom.ts`), unused, as a way back. It is removed in a separate small PR after you have looked.

## Measured (headless Chrome, `?at=holding:<id>`, press P)

| | Draw calls | Triangles |
|---|---|---|
| First build (each part drawn alone) | 344 for the land | 28k |
| With the still pieces drawn in one go (S23's `StaticBatch`) | **92 for the land** (107 with the hero and backdrop) | 28k (37k in all) |

Budget for a land: 120 draw calls, 80k triangles. The shelves' books are the one fact in the batch, so each bay rebuilds its batch when its book count changes; the gold "you are here" frame and the mist over an unknown shelf stay outside it. `?nobatch` turns batching off to compare. **Frame rate was not judged** (software graphics ran at about 2 fps): press P on your machine.

## What was checked, and what was not

- Pure tests pass (1475 in all): layout inside the house and the smallest land, seven distinct shelves, never arriving at the gate or a shelf, the old link alias, words short, `standingAt` for a land (shelf before table before gate).
- In a headless browser with a made-up game state: the land opens from its link with the right title; the gate stone shows real and "not known" facts; walking north and west runs the hero into the hedge and stops it.
- **Not checked in a browser:** pressing E at a shelf, the table or the gate (the logic is the library's, covered by `standingAt` tests); the fade and name plate when walking through a real tower door; the inside of the records house from close up; frame rate.

## For Faiz to look at in `/game3d`

Walk into two or three towers (one strong, one with fog). Read the gate stone. Walk to the records house, press E at a shelf and at the table, then leave by the gate and by B. Press P and tell Claude the fps. Say if the house feels cramped (the bays are smaller than in the old room), the land too big or empty, or a word is off.

## Open points

- The centre of the land is empty until PR 3, and the lanterns until PR 2 (by plan).
- The gate stone is a plain slab. A better-looking stone is a small art task, not a blocker.
- The price post's spot is reserved (east of the gate) but nothing stands there yet.
