# Weather Tower: plates instead of clocks (2026-11-12, issue #402)

**Status: written and tested in a cloud session on `feature/game3d-weather-tower-plates`. NOT seen in the live 3D scene, NOT deployed.** Frontend: `tsc --noEmit`, `npm run lint` (0 errors, the 3 old warnings), `npm test` (227 files, 2,032 tests) and `npm run build` pass. The plate pictures were rendered to a PNG in the sandbox and looked at; the room itself was not opened in a browser.

## What Faiz said

"I don't like the clocks and especially not the way text is shown." His screenshot: three rows of identical white clock faces with no names, a narrow yellow sticky note for the numbers (only when standing beside a dial), and small white tags on the curve posts.

## What a sprint is for (plain words)

Make the Weather Tower read like a wall of labelled boards, not a wall of clocks: you see what every number is called and what it is, from across the room.

## What you will see

- **A plate for each series** (same places on the walls as the old clocks): its name, its number in big type, the change over 3 and 12 months, the last 24 months as a line, and a bar from "low" to "high" with a dot where today sits.
- **No more needles or clocks.** The dot on the bar is the old needle, said more plainly.
- **Always readable.** Names and numbers no longer wait for you to stand beside a dial. The plate you stand beside gets a gold rim.
- **State by shape and word:** no reading = dashed rim and the words "No reading"; stale = a slate tab on the plate that says "stale" and a dimmer number.
- **Curve posts** carry the same kind of small plate (maturity and yield).
- **Banners** instead of floating tags: the title and "N of M plates reading" on the north wall, "Norway" and "United States" on the side walls, a key under the north banner, the curve key at the rail.

## What changed

- `weatherPlateArt.ts` (new): draws the plates, post tags and banners on a canvas. Pure drawing, tested with a fake canvas (`weatherPlateArt.test.ts`).
- `WeatherTowerRoom.tsx`: the clock and the DOM tags are gone; flat unlit plates carry the pictures (text reads the same from any angle; no per-frame work).
- `weatherTowerRoom.ts`: each dial plan now carries its `fraction` (where today sits in the 24-month range). Layout, walls and slots are unchanged, so every other test still holds.
- `weatherTowerWordsV2.ts` (new, Rule: new wording = new version): "Dot: where today sits in its 2-year range" replaces the needle key; "plates reading" replaces "dials reading". v1 stays for the Town door sign.
- No backend change, no migration, no data change.

## Game checklist

- **Pages touched:** the Weather Tower only.
- **Identity before -> after:** 3 on paper before; the clock was a repeated object that carried the facts but not the names. Now each plate encodes the name, the number, the 24-month line and the range position. To be re-scored from a real screenshot.
- **Visual verb + scene:** read, a wall of brass-rimmed boards in a tower.
- **Look-and-judge screenshots:** not taken of the room (no browser reaches a sandbox dev server). Plate art was previewed as a PNG.
- **Interaction cost:** unchanged (E at the door to go in, E at the plates for the full page); reading needs no press now.
- **Words:** short, game voice, no buy, sell, good or bad words (existing test, now on v2).

## Faiz: after deploy

Open `/game3d?at=weather` and look at it from the door and from the middle. Press P to check draw calls; each plate is one flat mesh with one small texture (about 22 textures of 400x338).

## Not in this build

Nearby plates tilting toward you, a per-series "what is this" card, instancing the plates.
