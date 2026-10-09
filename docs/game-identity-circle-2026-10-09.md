# Game identity: Circle of Competence ring map — 2026-10-09

Status: **written and tested, not merged, not deployed. Seen only in headless Chromium with a synthetic fixture (1280 px and 390 px), never with real data and never in Faiz's browser.** Frontend only: no backend, API, migration or dependency change. The only write is still the existing competence PUT/DELETE behind each row's Save. Stacked on #89 (page-scene kit): retarget to `main` after #89 merges. Design: `circle-council-design-2026-10-09.md` section 2.B (C1-C5; C6 skipped on purpose).

## What changed

- **C1 ring map** (`components/fortress/kit/CircleMap.tsx`, layout in `lib/circleMap.ts`): inside a gilded frame, a parchment ring map. Position carries the level: inside the circle = know, ON the line = partly (the half toward the centre is filled), open ground beyond = outside (cross-hatch), dashed fog band at the rim = unmarked (dashed, full-size "?"). Zone names are printed on the map in HTML. Marker angle is fixed by the sector's place in the full name-sorted sector list (bottom wedge kept free); a spoke length changes only to avoid covering a neighbour. Size is the real portfolio share only (24-42 px drawn, same function for every level, so unmarked is exactly as big as a known sector of equal share; each marker has an invisible 44 px tap box). Markers are placed with a collision check (outside strictly short of the fog start, fog strictly inside the rim); whatever does not fit goes into one "N smaller sectors" tag that counts every level and weight (fog and outside are placed first). Holdings with no sector are one dashed "?" marker at the rim sized by their weight, plus a fog panel with their names; funds and gold stay unplaced as "Not judged". The inside of the circle is an outline only, whatever is inside it. Caption: "Inside means you know the sector, not that the holding is sound."
- **C2** `kit/MarkControl.tsx`: the select becomes three real radios (Know / Edge / Outside), each with its own shape and printed word, no radio checked while unmarked, plus "Clear". A boundary stone beside the name shows the saved mark's shape, date and a note glyph (dashed "?" stone when unmarked).
- **C3**: the holdings list and the sectors with nothing held and no mark are behind disclosures. A sector with a mark but nothing held stays on the ring.
- **C4**: pressing a marker scrolls to and focuses that sector's mark control (the row itself in demo mode, where the control is read-only).
- **C5**: a strip of four facts (Inside, On the edge, Outside, Unmarked), each exactly the backend figure, no sum. "No sector set" shows its own figure on its fog panel.
- **Neutral palette** (Faiz's decision): parchment and ink only; no green, amber or red for the levels in this view.
- **Plain view and normal mode** render the old content (bar legend, selects, holdings list), unchanged, so they still use the old green/amber/red pills. Say if you want those neutralised too.
- **Motion**: marker glide on a changed mark is a 300 ms `transform` transition, none under reduced motion. No SVG filters, no looping animation added.
- New CSS is only in `kit/circleMap.css` (`index.css` untouched). Word budget constants live in `lib/circleMap.ts`.

## Verified

`tsc --noEmit` clean; `npm run lint` 0 errors, the same 2 existing warnings; `vitest` 44 files / 465 tests pass (new: `lib/circleMap.test.ts` layout, bands, fixed angles, size bounds, unknown-not-smaller, collapse, fogged and unplaced facts, forbidden wording, word budget; `kit/circleMap.test.tsx` render checks); `npm run build` ok. Chromium at 1280 and 390 px, game / Plain / normal, plus crowded (15 sectors), demo and empty fixtures: no horizontal overflow, markers all >= 44 px, nothing under 44 px in the map and marks list, gold-and-ink focus ring visible, pressing a marker focuses its radio (live) or its row (demo). Review fixes (PR review): collision-free layout with pure no-overlap tests at 330, 350 and 560 px for 12 same-level, 15 mixed, 24 unmarked and 30 heavy sectors; one name per state (Inside / On the edge / Outside / Unmarked); single announced group per control; page tests for the view switch, demo gating, press-a-marker focus and the PUT/DELETE payloads (node environment, so focus is tested on a fake document, not a real browser).

## Not verified

Real data (only synthetic fixtures); Faiz's browser and screen; the real sector count; screen reader output; a colour-blind simulation; real touch devices; Safari/Firefox (without container query units the marker glide is a jump); `Competence.sectors` being the full sector list (assumed).

Crowding is the known weak point. The inside of the circle is small, so about 4-6 same-level markers fit on a phone and the rest appear only in the "N smaller sectors" tag and in the list (a 12-sector all-"know" or all-"on the edge" portfolio shows 6 and counts 6 in the tag). Markers are small (24-42 px drawn) so that the bands can hold them; on a phone no names print, only numbers that match the list rows. The invisible 44 px tap boxes of two small neighbours can overlap by a few pixels. Not seen: a real portfolio with many marked sectors.

## Look-and-judge for Faiz

1. Does an unmarked big sector look as important as an inside one, and does nothing read as "good"?
2. Is "partly" (half marker on the line) understood without explanation?
3. Is the phone map readable enough with numbered pins and a "N smaller sectors" tag, or should the list come first there?
4. Should Plain view lose its green/amber/red too?
5. The page is long (one row per sector with a three-state control): collapse rows until a marker is pressed?

## Identity score (inferred from code and screenshots)

Circle 0-1 -> 2 (ring map hero, kit pieces, real facts as position/size/pattern, Plain view, truth rules). Not 3 until seen on real data and judged memorable.
